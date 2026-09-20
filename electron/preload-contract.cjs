/**
 * Channel names and value limits shared by the main process and the secrets bridge.
 *
 * `electron/preload.cjs` cannot require this file: Electron sandboxed preloads only
 * resolve built-in modules, so the preload repeats these values and
 * `electron/preload.test.cjs` asserts the copies stay in sync.
 */
const CHANNELS = Object.freeze({
  set: "md-convertor:secrets:set",
  clear: "md-convertor:secrets:clear",
  status: "md-convertor:secrets:status",
});

const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const MAX_SECRET_LENGTH = 8192;

function isValidProviderId(value) {
  return typeof value === "string" && PROVIDER_ID_PATTERN.test(value);
}

module.exports = { CHANNELS, PROVIDER_ID_PATTERN, MAX_SECRET_LENGTH, isValidProviderId };
