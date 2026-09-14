import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生产工艺设备管理信息系统",
  description:
    "设备台账 / 保养计划与工单 / 故障维修 / 备件库存 / 用户权限与操作日志的一体化管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
