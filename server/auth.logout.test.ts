import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * Next.js 迁移说明：logout 原实现通过 ctx.res.clearCookie 清理会话 cookie；
 * 迁移后（fetch context，公共管理员兜底模式下无真实会话 cookie）logout 为
 * no-op，本测试相应收敛为"返回成功"断言。
 */
function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: new Request("https://localhost/api/trpc"),
    actingUser: null,
  };
}

describe("auth.logout", () => {
  it("reports success without a session cookie to clear", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
  });
});
