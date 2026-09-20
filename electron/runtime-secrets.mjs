/**
 * Pushes a saved or removed key to the already running local server so it takes
 * effect without a restart.
 *
 * The key travels in the request body only. Failures degrade to a warning, never
 * to a thrown error: the key is already stored safely on disk and will be picked
 * up on the next launch, so a transport problem must not fail the bridge call.
 */

const RUNTIME_SECRETS_PATH = "/api/runtime/secrets";

export async function pushRuntimeSecret({ rendererUrl, sessionToken, providerId, value, fetchImpl = fetch }) {
  const headers = { "content-type": "application/json" };
  if (sessionToken) {
    headers["x-md-convertor-token"] = sessionToken;
  }

  let response;
  try {
    response = await fetchImpl(`${rendererUrl}${RUNTIME_SECRETS_PATH}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ providerId, value: value ?? null }),
    });
  } catch (error) {
    console.warn(`Pushing a provider key to the local server failed: ${error?.cause?.code ?? error?.code ?? error?.name ?? "UNKNOWN"}`);
    return false;
  }

  if (!response.ok) {
    console.warn(`Pushing a provider key to the local server was rejected: ${response.status}`);
    return false;
  }
  return true;
}
