import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { convertPastedContent } from "./convert-paste";

function embeddedPng(markdown: string): Buffer {
  const match = markdown.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  expect(match).not.toBeNull();
  return Buffer.from(match![1], "base64");
}

describe("pasted rendered Mermaid images", () => {
  it("rasterizes a rendered Mermaid SVG into an embedded PNG", async () => {
    const result = await convertPastedContent(
      {
        html: `<article><h1>Rendered diagram</h1><p>正文内容</p>
          <div class="mermaid"><svg xmlns="http://www.w3.org/2000/svg"
            aria-roledescription="flowchart-v2" width="320" height="120" viewBox="0 0 320 120">
            <rect x="10" y="10" width="300" height="100" rx="8" fill="#eef2ff" stroke="#4f46e5"/>
            <text x="160" y="66" text-anchor="middle" fill="#111827">Node A</text>
          </svg></div></article>`,
        text: "Rendered diagram\n正文内容\nNode A",
      },
      new AbortController().signal,
    );

    expect(result.warnings).toEqual([]);
    expect(result.markdown).toMatch(/!\[Mermaid 图表\]\(data:image\/png;base64,[A-Za-z0-9+/=]+\)/);
    expect(result.markdown).not.toMatch(/<svg|aria-roledescription/i);
    expect(result.markdown).not.toContain("data-md-convertor-generated");
    expect(result.warnings.map((warning) => warning.code)).not.toContain("MERMAID_RENDER_UNAVAILABLE");
    const raster = embeddedPng(result.markdown);
    expect((await sharp(raster).stats()).isOpaque).toBe(true);
    expect(Array.from(await sharp(raster)
      .extract({ left: 0, top: 0, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer())).toEqual([255, 255, 255]);
    expect(result.meta).toMatchObject({
      sourceImageCount: 1,
      embeddedImageCount: 1,
      omittedImageCount: 0,
    });
  });

  it("rejects an active-content-only Mermaid SVG instead of emitting a blank image", async () => {
    const result = await convertPastedContent(
      {
        html: `<article><h1>Unsafe diagram</h1><p>正文内容</p>
          <div class="mermaid"><svg xmlns="http://www.w3.org/2000/svg"
            aria-roledescription="flowchart-v2" width="320" height="120">
            <script>alert(1)</script>
            <image href="https://example.invalid/tracker.png" width="320" height="120"/>
            <foreignObject width="320" height="120"><iframe src="https://example.invalid/"></iframe></foreignObject>
          </svg></div></article>`,
        text: "Unsafe diagram\n正文内容",
      },
      new AbortController().signal,
    );

    expect(result.markdown).toContain("Mermaid 图表未能安全转换");
    expect(result.markdown).not.toMatch(/data:image\/|<svg|script|iframe|tracker/i);
    expect(result.warnings.map((warning) => warning.code)).toContain("MERMAID_RENDER_UNAVAILABLE");
    expect(result.meta.embeddedImageCount).toBe(0);
  });

  it("preserves Mermaid labels copied through foreignObject as a raster image", async () => {
    const result = await convertPastedContent(
      {
        html: `<article><h1>Foreign object diagram</h1><p>正文内容</p>
          <div class="mermaid"><svg xmlns="http://www.w3.org/2000/svg"
            aria-roledescription="flowchart-v2" width="400" height="160" viewBox="0 0 400 160">
            <rect x="20" y="20" width="360" height="120" rx="8" fill="#eef2ff" stroke="#4f46e5"/>
            <foreignObject x="70" y="45" width="260" height="70">
              <div xmlns="http://www.w3.org/1999/xhtml"><span>Harness</span><br/>Engineering</div>
            </foreignObject>
          </svg></div></article>`,
        text: "Foreign object diagram\n正文内容\nHarness Engineering",
      },
      new AbortController().signal,
    );

    expect(result.warnings).toEqual([]);
    expect(await sharp(embeddedPng(result.markdown)).metadata()).toMatchObject({ format: "png" });
    expect(result.meta).toMatchObject({ sourceImageCount: 1, embeddedImageCount: 1, omittedImageCount: 0 });
  });

  it("caps a large Mermaid SVG raster at 2048 pixels", async () => {
    const result = await convertPastedContent(
      {
        html: `<article><h1>Large diagram</h1><p>正文内容</p>
          <div class="mermaid"><svg xmlns="http://www.w3.org/2000/svg"
            aria-roledescription="flowchart-v2" width="100%" viewBox="0 0 4096 1024">
            <rect x="0" y="0" width="4096" height="1024" fill="#eef2ff"/>
            <text x="2048" y="512" text-anchor="middle">Large diagram</text>
          </svg></div></article>`,
        text: "Large diagram\n正文内容",
      },
      new AbortController().signal,
    );

    const metadata = await sharp(embeddedPng(result.markdown)).metadata();
    expect(metadata.width).toBeLessThanOrEqual(2048);
    expect(metadata.height).toBeLessThanOrEqual(2048);
    expect(result.meta.embeddedImageCount).toBe(1);
  });

  it("normalizes pasted dark-theme Mermaid nodes and labels to a readable light palette", async () => {
    const result = await convertPastedContent(
      {
        html: `<article><h1>Dark diagram</h1><p>正文内容</p>
          <div class="mermaid"><svg id="mermaid-dark" xmlns="http://www.w3.org/2000/svg"
            aria-roledescription="flowchart-v2" width="320" height="120" viewBox="0 0 320 120">
            <style>#mermaid-dark{font-family:sans-serif;font-size:18px;fill:#ccc}
              #mermaid-dark .node rect{fill:#1f2020;stroke:#ccc}</style>
            <g class="node"><rect x="10" y="10" width="300" height="100" rx="8"
              style="fill:#000000;stroke:#000000"/>
              <foreignObject x="20" y="30" width="280" height="60">
                <div xmlns="http://www.w3.org/1999/xhtml">Dark label</div>
              </foreignObject></g>
          </svg></div></article>`,
        text: "Dark diagram\n正文内容\nDark label",
      },
      new AbortController().signal,
    );

    const raster = embeddedPng(result.markdown);
    const nodePixel = Array.from(await sharp(raster)
      .extract({ left: 30, top: 20, width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer());
    expect(nodePixel[0]).toBeGreaterThan(220);
    expect(nodePixel[1]).toBeGreaterThan(220);
    expect(nodePixel[2]).toBeGreaterThan(220);

    const pixels = await sharp(raster)
      .extract({ left: 100, top: 45, width: 120, height: 30 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let darkPixels = 0;
    for (let index = 0; index < pixels.length; index += 3) {
      if (pixels[index] < 80 && pixels[index + 1] < 80 && pixels[index + 2] < 80) {
        darkPixels += 1;
      }
    }
    expect(darkPixels).toBeGreaterThan(20);
  });

  it("counts Mermaid diagrams beyond the thirty-image limit as omitted", async () => {
    const diagrams = Array.from({ length: 31 }, (_, index) => `
      <div class="mermaid"><svg xmlns="http://www.w3.org/2000/svg"
        aria-roledescription="flowchart-v2" width="80" height="40" viewBox="0 0 80 40">
        <rect x="1" y="1" width="78" height="38"/><text x="40" y="24">${index + 1}</text>
      </svg></div>`).join("");

    const result = await convertPastedContent(
      {
        html: `<article><h1>Many diagrams</h1><p>正文内容</p>${diagrams}</article>`,
        text: "Many diagrams\n正文内容",
      },
      new AbortController().signal,
    );

    expect(result.meta).toMatchObject({
      sourceImageCount: 31,
      embeddedImageCount: 30,
      omittedImageCount: 1,
    });
    expect(result.warnings).toContainEqual({
      code: "MERMAID_COUNT_LIMIT",
      message: "粘贴内容包含超过 30 张 Mermaid 图表，额外图表已保留占位文本。",
    });
  });
});
