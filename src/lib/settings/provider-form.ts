import { isHttpUrl } from "@/types/settings";

export type ProviderFormFields = {
  name: string;
  baseUrl: string;
  /** Whether the system keychain already holds a key for this provider. */
  keyStored: boolean;
  /** What the user typed into the key field this session. */
  keyInput: string;
  selectedModel: string | null;
};

/**
 * The four fields a cloud Provider needs before it can be saved. Returns the
 * message for the first field the user still has to fill, or null when the
 * form is complete.
 */
export function providerFormError(fields: ProviderFormFields): string | null {
  if (!fields.name.trim()) {
    return "请填写 Provider 名称。";
  }
  if (!isHttpUrl(fields.baseUrl.trim())) {
    return "请填写完整的 http(s) 接口地址。";
  }
  if (!fields.keyStored && !fields.keyInput.trim()) {
    return "请先填写 API 密钥。";
  }
  if (!fields.selectedModel?.trim()) {
    return "请先拉取或选择模型。";
  }
  return null;
}
