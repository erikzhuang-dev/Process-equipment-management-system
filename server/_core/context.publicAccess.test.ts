import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getPublicAdministrator: vi.fn(),
}));

vi.mock("./sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("../db", () => ({ getPublicAdministrator: mocks.getPublicAdministrator }));

import { createContext } from "./context";

const publicAdministrator = {
  id: 91,
  openId: "public-admin-workstation",
  name: "公开管理员工作站",
  email: null,
  loginMethod: "public-access",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("公开管理员上下文", () => {
  beforeEach(() => vi.clearAllMocks());

  it("未携带登录会话时使用可审计的公开管理员身份", async () => {
    mocks.authenticateRequest.mockRejectedValue(new Error("no session"));
    mocks.getPublicAdministrator.mockResolvedValue(publicAdministrator);
    const ctx = await createContext({ req: {} as never, res: {} as never });
    expect(ctx.user).toEqual(publicAdministrator);
    expect(mocks.getPublicAdministrator).toHaveBeenCalledOnce();
  });

  it("已有有效登录会话时保留原身份", async () => {
    const signedInUser = { ...publicAdministrator, id: 7, openId: "signed-in-admin", name: "Existing Admin" };
    mocks.authenticateRequest.mockResolvedValue(signedInUser);
    const ctx = await createContext({ req: {} as never, res: {} as never });
    expect(ctx.user).toEqual(signedInUser);
    expect(mocks.getPublicAdministrator).not.toHaveBeenCalled();
  });
});
