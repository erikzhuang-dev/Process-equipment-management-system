import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createContext } from "@server/_core/context";
import { appRouter } from "@server/routers";

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });
}

export { handler as GET, handler as POST };
