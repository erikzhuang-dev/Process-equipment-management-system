"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { IdentityProvider } from "@/contexts/IdentityContext";

/**
 * 原项目 main.tsx 的 Provider 层平移（Next 版）：
 * tRPC client + React Query。语言/主题 Provider 在 App.tsx 内部自持。
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5_000, refetchOnWindowFocus: false },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          headers() {
            // 申请域身份（X-Acting-User-Id）：由顶栏身份切换器写入 localStorage。
            // 接入平台 OAuth 后此处可移除，后端将回退为会话用户映射。
            return { "x-acting-user-id": window.localStorage.getItem("pems-acting-user") ?? "" };
          },
          fetch(input, init) {
            return globalThis.fetch(input, {
              ...(init ?? {}),
              credentials: "include",
            });
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <IdentityProvider>{children}</IdentityProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
