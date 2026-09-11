import "./globals.css";

export const metadata = {
  title: "AI情报雷达平台",
  description: "面向AI安全事件、AI产品动态和AI合规治理的信息监测与研判平台"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
