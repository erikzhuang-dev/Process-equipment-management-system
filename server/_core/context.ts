import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { getPublicAdministrator } from "../db";
import { sdk } from "./sdk";

/**
 * Next.js fetch 版 tRPC 上下文。
 * 原 Express 版（CreateExpressContextOptions）已随迁移改为 Request/Headers 语义。
 */
export type TrpcContext = {
  req: Request;
  user: User | null;
};

export async function createContext(
  opts: FetchCreateContextFnOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req.headers);
  } catch (error) {
    user = null;
  }

  // The system is intentionally configured as an unauthenticated internal workstation.
  // SDK authentication returns null in some no-session cases and throws in others.
  // Both cases must execute under a dedicated, auditable administrator account.
  if (!user) user = (await getPublicAdministrator()) ?? null;

  return {
    req: opts.req,
    user,
  };
}
