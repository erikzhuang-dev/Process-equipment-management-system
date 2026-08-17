import { applyStockTransaction } from "./domainRules";

export function createInventoryWriteSet(input: {
  partId: number;
  currentStock: number;
  transactionType: "inbound" | "outbound";
  quantity: number;
  operatorId: number;
}) {
  const nextStock = applyStockTransaction(input.currentStock, input.quantity, input.transactionType);
  return {
    nextStock,
    transaction: {
      partId: input.partId,
      transactionType: input.transactionType,
      quantity: input.quantity,
      operatorId: input.operatorId,
    },
    audit: {
      userId: input.operatorId,
      module: "备件耗材",
      action: input.transactionType === "inbound" ? "入库" : "领用",
      targetType: "备件",
      targetId: String(input.partId),
      detail: String(input.quantity),
    },
  };
}

export function createRoleChangeAudit(input: { userId: number; adminId: number; role: "admin" | "user" }) {
  return {
    userId: input.adminId,
    module: "用户权限",
    action: "角色变更",
    targetType: "用户",
    targetId: String(input.userId),
    detail: input.role,
  };
}
