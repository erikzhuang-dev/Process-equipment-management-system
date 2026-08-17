import { describe, expect, it } from "vitest";
import { createInventoryWriteSet, createRoleChangeAudit } from "./persistenceWrites";

describe("备件出入库持久化写入", () => {
  it("构造领用后的库存更新、流水行与审计行", () => {
    const writeSet = createInventoryWriteSet({ partId: 12, currentStock: 16, transactionType: "outbound", quantity: 5, operatorId: 7 });
    expect(writeSet.nextStock).toBe(11);
    expect(writeSet.transaction).toEqual({ partId: 12, transactionType: "outbound", quantity: 5, operatorId: 7 });
    expect(writeSet.audit).toMatchObject({ module: "备件耗材", action: "领用", targetType: "备件", targetId: "12", detail: "5" });
  });
});

describe("角色变更审计写入", () => {
  it("将管理员、目标用户和变更后的角色写入同一审计记录", () => {
    expect(createRoleChangeAudit({ userId: 9, adminId: 1, role: "admin" })).toEqual({
      userId: 1,
      module: "用户权限",
      action: "角色变更",
      targetType: "用户",
      targetId: "9",
      detail: "admin",
    });
  });
});
