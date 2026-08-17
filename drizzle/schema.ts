import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const equipment = mysqlTable(
  "equipment",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    specification: varchar("specification", { length: 200 }).notNull(),
    process: varchar("process", { length: 120 }).notNull(),
    location: varchar("location", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["running", "stopped", "maintenance", "scrapped"])
      .default("running")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("equipment_code_unique").on(table.code),
    index("equipment_status_index").on(table.status),
  ],
);

export const equipmentStatusChanges = mysqlTable(
  "equipment_status_changes",
  {
    id: int("id").autoincrement().primaryKey(),
    equipmentId: int("equipmentId").notNull(),
    fromStatus: mysqlEnum("fromStatus", ["running", "stopped", "maintenance", "scrapped"]),
    toStatus: mysqlEnum("toStatus", ["running", "stopped", "maintenance", "scrapped"]).notNull(),
    changedBy: int("changedBy"),
    changedAt: timestamp("changedAt").defaultNow().notNull(),
  },
  table => [index("status_change_equipment_index").on(table.equipmentId)],
);

export const maintenancePlans = mysqlTable(
  "maintenance_plans",
  {
    id: int("id").autoincrement().primaryKey(),
    equipmentId: int("equipmentId").notNull(),
    cycleDays: int("cycleDays").notNull(),
    maintenanceContent: text("maintenanceContent").notNull(),
    nextScheduledAt: timestamp("nextScheduledAt").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("maintenance_plan_equipment_index").on(table.equipmentId)],
);

export const maintenanceWorkOrders = mysqlTable(
  "maintenance_work_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    equipmentId: int("equipmentId").notNull(),
    planId: int("planId"),
    executor: varchar("executor", { length: 120 }),
    status: mysqlEnum("status", ["pending", "in_progress", "completed"]).default("pending").notNull(),
    scheduledAt: timestamp("scheduledAt").notNull(),
    completedAt: timestamp("completedAt"),
    maintenanceContent: text("maintenanceContent").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("maintenance_work_order_equipment_index").on(table.equipmentId),
    index("maintenance_work_order_plan_index").on(table.planId),
  ],
);

export const faults = mysqlTable(
  "faults",
  {
    id: int("id").autoincrement().primaryKey(),
    equipmentId: int("equipmentId").notNull(),
    description: text("description").notNull(),
    discoveredAt: timestamp("discoveredAt").notNull(),
    severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
    status: mysqlEnum("status", ["open", "in_repair", "closed"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("fault_equipment_index").on(table.equipmentId)],
);

export const repairWorkOrders = mysqlTable(
  "repair_work_orders",
  {
    id: int("id").autoincrement().primaryKey(),
    faultId: int("faultId"),
    equipmentId: int("equipmentId").notNull(),
    technician: varchar("technician", { length: 120 }),
    repairContent: text("repairContent"),
    repairCost: decimal("repairCost", { precision: 12, scale: 2 }).default("0").notNull(),
    status: mysqlEnum("status", ["pending", "in_progress", "completed"]).default("pending").notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("repair_work_order_fault_index").on(table.faultId),
    index("repair_work_order_equipment_index").on(table.equipmentId),
  ],
);

export const parts = mysqlTable(
  "parts",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    specification: varchar("specification", { length: 200 }).notNull(),
    stockQuantity: int("stockQuantity").default(0).notNull(),
    safetyStock: int("safetyStock").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("parts_name_index").on(table.name)],
);

export const inventoryTransactions = mysqlTable(
  "inventory_transactions",
  {
    id: int("id").autoincrement().primaryKey(),
    partId: int("partId").notNull(),
    transactionType: mysqlEnum("transactionType", ["inbound", "outbound"]).notNull(),
    quantity: int("quantity").notNull(),
    operatorId: int("operatorId"),
    operatedAt: timestamp("operatedAt").defaultNow().notNull(),
  },
  table => [index("inventory_transaction_part_index").on(table.partId)],
);

export const operationLogs = mysqlTable(
  "operation_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    module: varchar("module", { length: 80 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    targetType: varchar("targetType", { length: 80 }).notNull(),
    targetId: varchar("targetId", { length: 64 }),
    detail: text("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("operation_log_created_index").on(table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Equipment = typeof equipment.$inferSelect;
export type Part = typeof parts.$inferSelect;
