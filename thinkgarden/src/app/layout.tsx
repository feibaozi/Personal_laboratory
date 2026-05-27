import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkGarden",
  description: "AI 驱动的思维花园——让碎片经验长成知识体系",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
