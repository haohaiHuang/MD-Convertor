"use client";

/**
 * Which screen the homepage opens on, plus the `?from=` marker the settings screen hands back
 * (L7). Module state rather than a search param on the return trip: the converter screen is
 * `homeMode` state, not a route, so there is nothing to navigate back to.
 */
export type HomeMode = "home" | "convert" | "local-docs";

let pending: HomeMode = "home";

/** Called on the way into settings: the screen the user came from. */
export function setPendingHomeMode(mode: HomeMode): void {
  pending = mode;
}

/**
 * Read by the homepage's `useState` initializer. Deliberately not a destructive take: a
 * StrictMode double-render may run the initializer twice, and the value is overwritten on
 * every exit from settings anyway.
 */
export function pendingHomeMode(): HomeMode {
  return pending;
}

/** `?from=` is untrusted input: anything unknown means the landing screen. */
export function homeModeFromSearch(search: string): HomeMode {
  const from = new URLSearchParams(search).get("from");
  return from === "convert" || from === "local-docs" ? from : "home";
}
