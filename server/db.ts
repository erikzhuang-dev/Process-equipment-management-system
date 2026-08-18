import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  businessUnits,
  equipment,
  equipmentStatusChanges,
  faults,
  factories,
  InsertUser,
  inventoryTransactions,
  maintenancePlans,
  maintenanceWorkOrders,
  operationLogs,
  parts,
  repairWorkOrders,
  suppliers,
  users,
} from "../drizzle/schema";
import { applyStockTransaction, assertStatusTransition, calculateNextMaintenanceDate, type EquipmentStatus } from "./domainRules";
import { createInventoryWriteSet, createRoleChangeAudit } from "./persistenceWrites";
import { persistInventoryWriteSet, persistRoleChange } from "./persistenceExecutors";
import { ENV } from "./_core/env";
import { assertOwnerRoleIsRetained } from "./authorization";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("数据库连接不可用");
  return db;
}

export function extractInsertId(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  const id = Number((header as { insertId?: number | string } | undefined)?.insertId);
  if (!Number.isInteger(id) || id <= 0) throw new Error("未能获取新建记录 ID");
  return id;
}

export function resolveInsertId(result: unknown, fallbackId?: number) {
  try {
    return extractInsertId(result);
  } catch (error) {
    if (fallbackId && Number.isInteger(fallbackId) && fallbackId > 0) return fallbackId;
    throw error;
  }
}

const insertId = extractInsertId;

export function resolvePersistedUserRole(openId: string, incomingRole: InsertUser["role"] | undefined, ownerOpenId = ENV.ownerOpenId, existingRole?: InsertUser["role"] | null) {
  return openId === ownerOpenId ? "admin" : incomingRole ?? existingRole ?? "user";
}

export async function listBusinessUnits() {
  const db = requireDb(await getDb());
  return db.select().from(businessUnits);
}

export async function listFactories() {
  const db = requireDb(await getDb());
  return db.select().from(factories);
}

export async function listSuppliers() {
  const db = requireDb(await getDb());
  return db.select().from(suppliers).orderBy(suppliers.name);
}

export async function createBusinessUnit(input: { code: string; name: string; description?: string }, userId: number) {
  const db = requireDb(await getDb());
  const result = await db.insert(businessUnits).values(input).$returningId();
  const id = requireReturnedId(result[0]);
  await writeOperationLog({ userId, module: "主数据", action: "新增BU", targetType: "business_unit", targetId: String(id), detail: `${input.code} · ${input.name}` });
  return id;
}

export async function createFactory(input: { code: string; name: string; location?: string; businessUnitId?: number | null }, userId: number) {
  const db = requireDb(await getDb());
  const result = await db.insert(factories).values(input).$returningId();
  const id = requireReturnedId(result[0]);
  await writeOperationLog({ userId, module: "主数据", action: "新增工厂", targetType: "factory", targetId: String(id), detail: `${input.code} · ${input.name}` });
  return id;
}

export async function createSupplier(input: { code: string; name: string; contactName?: string; phone?: string; email?: string; address?: string }, userId: number) {
  const db = requireDb(await getDb());
  const result = await db.insert(suppliers).values(input).$returningId();
  const id = requireReturnedId(result[0]);
  await writeOperationLog({ userId, module: "主数据", action: "新增供应商", targetType: "supplier", targetId: String(id), detail: `${input.code} · ${input.name}` });
  return id;
}

export async function updateSupplier(id: number, input: Partial<{ code: string; name: string; contactName: string | null; phone: string | null; email: string | null; address: string | null }>, userId: number) {
  const db = requireDb(await getDb());
  await db.update(suppliers).set(input).where(eq(suppliers.id, id));
  await writeOperationLog({ userId, module: "主数据", action: "编辑供应商", targetType: "supplier", targetId: String(id), detail: input.name ?? input.code ?? null });
}

export async function deleteSupplier(id: number, userId: number) {
  const db = requireDb(await getDb());
  const supplier = (await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1))[0];
  if (!supplier) throw new Error("供应商不存在");
  await db.transaction(async tx => {
    await tx.update(equipment).set({ supplierId: null }).where(eq(equipment.supplierId, id));
    await tx.delete(suppliers).where(eq(suppliers.id, id));
    await tx.insert(operationLogs).values({ userId, module: "主数据", action: "删除供应商", targetType: "supplier", targetId: String(id), detail: `${supplier.code} · ${supplier.name}` });
  });
}

function requireReturnedId(result: { id: number } | undefined) {
  const id = Number(result?.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("未能获取新建记录 ID");
  return id;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const existingUser = await db.select({ role: users.role }).from(users).where(eq(users.openId, user.openId)).limit(1);
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.role = resolvePersistedUserRole(user.openId, user.role, ENV.ownerOpenId, existingUser[0]?.role);
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function writeOperationLog(input: {
  userId?: number | null;
  module: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail?: string | null;
}) {
  const db = requireDb(await getDb());
  await db.insert(operationLogs).values({
    userId: input.userId ?? null,
    module: input.module,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    detail: input.detail ?? null,
  });
}

export async function listEquipment(input: { search?: string; businessUnitId?: number; page: number; pageSize: number }) {
  const db = requireDb(await getDb());
  const search = input.search?.trim();
  const searchClause = search
    ? or(like(equipment.code, `%${search}%`), like(equipment.name, `%${search}%`), like(equipment.process, `%${search}%`))
    : undefined;
  const businessUnitClause = input.businessUnitId ? eq(equipment.businessUnitId, input.businessUnitId) : undefined;
  const whereClause = searchClause && businessUnitClause ? and(searchClause, businessUnitClause) : searchClause ?? businessUnitClause;
  const [items, totalRows] = await Promise.all([
    db.select().from(equipment).where(whereClause).orderBy(desc(equipment.updatedAt)).limit(input.pageSize).offset((input.page - 1) * input.pageSize),
    db.select({ count: sql<number>`count(*)` }).from(equipment).where(whereClause),
  ]);
  return { items, total: Number(totalRows[0]?.count ?? 0) };
}

export async function listAllEquipment() {
  const db = requireDb(await getDb());
  return db.select().from(equipment).orderBy(desc(equipment.updatedAt));
}

export async function getEquipmentById(id: number) {
  const db = requireDb(await getDb());
  return (await db.select().from(equipment).where(eq(equipment.id, id)).limit(1))[0];
}

export async function createEquipment(input: typeof equipment.$inferInsert, userId: number) {
  const db = requireDb(await getDb());
  const [created] = await db.insert(equipment).values(input).$returningId();
  const id = requireReturnedId(created);
  await writeOperationLog({ userId, module: "设备台账", action: "新增", targetType: "设备", targetId: String(id), detail: input.code });
  return id;
}

export async function updateEquipment(id: number, input: Partial<typeof equipment.$inferInsert>, userId: number) {
  const db = requireDb(await getDb());
  await db.update(equipment).set(input).where(eq(equipment.id, id));
  await writeOperationLog({ userId, module: "设备台账", action: "编辑", targetType: "设备", targetId: String(id) });
}

export async function deleteEquipment(id: number, userId: number) {
  const db = requireDb(await getDb());
  await db.delete(equipment).where(eq(equipment.id, id));
  await writeOperationLog({ userId, module: "设备台账", action: "删除", targetType: "设备", targetId: String(id) });
}

export async function importEquipment(
  rows: Array<{ code: string; name: string; model: string; specification: string; process: string; location: string; status: EquipmentStatus }>,
  userId: number,
) {
  const db = requireDb(await getDb());
  const uniqueCodes = new Set(rows.map(row => row.code));
  if (uniqueCodes.size !== rows.length) throw new Error("导入文件内存在重复的设备编号");
  const existingRows = await db.select().from(equipment);
  const existingByCode = new Map(existingRows.map(row => [row.code, row]));
  await db.transaction(async tx => {
    for (const row of rows) {
      const existing = existingByCode.get(row.code);
      if (existing) {
        await tx.update(equipment).set(row).where(eq(equipment.id, existing.id));
      } else {
        await tx.insert(equipment).values(row);
      }
    }
    await tx.insert(operationLogs).values({ userId, module: "设备台账", action: "批量导入", targetType: "设备", detail: String(rows.length) });
  });
  return { processed: rows.length };
}

export async function changeEquipmentStatus(id: number, toStatus: EquipmentStatus, userId: number) {
  const db = requireDb(await getDb());
  const current = (await db.select().from(equipment).where(eq(equipment.id, id)).limit(1))[0];
  if (!current) throw new Error("设备不存在");
  assertStatusTransition(current.status, toStatus);
  await db.transaction(async tx => {
    await tx.update(equipment).set({ status: toStatus }).where(eq(equipment.id, id));
    await tx.insert(equipmentStatusChanges).values({ equipmentId: id, fromStatus: current.status, toStatus, changedBy: userId });
    await tx.insert(operationLogs).values({ userId, module: "设备状态", action: "状态变更", targetType: "设备", targetId: String(id), detail: `${current.status} → ${toStatus}` });
  });
}

export async function getStatusHistory(equipmentId: number) {
  const db = requireDb(await getDb());
  return db.select().from(equipmentStatusChanges).where(eq(equipmentStatusChanges.equipmentId, equipmentId)).orderBy(desc(equipmentStatusChanges.changedAt));
}

export async function listMaintenanceWorkOrders() {
  const db = requireDb(await getDb());
  return db.select().from(maintenanceWorkOrders).orderBy(desc(maintenanceWorkOrders.scheduledAt));
}

export async function importMaintenanceRecords(
  rows: Array<{ equipmentCode: string; executor: string; completedAt: Date; maintenanceContent: string; notes?: string }>,
  userId: number,
) {
  const db = requireDb(await getDb());
  const equipmentRows = await db.select().from(equipment);
  const equipmentByCode = new Map(equipmentRows.map(row => [row.code, row]));
  for (const row of rows) {
    if (!equipmentByCode.has(row.equipmentCode)) throw new Error(`未找到设备编号：${row.equipmentCode}`);
  }
  await db.transaction(async tx => {
    for (const row of rows) {
      const item = equipmentByCode.get(row.equipmentCode)!;
      await tx.insert(maintenanceWorkOrders).values({
        equipmentId: item.id,
        executor: row.executor,
        status: "completed",
        scheduledAt: row.completedAt,
        completedAt: row.completedAt,
        maintenanceContent: row.maintenanceContent,
        notes: row.notes ?? null,
      });
    }
    await tx.insert(operationLogs).values({ userId, module: "保养工单", action: "批量导入", targetType: "保养记录", detail: String(rows.length) });
  });
  return { processed: rows.length };
}

export async function createMaintenancePlan(input: { equipmentId: number; cycleDays: number; maintenanceContent: string; nextScheduledAt: Date }, userId: number) {
  const db = requireDb(await getDb());
  const [createdPlan] = await db.insert(maintenancePlans).values({ ...input, isActive: true }).$returningId();
  const planId = requireReturnedId(createdPlan);
  const [createdWorkOrder] = await db.insert(maintenanceWorkOrders).values({
    equipmentId: input.equipmentId,
    planId,
    scheduledAt: input.nextScheduledAt,
    maintenanceContent: input.maintenanceContent,
  }).$returningId();
  const workOrderId = requireReturnedId(createdWorkOrder);
  await writeOperationLog({ userId, module: "保养计划", action: "新增并生成工单", targetType: "保养计划", targetId: String(planId), detail: String(workOrderId) });
  return { planId, workOrderId };
}

export async function completeMaintenanceWorkOrder(input: { workOrderId: number; executor: string; maintenanceContent: string; notes?: string }, userId: number) {
  const db = requireDb(await getDb());
  const workOrder = (await db.select().from(maintenanceWorkOrders).where(eq(maintenanceWorkOrders.id, input.workOrderId)).limit(1))[0];
  if (!workOrder) throw new Error("保养工单不存在");
  if (!workOrder.planId) throw new Error("该历史保养记录未关联周期性计划，不能生成下期工单");
  const plan = (await db.select().from(maintenancePlans).where(eq(maintenancePlans.id, workOrder.planId)).limit(1))[0];
  if (!plan) throw new Error("关联保养计划不存在");
  const completedAt = new Date();
  const nextScheduledAt = calculateNextMaintenanceDate(completedAt, plan.cycleDays);
  await db.transaction(async tx => {
    await tx.update(maintenanceWorkOrders).set({ executor: input.executor, status: "completed", completedAt, maintenanceContent: input.maintenanceContent, notes: input.notes ?? null }).where(eq(maintenanceWorkOrders.id, input.workOrderId));
    await tx.update(maintenancePlans).set({ nextScheduledAt }).where(eq(maintenancePlans.id, plan.id));
    await tx.insert(maintenanceWorkOrders).values({ equipmentId: plan.equipmentId, planId: plan.id, scheduledAt: nextScheduledAt, maintenanceContent: plan.maintenanceContent });
    await tx.insert(operationLogs).values({ userId, module: "保养工单", action: "完成并生成下期工单", targetType: "保养工单", targetId: String(input.workOrderId) });
  });
}

export async function listFaults() {
  const db = requireDb(await getDb());
  return db.select().from(faults).orderBy(desc(faults.discoveredAt));
}

export async function createFault(input: { equipmentId: number; description: string; discoveredAt: Date; severity: "low" | "medium" | "high" | "critical" }, userId: number) {
  const db = requireDb(await getDb());
  const [created] = await db.insert(faults).values(input).$returningId();
  const id = requireReturnedId(created);
  await writeOperationLog({ userId, module: "故障报修", action: "登记", targetType: "故障", targetId: String(id), detail: input.severity });
  return id;
}

export async function listRepairWorkOrders() {
  const db = requireDb(await getDb());
  return db.select().from(repairWorkOrders).orderBy(desc(repairWorkOrders.createdAt));
}

export async function importRepairRecords(
  rows: Array<{ equipmentCode: string; technician: string; repairContent: string; repairCost: string; completedAt: Date }>,
  userId: number,
) {
  const db = requireDb(await getDb());
  const equipmentRows = await db.select().from(equipment);
  const equipmentByCode = new Map(equipmentRows.map(row => [row.code, row]));
  for (const row of rows) {
    if (!equipmentByCode.has(row.equipmentCode)) throw new Error(`未找到设备编号：${row.equipmentCode}`);
  }
  await db.transaction(async tx => {
    for (const row of rows) {
      const item = equipmentByCode.get(row.equipmentCode)!;
      await tx.insert(repairWorkOrders).values({
        equipmentId: item.id,
        technician: row.technician,
        repairContent: row.repairContent,
        repairCost: row.repairCost,
        status: "completed",
        completedAt: row.completedAt,
      });
    }
    await tx.insert(operationLogs).values({ userId, module: "维修工单", action: "批量导入", targetType: "维修记录", detail: String(rows.length) });
  });
  return { processed: rows.length };
}

export async function createRepairWorkOrder(input: { faultId: number; equipmentId: number; technician?: string; repairContent?: string }, userId: number) {
  const db = requireDb(await getDb());
  const [created] = await db.insert(repairWorkOrders).values(input).$returningId();
  const id = requireReturnedId(created);
  await db.update(faults).set({ status: "in_repair" }).where(eq(faults.id, input.faultId));
  await writeOperationLog({ userId, module: "维修工单", action: "创建", targetType: "维修工单", targetId: String(id) });
  return id;
}

export async function completeRepairWorkOrder(input: { workOrderId: number; technician: string; repairContent: string; repairCost: string }, userId: number) {
  const db = requireDb(await getDb());
  const order = (await db.select().from(repairWorkOrders).where(eq(repairWorkOrders.id, input.workOrderId)).limit(1))[0];
  if (!order) throw new Error("维修工单不存在");
  const completedAt = new Date();
  await db.transaction(async tx => {
    await tx.update(repairWorkOrders).set({ technician: input.technician, repairContent: input.repairContent, repairCost: input.repairCost, status: "completed", completedAt }).where(eq(repairWorkOrders.id, input.workOrderId));
    if (order.faultId) {
      await tx.update(faults).set({ status: "closed" }).where(eq(faults.id, order.faultId));
    }
    await tx.insert(operationLogs).values({ userId, module: "维修工单", action: "完成", targetType: "维修工单", targetId: String(input.workOrderId), detail: input.repairCost });
  });
}

export async function listParts() {
  const db = requireDb(await getDb());
  return db.select().from(parts).orderBy(desc(parts.updatedAt));
}

export async function listInventoryTransactions() {
  const db = requireDb(await getDb());
  return db.select().from(inventoryTransactions).orderBy(desc(inventoryTransactions.operatedAt)).limit(100);
}

export async function createPart(input: { name: string; specification: string; stockQuantity: number; safetyStock: number }, userId: number) {
  const db = requireDb(await getDb());
  const [created] = await db.insert(parts).values(input).$returningId();
  const id = requireReturnedId(created);
  await writeOperationLog({ userId, module: "备件耗材", action: "新增", targetType: "备件", targetId: String(id) });
  return id;
}

export async function recordInventoryTransaction(input: { partId: number; transactionType: "inbound" | "outbound"; quantity: number }, userId: number) {
  const db = requireDb(await getDb());
  const part = (await db.select().from(parts).where(eq(parts.id, input.partId)).limit(1))[0];
  if (!part) throw new Error("备件不存在");
  const writeSet = createInventoryWriteSet({ ...input, currentStock: part.stockQuantity, operatorId: userId });
  await db.transaction(async tx => {
    await persistInventoryWriteSet(tx, writeSet);
  });
}

export async function listOperationLogs() {
  const db = requireDb(await getDb());
  return db.select().from(operationLogs).orderBy(desc(operationLogs.createdAt)).limit(100);
}

export async function listUsers() {
  const db = requireDb(await getDb());
  return db.select().from(users).orderBy(desc(users.lastSignedIn));
}

export async function updateUserRole(id: number, role: "admin" | "user", adminId: number) {
  const db = requireDb(await getDb());
  const targetUser = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  if (!targetUser) throw new Error("用户不存在");
  assertOwnerRoleIsRetained({ targetOpenId: targetUser.openId, ownerOpenId: ENV.ownerOpenId, nextRole: role });
  const audit = createRoleChangeAudit({ userId: id, adminId, role });
  await db.transaction(async tx => {
    await persistRoleChange(tx, { userId: id, role, audit });
  });
}

export async function getDashboardMetrics() {
  const db = requireDb(await getDb());
  const [equipmentRows, faultRows, maintenanceRows, repairRows, partRows] = await Promise.all([
    db.select().from(equipment),
    db.select().from(faults),
    db.select().from(maintenanceWorkOrders),
    db.select().from(repairWorkOrders),
    db.select().from(parts),
  ]);
  const total = equipmentRows.length;
  const running = equipmentRows.filter(item => item.status === "running").length;
  const openFaults = faultRows.filter(item => item.status !== "closed").length;
  const completedMaintenance = maintenanceRows.filter(item => item.status === "completed").length;
  return {
    totalEquipment: total,
    onlineRate: total ? Math.round((running / total) * 1000) / 10 : 0,
    faultRate: total ? Math.round((openFaults / total) * 1000) / 10 : 0,
    maintenanceCompletionRate: maintenanceRows.length ? Math.round((completedMaintenance / maintenanceRows.length) * 1000) / 10 : 0,
    openFaults,
    completedRepairs: repairRows.filter(item => item.status === "completed").length,
    lowStockParts: partRows.filter(item => item.stockQuantity <= item.safetyStock).length,
  };
}
