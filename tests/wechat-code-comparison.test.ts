import { describe, expect, it } from "vitest";
import { normalizeCodeBlockForComparison } from "./wechat-code-comparison";

function legacyComparableText(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("zh-CN");
}

describe("WeChat code-block comparison", () => {
  it("rejects punctuation loss that the legacy text comparator accepts", () => {
    const source = 'const result = format(value + 1, "ok");';
    const converted = 'const result format(value 1 "ok")';

    expect(legacyComparableText(source)).toBe(legacyComparableText(converted));
    expect(normalizeCodeBlockForComparison(source)).not.toBe(normalizeCodeBlockForComparison(converted));
  });

  it("ignores wrapper line-ending and trailing layout differences only", () => {
    expect(normalizeCodeBlockForComparison("\nconst value = 1;  \r\nreturn value;\n"))
      .toBe("const value = 1;\nreturn value;");
    expect(normalizeCodeBlockForComparison("value + 1")).not.toBe("value - 1");
    expect(normalizeCodeBlockForComparison('"a  b"')).not.toBe('"a b"');
  });
});
