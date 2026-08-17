import { appRouter } from "../server/routers.ts";
import { getDb } from "../server/db.ts";
import { equipment } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();
if (!db) throw new Error("数据库连接不可用，无法执行真实业务闭环核验");

const admin = {
  id: 1,
  openId: "qa-admin",
  name: "QA 管理员",
  email: "qa@example.com",
  loginMethod: "qa",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const ctx = {
  user: admin,
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => undefined },
};

const caller = appRouter.createCaller(ctx);
const qaEquipment = (await db.select().from(equipment).where(eq(equipment.code, "QA-PEM-001")).limit(1))[0];
if (!qaEquipment) throw new Error("未找到 QA-PEM-001，无法执行闭环核验");

await caller.equipment.changeStatus({ id: qaEquipment.id, status: "maintenance" });
await caller.equipment.changeStatus({ id: qaEquipment.id, status: "running" });
const statusHistory = await caller.equipment.statusHistory({ equipmentId: qaEquipment.id });

const plan = await caller.maintenance.createPlan({
  equipmentId: qaEquipment.id,
  cycleDays: 30,
  maintenanceContent: "QA 周期保养核验",
  nextScheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});
await caller.maintenance.complete({
  workOrderId: plan.workOrderId,
  executor: "QA 执行人",
  maintenanceContent: "QA 周期保养核验",
  notes: "真实闭环核验记录",
});

const faultId = await caller.repairs.createFault({
  equipmentId: qaEquipment.id,
  description: "QA 故障闭环核验",
  discoveredAt: new Date(),
  severity: "low",
});
const repairId = await caller.repairs.create({
  faultId,
  equipmentId: qaEquipment.id,
  technician: "QA 维修员",
  repairContent: "QA 维修内容",
});
await caller.repairs.complete({
  workOrderId: repairId,
  technician: "QA 维修员",
  repairContent: "QA 维修内容",
  repairCost: "12.50",
});

const partId = await caller.parts.create({
  name: `QA 备件 ${Date.now()}`,
  specification: "QA-SPEC-01",
  stockQuantity: 0,
  safetyStock: 1,
});
await caller.parts.recordTransaction({ partId, transactionType: "inbound", quantity: 5 });
await caller.parts.recordTransaction({ partId, transactionType: "outbound", quantity: 2 });

const [maintenance, repairs, parts, transactions, logs] = await Promise.all([
  caller.maintenance.list(),
  caller.repairs.list(),
  caller.parts.list(),
  caller.parts.transactions(),
  caller.operations.list(),
]);
const verifiedPart = parts.find(item => item.id === partId);
const verification = {
  equipmentId: qaEquipment.id,
  statusHistoryCount: statusHistory.length,
  maintenancePlanId: plan.planId,
  maintenanceWorkOrderCount: maintenance.filter(item => item.planId === plan.planId).length,
  repairWorkOrderId: repairId,
  repairCompleted: repairs.some(item => item.id === repairId && item.status === "completed"),
  partId,
  finalPartStock: verifiedPart?.stockQuantity,
  inventoryTransactionCount: transactions.filter(item => item.partId === partId).length,
  relatedAuditCount: logs.filter(item => item.targetId === String(qaEquipment.id) || item.targetId === String(partId) || item.targetId === String(repairId)).length,
};

if (verification.statusHistoryCount < 2) throw new Error("设备状态历史未完整写入");
if (verification.maintenanceWorkOrderCount < 2) throw new Error("保养完成后未生成下一周期工单");
if (!verification.repairCompleted) throw new Error("维修工单未完成闭环");
if (verification.finalPartStock !== 3 || verification.inventoryTransactionCount !== 2) throw new Error("备件出入库流水或库存结果异常");
if (verification.relatedAuditCount < 5) throw new Error("操作日志写入数量不足");

console.log(JSON.stringify(verification, null, 2));
