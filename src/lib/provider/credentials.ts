/**
 * Provider key resolution for the local server.
 *
 * The only source is the in-memory runtime map, seeded at startup from the
 * base64 JSON that Electron main injects as `MD_CONVERTOR_SECRETS` and updated
 * live by `POST /api/runtime/secrets` after the user saves or clears a key.
 *
 * Plaintext keys never leave this module except as the return value of
 * `resolveProviderKey`, and are never logged or persisted by the local server.
 */
export type ResolvedProviderKey = {
  key: string;
};

export type ProviderKeyLookup = {
  id: string;
};

let runtimeSecrets: Map<string, string> | null = null;

function readInjectedSecrets(): Map<string, string> {
  const secrets = new Map<string, string>();
  const payload = process.env.MD_CONVERTOR_SECRETS?.trim();
  if (!payload) {
    return secrets;
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      for (const [providerId, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) {
          secrets.set(providerId, value.trim());
        }
      }
    }
  } catch {
    // An unreadable payload means "no stored keys" — never a hard failure.
  }

  return secrets;
}

function runtimeMap(): Map<string, string> {
  runtimeSecrets ??= readInjectedSecrets();
  return runtimeSecrets;
}

/** Applies a key that was saved or cleared while the app is running. */
export function setRuntimeSecret(providerId: string, value: string | null): void {
  const secrets = runtimeMap();
  const trimmed = value?.trim() ?? "";
  if (trimmed) {
    secrets.set(providerId, trimmed);
  } else {
    secrets.delete(providerId);
  }
}

/** Test hook: forget the injected snapshot so the next read re-seeds it. */
export function resetRuntimeSecrets(): void {
  runtimeSecrets = null;
}

export function resolveProviderKey(provider: ProviderKeyLookup): ResolvedProviderKey | null {
  const stored = runtimeMap().get(provider.id);
  return stored ? { key: stored } : null;
}
