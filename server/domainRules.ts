export const equipmentStatuses = ["running", "stopped", "maintenance", "scrapped"] as const;
export type EquipmentStatus = (typeof equipmentStatuses)[number];

const allowedStatusTransitions: Record<EquipmentStatus, EquipmentStatus[]> = {
  running: ["stopped", "maintenance", "scrapped"],
  stopped: ["running", "maintenance", "scrapped"],
  maintenance: ["running", "stopped", "scrapped"],
  scrapped: [],
};

export function assertStatusTransition(from: EquipmentStatus, to: EquipmentStatus) {
  if (from === to) return;
  if (!allowedStatusTransitions[from].includes(to)) {
    throw new Error(`不允许从“${from}”变更为“${to}”`);
  }
}

export function applyStockTransaction(
  currentStock: number,
  quantity: number,
  transactionType: "inbound" | "outbound",
) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("出入库数量必须为正整数");
  }
  const nextStock = transactionType === "inbound" ? currentStock + quantity : currentStock - quantity;
  if (nextStock < 0) {
    throw new Error("库存不足，无法完成领用");
  }
  return nextStock;
}

export function calculateNextMaintenanceDate(baseDate: Date, cycleDays: number) {
  if (!Number.isInteger(cycleDays) || cycleDays <= 0) {
    throw new Error("保养周期必须为正整数天数");
  }
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + cycleDays);
  return nextDate;
}

export function calculateRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}
