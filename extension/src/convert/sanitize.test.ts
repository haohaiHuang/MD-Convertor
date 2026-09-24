import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { createSanitizer } from "./sanitize";

function sanitizerFor(window: JSDOM["window"]) {
  return createSanitizer(createDOMPurify(window));
}

describe("createSanitizer", () => {
  it("strips scripts, event handlers and javascript: links", () => {
    const dom = new JSDOM("");
    const sanitize = sanitizerFor(dom.window);
    const clean = sanitize(
      '<p onclick="steal()">hi</p><script>bad()</script><a href="javascript:bad()">x</a><img src="x" onerror="steal()">',
    );
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("hi");
  });

  it("drops style attributes, style tags and non-html profiles", () => {
    const dom = new JSDOM("");
    const sanitize = sanitizerFor(dom.window);
    const clean = sanitize('<p style="color:red">text</p><style>p{}</style><svg><circle /></svg>');
    expect(clean).not.toContain("style=");
    expect(clean).not.toContain("<style");
    expect(clean).not.toContain("<svg");
    expect(clean).toContain("text");
  });
});
