import { describe, expect, it } from "vitest";
import { providerFormError } from "./provider-form";

const complete = {
  name: "Mimo",
  baseUrl: "https://api.xiaomimimo.com/v1",
  keyStored: true,
  keyInput: "",
  selectedModel: "mimo-v2.5-pro",
};

describe("providerFormError", () => {
  it("accepts a provider that has all four fields", () => {
    expect(providerFormError(complete)).toBeNull();
  });

  it("rejects a blank name", () => {
    expect(providerFormError({ ...complete, name: "   " })).toBe("请填写 Provider 名称。");
  });

  it("rejects a URL that is not an absolute http(s) URL", () => {
    expect(providerFormError({ ...complete, baseUrl: "api.xiaomimimo.com/v1" }))
      .toBe("请填写完整的 http(s) 接口地址。");
  });

  it("rejects a URL that carries credentials", () => {
    expect(providerFormError({ ...complete, baseUrl: "https://user:secret@api.example.com/v1" }))
      .toBe("请填写完整的 http(s) 接口地址。");
  });

  it("rejects a key that is neither stored nor typed", () => {
    expect(providerFormError({ ...complete, keyStored: false, keyInput: "  " })).toBe("请先填写 API 密钥。");
  });

  it("accepts an un-stored key when the user typed one this session", () => {
    expect(providerFormError({ ...complete, keyStored: false, keyInput: " sk-live-1234 " })).toBeNull();
  });

  it("rejects a missing or blank model", () => {
    expect(providerFormError({ ...complete, selectedModel: null })).toBe("请先拉取或选择模型。");
    expect(providerFormError({ ...complete, selectedModel: " " })).toBe("请先拉取或选择模型。");
  });

  it("reports the fields in the order the form shows them", () => {
    expect(providerFormError({ name: "", baseUrl: "", keyStored: false, keyInput: "", selectedModel: null }))
      .toBe("请填写 Provider 名称。");
  });
});
