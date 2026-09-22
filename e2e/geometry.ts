import type { Locator, Page } from "@playwright/test";

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Reads several elements' rectangles inside one synchronous frame.
 *
 * Do not compare rectangles that describe a single row by calling `boundingBox()` twice. Each call
 * is its own round trip, so anything that moves the page between them is measured as a broken
 * layout. A scroll is the usual culprit: `fill()` scrolls its field into view, that scroll is still
 * in flight when the call returns, and the two samples then land on different scroll offsets. On
 * the settings Base URL row this reproduced in 6 of 40 firefox runs as a convincing 131px
 * "misalignment" that was nothing but the scroll delta (urlY 821 before the scroll settled, 690
 * after, scrollY 132).
 *
 * Reading every rectangle inside one `evaluate` call closes that window: the browser cannot run a
 * scroll, a font swap or a re-render between two `getBoundingClientRect()` calls in the same task,
 * so a mismatch can only mean the layout really is wrong.
 */
export async function rectsInOneFrame<const T extends Record<string, Locator>>(
  page: Page,
  targets: T,
): Promise<{ [K in keyof T]: Rect }> {
  const names = Object.keys(targets) as Array<keyof T & string>;
  const handles = await Promise.all(names.map((name) => targets[name].elementHandle()));
  return page.evaluate(
    ([pairs]) => {
      const out: Record<string, Rect> = {};
      for (const [name, element] of pairs) {
        if (!element) throw new Error(`rectsInOneFrame: "${name}" matched no element`);
        const box = (element as Element).getBoundingClientRect();
        out[name] = { x: box.x, y: box.y, width: box.width, height: box.height };
      }
      return out;
    },
    [names.map((name, index) => [name, handles[index]] as const)] as const,
  ) as Promise<{ [K in keyof T]: Rect }>;
}
