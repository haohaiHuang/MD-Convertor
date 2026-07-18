export type ExtractionMode = "direct" | "browser" | "body-fallback";

export type ConversionWarning = {
  code: string;
  message: string;
};

export type ConvertResponse = {
  title: string;
  filename: string;
  markdown: string;
  warnings: ConversionWarning[];
  meta: {
    sourceUrl: string;
    convertedAt: string;
    extractionMode: ExtractionMode;
    outputBytes: number;
    textChars: number;
    sourceImageCount: number;
    embeddedImageCount: number;
    omittedImageCount: number;
  };
};

export type ExtractedContent = {
  title: string;
  html: string;
  textLength: number;
};
