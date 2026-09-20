/**
 * Suffix for the translated download name (PRD Q4.4): BCP-47 tags become
 * lower-case, hyphen-separated (`zh-Hans` -> `article-zh-hans.md`).
 */
export function languageSuffix(tag: string): string {
  return tag.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function translatedFilename(filename: string, targetLanguage: string): string {
  const suffix = languageSuffix(targetLanguage);
  if (!suffix) return filename;
  return `${filename.replace(/\.md$/i, "")}-${suffix}.md`;
}
