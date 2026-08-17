import { describe, expect, it } from "vitest";
import { persistInventoryWriteSet, persistRoleChange } from "./persistenceExecutors";
import { createInventoryWriteSet, createRoleChangeAudit } from "./persistenceWrites";

function createWriter() {
  const writes: Array<{ operation: "update" | "insert"; values: unknown }> = [];
  const writer = {
    update: () => ({ set: (values: unknown) => ({ where: async () => { writes.push({ operation: "update", values }); } }) }),
    insert: () => ({ values: async (values: unknown) => { writes.push({ operation: "insert", values }); } }),
  };
  return { writer, writes };
}

describe("关键业务持久化执行", () => {
  it("库存领用会更新库存并依次写入流水和操作日志", async () => {
    const { writer, writes } = createWriter();
    await persistInventoryWriteSet(writer, createInventoryWriteSet({ partId: 4, currentStock: 10, transactionType: "outbound", quantity: 3, operatorId: 1 }));
    expect(writes).toEqual([
      { operation: "update", values: { stockQuantity: 7 } },
      { operation: "insert", values: { partId: 4, transactionType: "outbound", quantity: 3, operatorId: 1 } },
      { operation: "insert", values: expect.objectContaining({ module: "备件耗材", action: "领用", targetId: "4" }) },
    ]);
  });

  it("角色变更会同时写入用户角色和操作审计日志", async () => {
    const { writer, writes } = createWriter();
    await persistRoleChange(writer, { userId: 9, role: "admin", audit: createRoleChangeAudit({ userId: 9, adminId: 1, role: "admin" }) });
    expect(writes).toEqual([
      { operation: "update", values: { role: "admin" } },
      { operation: "insert", values: expect.objectContaining({ module: "用户权限", action: "角色变更", targetId: "9", detail: "admin" }) },
    ]);
  });
});
