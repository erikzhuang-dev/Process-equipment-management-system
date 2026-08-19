import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getPublicAdministrator } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }

  // The system is intentionally configured as an unauthenticated internal workstation.
  // SDK authentication returns null in some no-session cases and throws in others.
  // Both cases must execute under a dedicated, auditable administrator account.
  if (!user) user = (await getPublicAdministrator()) ?? null;

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
