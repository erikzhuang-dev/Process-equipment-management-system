import { describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listBusinessUnits: vi.fn(async () => [{ id: 1, code: "BU1", name: "设备运营" }]),
    listFactories: vi.fn(async () => [{ id: 7, code: "F01", name: "一号工厂", businessUnitId: 1 }]),
  };
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createStandardUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "standard-user",
      name: "普通用户",
      email: "user@example.com",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("管理员权限路由", () => {
  it("拒绝普通用户读取用户权限与操作日志", async () => {
    const caller = appRouter.createCaller(createStandardUserContext());
    await expect(caller.operations.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("允许普通用户读取设备 BU 与工厂名称", async () => {
    const caller = appRouter.createCaller(createStandardUserContext());

    await expect(caller.equipment.masterData()).resolves.toEqual({
      businessUnits: [{ id: 1, code: "BU1", name: "设备运营" }],
      factories: [{ id: 7, code: "F01", name: "一号工厂", businessUnitId: 1 }],
    });
  });
});
