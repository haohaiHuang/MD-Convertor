import { clearBadgeLater, runWithFeedback, type ChromeDeps } from "./worker-run";

// The only place that touches the real `chrome` API; everything worth testing lives in
// `worker-run.ts` behind an injected `deps`.
const deps: ChromeDeps = {
  action: {
    setBadgeText: (options) => chrome.action.setBadgeText(options),
    setTitle: (options) => chrome.action.setTitle(options),
  },
  scripting: { executeScript: (injection) => chrome.scripting.executeScript(injection) },
  downloads: {
    download: (options) => chrome.downloads.download(options),
    search: async (query) => {
      const items = await chrome.downloads.search(query);
      return items.map(({ state, filename }) => ({ state, filename: filename ?? "" }));
    },
  },
  runtime: {
    onMessage: {
      addListener: (listener) => chrome.runtime.onMessage.addListener(listener),
      removeListener: (listener) => chrome.runtime.onMessage.removeListener(listener),
    },
  },
};

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  // `void` without `.catch()` swallows the throw and looks like "the click did nothing". The badge
  // clear is a separate promise on purpose: waiting 4s must not keep the run pending.
  void runWithFeedback(tab.id, deps)
    .then(() => clearBadgeLater(deps))
    .catch((error: unknown) => console.warn("[md-convertor]", error));
});

// Test hook: Playwright cannot click the browser toolbar, so `extension/tests/skeleton.spec.ts`
// calls the orchestration directly. Nothing in the extension reads it.
(globalThis as { __mdConvertorRun?: (tabId: number) => Promise<unknown> }).__mdConvertorRun = (tabId) =>
  runWithFeedback(tabId, deps);
