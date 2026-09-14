import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "@server/_core/context";
import { appRouter } from "@server/routers";

// tRPC 数据必须实时读写，禁止 Next 对 GET 查询做静态缓存
export const dynamic = "force-dynamic";
export const revalidate = 0;

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });
}

export { handler as GET, handler as POST };
