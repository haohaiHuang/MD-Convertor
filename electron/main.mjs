import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { app, BrowserWindow, ipcMain, safeStorage, shell } from "electron";
import preloadContract from "./preload-contract.cjs";
import { buildServerEnv, readDotEnvFile, readLoginShellPath, resolvePathEnv } from "./env.mjs";
import { pushRuntimeSecret } from "./runtime-secrets.mjs";
import { resolveServerBinary } from "./server-binary.mjs";
import { createSecretsStore } from "./secrets.mjs";

const { CHANNELS, isValidProviderId } = preloadContract;
const HOST = "127.0.0.1";
let serverProcess;
/** Set once the local server answers, so key changes can reach it without a restart. */
let currentRuntime = null;

const userDataDir = app.getPath("userData");
const secretsStore = createSecretsStore({
  filePath: path.join(userDataDir, "secrets.json"),
  safeStorage,
});

async function readStoredSecrets() {
  try {
    return await secretsStore.exportPlaintext();
  } catch (error) {
    console.warn(`Stored secrets are unavailable to the local server: ${error?.code ?? "UNKNOWN"}`);
    return {};
  }
}

async function readUserDotEnv() {
  try {
    return await readDotEnvFile(path.join(userDataDir, ".env"));
  } catch (error) {
    console.warn(`The user data .env could not be read: ${error?.code ?? "UNKNOWN"}`);
    return {};
  }
}

/** Key material crosses this boundary only as codes; error messages may contain secrets. */
function registerSecretsIpc() {
  const applyRuntimeSecret = (providerId, value) => {
    if (!currentRuntime) return Promise.resolve(false);
    // Awaited so the bridge resolves only once the running server really has the key.
    return pushRuntimeSecret({
      rendererUrl: currentRuntime.rendererUrl,
      sessionToken: currentRuntime.sessionToken,
      providerId,
      value,
    });
  };

  ipcMain.handle(CHANNELS.set, async (_event, payload) => {
    if (!isValidProviderId(payload?.providerId)) return { ok: false, code: "INVALID_PROVIDER_ID" };
    try {
      await secretsStore.set(payload.providerId, payload?.value);
      await applyRuntimeSecret(payload.providerId, payload?.value);
      return { ok: true, keyStored: true };
    } catch (error) {
      const code = error?.code ?? "SECRETS_FAILED";
      console.warn(`Storing a provider key failed: ${code}`);
      return { ok: false, code };
    }
  });

  ipcMain.handle(CHANNELS.clear, async (_event, payload) => {
    if (!isValidProviderId(payload?.providerId)) return { ok: false, code: "INVALID_PROVIDER_ID" };
    try {
      await secretsStore.clear(payload.providerId);
      await applyRuntimeSecret(payload.providerId, null);
      return { ok: true, keyStored: false };
    } catch (error) {
      const code = error?.code ?? "SECRETS_FAILED";
      console.warn(`Removing a provider key failed: ${code}`);
      return { ok: false, code };
    }
  });

  ipcMain.handle(CHANNELS.status, () => ({
    ok: true,
    encryptionAvailable: safeStorage.isEncryptionAvailable(),
  }));
}

function isSafeExternalUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

async function reservePort() {
  const server = http.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, HOST, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("无法确定本地服务端口。");
  }
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null) throw new Error("本地转换服务启动失败。");
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {
      // The server can refuse connections briefly while Next.js initializes.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("本地转换服务启动超时。");
}

async function startProductionServer() {
  const port = await reservePort();
  const sessionToken = randomBytes(32).toString("base64url");
  const serverRoot = path.join(process.resourcesPath, "server");
  const serverEntry = path.join(serverRoot, "server.js");
  const rendererUrl = `http://${HOST}:${port}`;

  const serverEnv = buildServerEnv({
    baseEnv: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: HOST,
      NODE_ENV: "production",
      PORT: String(port),
      MD_CONVERTOR_SESSION_TOKEN: sessionToken,
      PLAYWRIGHT_EXECUTABLE_PATH: path.join(serverRoot, "browser", "chrome-headless-shell"),
    },
    pathEnv: resolvePathEnv({
      processPath: process.env.PATH,
      loginShellPath: readLoginShellPath(),
      homeDir: app.getPath("home"),
    }),
    userDataDir,
    secrets: await readStoredSecrets(),
    dotEnv: await readUserDotEnv(),
  });

  serverProcess = spawn(resolveServerBinary(process.execPath), [serverEntry], {
    cwd: serverRoot,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProcess.stdout.on("data", (chunk) => console.info(String(chunk).trimEnd()));
  serverProcess.stderr.on("data", (chunk) => console.error(String(chunk).trimEnd()));
  await waitForServer(rendererUrl);
  return { rendererUrl, sessionToken };
}

async function createMainWindow(rendererUrl, sessionToken) {
  const rendererOrigin = new URL(rendererUrl).origin;
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 960,
    minHeight: 680,
    title: "MD-Convertor",
    backgroundColor: "#f6f4ef",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(import.meta.dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  if (sessionToken) {
    window.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: [`${rendererOrigin}/*`] },
      (details, callback) => {
        details.requestHeaders["X-MD-Convertor-Token"] = sessionToken;
        callback({ requestHeaders: details.requestHeaders });
      },
    );
  }

  if (process.env.ELECTRON_SMOKE_TEST === "1") {
    window.webContents.once("did-finish-load", () => {
      void runBridgeSmokeTest(window);
    });
  }
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`Preload failed: ${preloadPath}: ${error?.message ?? error}`);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isSafeExternalUrl(url) && new URL(url).origin === rendererOrigin) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });
  window.once("ready-to-show", () => window.show());
  await window.loadURL(rendererUrl);

  if (process.env.ELECTRON_CONVERSION_SMOKE_URL) {
    const response = await fetch(`${rendererUrl}/api/convert`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(sessionToken ? { "x-md-convertor-token": sessionToken } : {}),
      },
      body: JSON.stringify({ url: process.env.ELECTRON_CONVERSION_SMOKE_URL }),
    });
    const responseText = await response.text();
    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error(`桌面转换冒烟测试返回非 JSON 响应：${responseText.slice(0, 200)}`);
    }
    if (!response.ok) throw new Error(`桌面转换冒烟测试失败：${JSON.stringify(payload)}`);
    const markdown = typeof payload.markdown === "string" ? payload.markdown : "";
    const embeddedImageCount = (markdown.match(/data:image\//g) ?? []).length;
    const nonBase64Chars = markdown.replace(/data:image\/[^)\s>]+/g, "").length;
    const minimumTextChars = Number(process.env.ELECTRON_SMOKE_MIN_TEXT_CHARS ?? 0);
    const minimumImageCount = Number(process.env.ELECTRON_SMOKE_MIN_IMAGE_COUNT ?? 0);
    if (nonBase64Chars < minimumTextChars || embeddedImageCount < minimumImageCount) {
      throw new Error(
        `桌面转换冒烟测试内容不足：${nonBase64Chars} non-Base64 chars, ${embeddedImageCount} embedded images`,
      );
    }
    console.info(
      `Desktop conversion smoke passed: ${payload.meta.extractionMode}, ${payload.meta.outputBytes} bytes, ${nonBase64Chars} non-Base64 chars, ${embeddedImageCount} embedded images`,
    );
    app.quit();
  }
}

/**
 * Packaged smoke test for the key push path: saving a key reaches the running
 * server without a restart, clearing it takes effect, and an unset runtime key
 * still falls back to the provider's environment variable.
 */
async function runSecretsSmokeTest(window) {
  return window.webContents.executeJavaScript(
    `(async () => {
      const json = (payload) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const callApi = async (method, payload) => {
        const response = await fetch("/api/settings", { method, ...(payload ? json(payload) : { headers: { "content-type": "application/json" } }) });
        return { status: response.status, payload: await response.json().catch(() => null) };
      };
      const modelCode = async (providerId) => {
        const response = await fetch("/api/provider/models", { method: "POST", ...json({ providerId }) });
        const payload = await response.json().catch(() => null);
        return response.ok ? "OK" : payload?.error?.code ?? String(response.status);
      };
      const shared = { baseUrl: "http://127.0.0.1:9/v1", keyStored: false, models: [], selectedModel: null };
      const current = (await callApi("GET")).payload;
      const setup = await callApi("PUT", {
        ...current,
        cloud: {
          activeProviderId: null,
          providers: [
            { ...shared, id: "smoke-runtime", name: "Smoke Runtime" },
          ],
        },
      });
      if (setup.status !== 200) return { failed: "setup", status: setup.status, payload: setup.payload };
      const before = await modelCode("smoke-runtime");
      const stored = await window.mdConvertor.secrets.set("smoke-runtime", "sk-smoke-runtime-placeholder");
      const afterSet = await modelCode("smoke-runtime");
      const cleared = await window.mdConvertor.secrets.clear("smoke-runtime");
      const afterClear = await modelCode("smoke-runtime");
      const restored = await callApi("PUT", current);
      return { before, stored, afterSet, cleared, afterClear, restored: restored.status };
    })()`,
  );
}

async function runBridgeSmokeTest(window) {
  try {
    const result = await window.webContents.executeJavaScript(
      `(async () => {
        const bridge = typeof window.mdConvertor?.secrets?.set;
        const status = await window.mdConvertor.secrets.status();
        return { bridge, status };
      })()`,
    );
    if (result?.bridge !== "function" || result?.status?.ok !== true) {
      throw new Error(`Preload bridge smoke test failed: ${JSON.stringify(result)}`);
    }
    console.info(
      `Preload bridge smoke passed: secrets.set ${result.bridge}, encryptionAvailable ${result.status.encryptionAvailable}`,
    );

    if (process.env.ELECTRON_SMOKE_TEST_SECRETS === "1") {
      const secrets = await runSecretsSmokeTest(window);
      const expected = secrets.before === "TRANSLATE_NOT_CONFIGURED"
        && secrets.stored?.ok === true
        && secrets.afterSet === "TRANSLATE_PROVIDER_ERROR"
        && secrets.cleared?.ok === true
        && secrets.afterClear === "TRANSLATE_NOT_CONFIGURED"
        && secrets.restored === 200;
      if (!expected) throw new Error(`Runtime secret smoke test failed: ${JSON.stringify(secrets)}`);
      console.info(
        `Runtime secret smoke passed: ${secrets.before} → ${secrets.afterSet} → ${secrets.afterClear}`,
      );
    }
    app.quit();
  } catch (error) {
    console.error(error);
    serverProcess?.kill();
    app.exit(1);
  }
}

app.whenReady().then(async () => {
  registerSecretsIpc();
  const runtime = process.env.ELECTRON_RENDERER_URL
    ? {
        rendererUrl: process.env.ELECTRON_RENDERER_URL,
        sessionToken: process.env.MD_CONVERTOR_SESSION_TOKEN,
      }
    : await startProductionServer();
  currentRuntime = runtime;
  await createMainWindow(runtime.rendererUrl, runtime.sessionToken);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow(runtime.rendererUrl, runtime.sessionToken);
    }
  });
}).catch((error) => {
  console.error(error);
  app.exit(1);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});
