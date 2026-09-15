import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "../../drizzle/schema";
import { getApplyUserById, getPublicAdministrator } from "../db";
import type { ActingIdentity } from "../applyAuthorization";
import { sdk } from "./sdk";

/**
 * Next.js fetch 版 tRPC 上下文。
 * 原 Express 版（CreateExpressContextOptions）已随迁移改为 Request/Headers 语义。
 *
 * 申请域身份：前端通过 `X-Acting-User-Id` 头携带当前操作身份（apply_users.id），
 * 服务端解析为 actingUser；接入平台 OAuth 后由会话用户映射替代，业务代码零改动。
 */
export type TrpcContext = {
  req: Request;
  user: User | null;
  actingUser: ActingIdentity | null;
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

  let actingUser: ActingIdentity | null = null;
  const actingUserId = Number(opts.req.headers.get("x-acting-user-id") ?? "");
  if (Number.isInteger(actingUserId) && actingUserId > 0) {
    try {
      const applyUser = await getApplyUserById(actingUserId);
      if (applyUser && applyUser.isActive) {
        actingUser = { id: applyUser.id, name: applyUser.name, roleKey: applyUser.roleKey };
      }
    } catch (error) {
      actingUser = null;
    }
  }

  return {
    req: opts.req,
    user,
    actingUser,
  };
}
