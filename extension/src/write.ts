export type DownloadRequest = {
  url: string;
  filename: string;
  conflictAction: "overwrite";
  saveAs: false;
};

export type DownloadsApi = {
  download(options: DownloadRequest): Promise<number>;
};

// The markdown is generated in memory, so a data URL avoids an object URL to revoke later
// (the T2.0 probe wrote 2 MiB this way).
export function markdownDataUrl(markdown: string): string {
  return `data:text/markdown;charset=utf-8,${encodeURIComponent(markdown)}`;
}

// `filename` stays relative on purpose: an absolute path is rejected with `Invalid filename`.
export function writeMarkdown(downloads: DownloadsApi, mdName: string, markdown: string): Promise<number> {
  return downloads.download({
    url: markdownDataUrl(markdown),
    filename: mdName,
    conflictAction: "overwrite",
    saveAs: false,
  });
}
