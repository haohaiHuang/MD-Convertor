import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { app, BrowserWindow, shell } from "electron";

const HOST = "127.0.0.1";
let serverProcess;

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

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: serverRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: HOST,
      NODE_ENV: "production",
      PORT: String(port),
      MD_CONVERTOR_SESSION_TOKEN: sessionToken,
      PLAYWRIGHT_EXECUTABLE_PATH: path.join(serverRoot, "browser", "chrome-headless-shell"),
    },
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
    window.webContents.once("did-finish-load", () => app.quit());
  }
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

app.whenReady().then(async () => {
  const runtime = process.env.ELECTRON_RENDERER_URL
    ? {
        rendererUrl: process.env.ELECTRON_RENDERER_URL,
        sessionToken: process.env.MD_CONVERTOR_SESSION_TOKEN,
      }
    : await startProductionServer();
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
