import { expect, test } from "@playwright/test";

// Every other spec fulfils `**/api/convert` inside the browser, so nothing else proves that the
// real route handler can load its Playwright runtime. Next.js output tracing follows
// `playwright-core`'s static `require("electron")` but misses `playwright-core/browsers.json`,
// which the same import reads at runtime; without that file the route fails to load and answers
// 500 for any link. A blocked loopback link keeps this check offline and still requires the
// handler to be loaded, since the rejection happens after the import.
test("the real convert endpoint answers instead of failing to load its browser runtime", async ({ request }) => {
  const response = await request.post("/api/convert", { data: { url: "http://127.0.0.1:9/blocked" } });

  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ error: { code: "PRIVATE_TARGET" } });
});

// The other offline-capable half of the real pipeline: `paste.spec.ts` mocks this endpoint in the
// browser, so this is the only place the built server actually extracts pasted content.
test("the real paste endpoint extracts pasted content", async ({ request }) => {
  const response = await request.post("/api/convert-paste", {
    data: {
      html: "<article><h1>真实粘贴标题</h1><p>真实粘贴正文。</p></article>",
      text: "真实粘贴标题\n真实粘贴正文。",
    },
  });

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { markdown: string; meta: { extractionMode: string } };
  expect(body.markdown).toContain("真实粘贴标题");
  expect(body.markdown).toContain("真实粘贴正文。");
  expect(body.meta.extractionMode).toBe("paste");
});
