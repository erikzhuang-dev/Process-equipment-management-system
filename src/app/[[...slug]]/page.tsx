"use client";

import dynamic from "next/dynamic";
import { Providers } from "../providers";

/**
 * 单 catch-all 页（策略 A：客户端渲染平移）：
 * 所有路径 /、/dashboard、/equipment/:id、/maintenance 等都由此页承载，
 * 内部沿用 wouter Switch 做客户端路由，URL 与原 Vite 版完全兼容，刷新不 404。
 * App 以 ssr:false 动态加载——原应用为纯 CSR（依赖 window/localStorage 等
 * 浏览器 API），跳过服务端渲染可完整保留原运行假设，避免逐点做 hydration 兼容。
 */
const App = dynamic(() => import("@/App"), { ssr: false });

export default function CatchAllPage() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}
