import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

// Vendored in `public/fonts` so the build never reaches Google and the packaged app
// ships the exact woff2 it was built with. Licence text sits next to the file.
const michroma = localFont({
  src: "../../public/fonts/Michroma-Regular.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-brand",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "MD-Convertor｜网页转 Markdown";
  const description = "粘贴公开网页链接，快速获得可复制、可下载、图片内嵌的 Markdown 文档。";

  return {
    metadataBase,
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "MD-Convertor 网页转 Markdown" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={michroma.variable}>
      <body>{children}</body>
    </html>
  );
}
