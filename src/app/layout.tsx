import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_TC({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "小帳本", template: "%s｜小帳本" },
  description: "安全、簡單的私人雲端記帳工具",
  appleWebApp: { capable: true, title: "小帳本", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e7ead6" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body className={noto.variable}>{children}</body></html>;
}
