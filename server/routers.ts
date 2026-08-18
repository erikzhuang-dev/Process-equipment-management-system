import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import {
  changeEquipmentStatus,
  completeMaintenanceWorkOrder,
  completeRepairWorkOrder,
  createEquipment,
  createFault,
  createMaintenancePlan,
  createPart,
  createRepairWorkOrder,
  deleteEquipment,
  getEquipmentById,
  getDashboardMetrics,
  getStatusHistory,
  importEquipment,
  importMaintenanceRecords,
  importRepairRecords,
  listAllEquipment,
  listEquipment,
  listFaults,
  listMaintenanceWorkOrders,
  listOperationLogs,
  listInventoryTransactions,
  listParts,
  listRepairWorkOrders,
  recordInventoryTransaction,
  listUsers,
  updateUserRole,
  updateEquipment,
  listBusinessUnits,
  listFactories,
  listSuppliers,
  createBusinessUnit,
  createFactory,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "./db";
import { assertAdminRole } from "./authorization";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const equipmentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  model: z.string().min(1),
  specification: z.string().min(1),
  process: z.string().min(1),
  location: z.string().min(1),
  status: z.enum(["running", "stopped", "maintenance", "scrapped"]).default("running"),
  supplier: z.string().max(160).optional(),
  supplierId: z.coerce.number().int().positive().nullable().optional(),
  businessUnitId: z.coerce.number().int().positive().nullable().optional(),
  factoryId: z.coerce.number().int().positive().nullable().optional(),
  hourlyCapacity: z.coerce.number().int().min(0).nullable().optional(),
  oee: z.coerce.number().min(0).max(1).nullable().optional(),
  lowOeeReason: z.string().max(2000).optional(),
  energyConsumption: z.coerce.number().min(0).nullable().optional(),
  quantity: z.coerce.number().int().min(0).nullable().optional(),
  unitPrice: z.coerce.number().min(0).nullable().optional(),
  depreciationYears: z.coerce.number().int().min(0).nullable().optional(),
  lossFactor: z.coerce.number().min(0).nullable().optional(),
  investmentIncluded: z.boolean().nullable().optional(),
  notes: z.string().max(4000).optional(),
});

function toEquipmentDbValues(input: z.infer<typeof equipmentSchema>) {
  return {
    ...input,
    oee: input.oee === undefined ? undefined : input.oee === null ? null : String(input.oee),
    energyConsumption: input.energyConsumption === undefined ? undefined : input.energyConsumption === null ? null : String(input.energyConsumption),
    unitPrice: input.unitPrice === undefined ? undefined : input.unitPrice === null ? null : String(input.unitPrice),
    lossFactor: input.lossFactor === undefined ? undefined : input.lossFactor === null ? null : String(input.lossFactor),
  };
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  try {
    assertAdminRole(ctx.user.role);
  } catch {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可执行此操作" });
  }
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  dashboard: router({
    metrics: protectedProcedure.query(() => getDashboardMetrics()),
  }),
  equipment: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), businessUnitId: z.number().int().positive().optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(10) })).query(({ input }) => listEquipment(input)),
    export: protectedProcedure.query(() => listAllEquipment()),
    detail: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => getEquipmentById(input.id)),
    masterData: protectedProcedure.query(async () => ({
      businessUnits: await listBusinessUnits(),
      factories: await listFactories(),
      suppliers: await listSuppliers(),
    })),
    create: adminProcedure.input(equipmentSchema).mutation(({ input, ctx }) => createEquipment(toEquipmentDbValues(input), ctx.user.id)),
    batchImport: adminProcedure.input(z.array(equipmentSchema).min(1)).mutation(({ input, ctx }) => importEquipment(input.map(toEquipmentDbValues), ctx.user.id)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), values: equipmentSchema.partial() })).mutation(({ input, ctx }) => updateEquipment(input.id, toEquipmentDbValues(input.values as z.infer<typeof equipmentSchema>), ctx.user.id)),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => deleteEquipment(input.id, ctx.user.id)),
    changeStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["running", "stopped", "maintenance", "scrapped"]) })).mutation(({ input, ctx }) => changeEquipmentStatus(input.id, input.status, ctx.user.id)),
    statusHistory: protectedProcedure.input(z.object({ equipmentId: z.number().int().positive() })).query(({ input }) => getStatusHistory(input.equipmentId)),
  }),
  maintenance: router({
    list: protectedProcedure.query(() => listMaintenanceWorkOrders()),
    batchImport: adminProcedure.input(z.array(z.object({ equipmentCode: z.string().min(1), executor: z.string().min(1), completedAt: z.date(), maintenanceContent: z.string().min(1), notes: z.string().optional() })).min(1)).mutation(({ input, ctx }) => importMaintenanceRecords(input, ctx.user.id)),
    createPlan: adminProcedure.input(z.object({ equipmentId: z.number().int().positive(), cycleDays: z.number().int().positive(), maintenanceContent: z.string().min(1), nextScheduledAt: z.date() })).mutation(({ input, ctx }) => createMaintenancePlan(input, ctx.user.id)),
    complete: protectedProcedure.input(z.object({ workOrderId: z.number().int().positive(), executor: z.string().min(1), maintenanceContent: z.string().min(1), notes: z.string().optional() })).mutation(({ input, ctx }) => completeMaintenanceWorkOrder(input, ctx.user.id)),
  }),
  repairs: router({
    faults: protectedProcedure.query(() => listFaults()),
    createFault: protectedProcedure.input(z.object({ equipmentId: z.number().int().positive(), description: z.string().min(1), discoveredAt: z.date(), severity: z.enum(["low", "medium", "high", "critical"]) })).mutation(({ input, ctx }) => createFault(input, ctx.user.id)),
    list: protectedProcedure.query(() => listRepairWorkOrders()),
    batchImport: adminProcedure.input(z.array(z.object({ equipmentCode: z.string().min(1), technician: z.string().min(1), repairContent: z.string().min(1), repairCost: z.string().regex(/^\d+(\.\d{1,2})?$/), completedAt: z.date() })).min(1)).mutation(({ input, ctx }) => importRepairRecords(input, ctx.user.id)),
    create: protectedProcedure.input(z.object({ faultId: z.number().int().positive(), equipmentId: z.number().int().positive(), technician: z.string().optional(), repairContent: z.string().optional() })).mutation(({ input, ctx }) => createRepairWorkOrder(input, ctx.user.id)),
    complete: protectedProcedure.input(z.object({ workOrderId: z.number().int().positive(), technician: z.string().min(1), repairContent: z.string().min(1), repairCost: z.string().regex(/^\d+(\.\d{1,2})?$/) })).mutation(({ input, ctx }) => completeRepairWorkOrder(input, ctx.user.id)),
  }),
  parts: router({
    list: protectedProcedure.query(() => listParts()),
    transactions: protectedProcedure.query(() => listInventoryTransactions()),
    create: adminProcedure.input(z.object({ name: z.string().min(1), specification: z.string().min(1), stockQuantity: z.number().int().min(0), safetyStock: z.number().int().min(0) })).mutation(({ input, ctx }) => createPart(input, ctx.user.id)),
    recordTransaction: protectedProcedure.input(z.object({ partId: z.number().int().positive(), transactionType: z.enum(["inbound", "outbound"]), quantity: z.number().int().positive() })).mutation(({ input, ctx }) => recordInventoryTransaction(input, ctx.user.id)),
  }),
  operations: router({
    list: adminProcedure.query(() => listOperationLogs()),
    users: adminProcedure.query(() => listUsers()),
    updateUserRole: adminProcedure.input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "user"]) })).mutation(({ input, ctx }) => updateUserRole(input.id, input.role, ctx.user.id)),
    businessUnits: adminProcedure.query(() => listBusinessUnits()),
    factories: adminProcedure.query(() => listFactories()),
    suppliers: adminProcedure.query(() => listSuppliers()),
    createBusinessUnit: adminProcedure.input(z.object({ code: z.string().min(1).max(32), name: z.string().min(1).max(120), description: z.string().max(300).optional() })).mutation(({ input, ctx }) => createBusinessUnit(input, ctx.user.id)),
    createFactory: adminProcedure.input(z.object({ code: z.string().min(1).max(32), name: z.string().min(1).max(120), location: z.string().max(160).optional(), businessUnitId: z.number().int().positive().nullable().optional() })).mutation(({ input, ctx }) => createFactory(input, ctx.user.id)),
    createSupplier: adminProcedure.input(z.object({ code: z.string().min(1).max(32), name: z.string().min(1).max(160), contactName: z.string().max(120).optional(), phone: z.string().max(64).optional(), email: z.string().email().max(160).optional(), address: z.string().max(300).optional() })).mutation(({ input, ctx }) => createSupplier(input, ctx.user.id)),
    updateSupplier: adminProcedure.input(z.object({ id: z.number().int().positive(), values: z.object({ code: z.string().min(1).max(32).optional(), name: z.string().min(1).max(160).optional(), contactName: z.string().max(120).nullable().optional(), phone: z.string().max(64).nullable().optional(), email: z.string().email().max(160).nullable().optional(), address: z.string().max(300).nullable().optional() }) })).mutation(({ input, ctx }) => updateSupplier(input.id, input.values, ctx.user.id)),
    deleteSupplier: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => deleteSupplier(input.id, ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
