import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mood Radio - 情绪音乐电台",
  description: "告诉AI你的心情，让它为你生成专属歌单",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <div id="app-shell" className="h-full w-full rounded-[16px] overflow-hidden bg-[rgba(10,10,30,0.85)] backdrop-blur-[20px]">
          {children}
        </div>
      </body>
    </html>
  );
}