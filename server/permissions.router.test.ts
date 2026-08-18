import { describe, expect, it, vi } from "vitest";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    listBusinessUnits: vi.fn(async () => [{ id: 1, code: "BU1", name: "设备运营" }]),
    listFactories: vi.fn(async () => [{ id: 7, code: "F01", name: "一号工厂", businessUnitId: 1 }]),
    listSuppliers: vi.fn(async () => [{ id: 12, code: "SUP-001", name: "供应商甲" }]),
    createSupplier: vi.fn(async () => 12),
    updateSupplier: vi.fn(async () => undefined),
    deleteSupplier: vi.fn(async () => undefined),
  };
});

import { appRouter } from "./routers";
import { createSupplier, deleteSupplier, updateSupplier } from "./db";
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

function createAdminContext(): TrpcContext {
  return {
    ...createStandardUserContext(),
    user: { ...createStandardUserContext().user!, id: 1, openId: "admin-user", role: "admin" },
  };
}

describe("管理员权限路由", () => {
  it("拒绝普通用户读取用户权限与操作日志", async () => {
    const caller = appRouter.createCaller(createStandardUserContext());
    await expect(caller.operations.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.operations.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("允许普通用户读取设备 BU、工厂与供应商名称", async () => {
    const caller = appRouter.createCaller(createStandardUserContext());

    await expect(caller.equipment.masterData()).resolves.toEqual({
      businessUnits: [{ id: 1, code: "BU1", name: "设备运营" }],
      factories: [{ id: 7, code: "F01", name: "一号工厂", businessUnitId: 1 }],
      suppliers: [{ id: 12, code: "SUP-001", name: "供应商甲" }],
    });
  });

  it("允许管理员创建供应商主数据", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.operations.createSupplier({ code: "SUP-001", name: "供应商甲", contactName: "张工" })).resolves.toBe(12);
    expect(createSupplier).toHaveBeenCalledWith({ code: "SUP-001", name: "供应商甲", contactName: "张工" }, 1);
  });

  it("允许管理员编辑和删除供应商主数据", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(caller.operations.updateSupplier({ id: 12, values: { name: "供应商乙", phone: "13800000000" } })).resolves.toBeUndefined();
    await expect(caller.operations.deleteSupplier({ id: 12 })).resolves.toBeUndefined();
    expect(updateSupplier).toHaveBeenCalledWith(12, { name: "供应商乙", phone: "13800000000" }, 1);
    expect(deleteSupplier).toHaveBeenCalledWith(12, 1);
  });
});
