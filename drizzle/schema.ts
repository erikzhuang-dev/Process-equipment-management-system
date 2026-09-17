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

export const businessUnits = mysqlTable("business_units", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const factories = mysqlTable("factories", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  location: varchar("location", { length: 160 }),
  businessUnitId: int("businessUnitId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  contactName: varchar("contactName", { length: 120 }),
  phone: varchar("phone", { length: 64 }),
  email: varchar("email", { length: 160 }),
  address: varchar("address", { length: 300 }),
  licenseNo: varchar("licenseNo", { length: 120 }),
  qualifications: text("qualifications"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("supplier_name_index").on(table.name)]);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    imageUrl: varchar("imageUrl", { length: 500 }),
    description: varchar("description", { length: 300 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("products_name_index").on(table.name)],
);

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
    productId: int("productId"),
    status: mysqlEnum("status", ["running", "stopped", "maintenance", "calibrating", "pending_acceptance", "scrapped"])
      .default("running")
      .notNull(),
    supplier: varchar("supplier", { length: 160 }),
    supplierId: int("supplierId"),
    businessUnitId: int("businessUnitId"),
    factoryId: int("factoryId"),
    assetCategory: varchar("assetCategory", { length: 80 }),
    criticality: varchar("criticality", { length: 8 }),
    responsibleOwner: varchar("responsibleOwner", { length: 120 }),
    commissionedAt: timestamp("commissionedAt"),
    warrantyExpiresAt: timestamp("warrantyExpiresAt"),
    hourlyCapacity: int("hourlyCapacity"),
    oee: decimal("oee", { precision: 6, scale: 4 }),
    lowOeeReason: text("lowOeeReason"),
    energyConsumption: decimal("energyConsumption", { precision: 12, scale: 3 }),
    quantity: int("quantity"),
    unitPrice: decimal("unitPrice", { precision: 14, scale: 2 }),
    depreciationYears: int("depreciationYears"),
    lossFactor: decimal("lossFactor", { precision: 8, scale: 4 }),
    notes: text("notes"),
    ownerBuNote: varchar("ownerBuNote", { length: 120 }),
    calibDueDate: timestamp("calibDueDate"),
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
    fromStatus: mysqlEnum("fromStatus", ["running", "stopped", "maintenance", "calibrating", "pending_acceptance", "scrapped"]),
    toStatus: mysqlEnum("toStatus", ["running", "stopped", "maintenance", "calibrating", "pending_acceptance", "scrapped"]).notNull(),
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
export type Product = typeof products.$inferSelect;

/* ============ 设备申请管理（修改申请 CHG / 购买申请 PUR）============ */

export const applyUsers = mysqlTable(
  "apply_users",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    roleKey: mysqlEnum("roleKey", ["user", "admin"]).notNull(),
    buId: int("buId"),
    email: varchar("email", { length: 160 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("apply_user_role_index").on(table.roleKey)],
);

export const changeApplies = mysqlTable(
  "change_applies",
  {
    id: int("id").autoincrement().primaryKey(),
    applyNo: varchar("applyNo", { length: 40 }).notNull().unique(),
    equipmentId: int("equipmentId").notNull(),
    changeType: mysqlEnum("changeType", ["repair", "calib", "retrofit", "transfer", "scrap"]).notNull(),
    status: mysqlEnum("status", ["submitted", "approving", "approved", "executing", "pending_acceptance", "closed", "withdrawn", "rejected"]).default("submitted").notNull(),
    currentNode: varchar("currentNode", { length: 40 }),
    title: varchar("title", { length: 200 }).notNull(),
    reason: text("reason").notNull(),
    planDetail: text("planDetail").notNull(),
    photos: text("photos"),
    estimatedFee: decimal("estimatedFee", { precision: 14, scale: 2 }).default("0").notNull(),
    urgency: mysqlEnum("urgency", ["normal", "production", "shutdown"]).default("normal").notNull(),
    preLockStatus: mysqlEnum("preLockStatus", ["running", "stopped", "maintenance", "calibrating", "pending_acceptance", "scrapped"]),
    targetBuId: int("targetBuId"),
    targetLocation: varchar("targetLocation", { length: 160 }),
    flowChain: text("flowChain").notNull(),
    nodeEnteredAt: timestamp("nodeEnteredAt").defaultNow().notNull(),
    submitterId: int("submitterId").notNull(),
    submitterName: varchar("submitterName", { length: 120 }),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("change_apply_no_unique").on(table.applyNo),
    index("change_apply_status_index").on(table.status),
    index("change_apply_equipment_index").on(table.equipmentId),
    index("change_apply_submitter_index").on(table.submitterId),
  ],
);

export const purchaseApplies = mysqlTable(
  "purchase_applies",
  {
    id: int("id").autoincrement().primaryKey(),
    applyNo: varchar("applyNo", { length: 40 }).notNull().unique(),
    buyType: mysqlEnum("buyType", ["new_purchase", "replace"]).notNull(),
    status: mysqlEnum("status", ["submitted", "approving", "approved", "executing", "pending_acceptance", "closed", "withdrawn", "rejected"]).default("submitted").notNull(),
    currentNode: varchar("currentNode", { length: 40 }),
    title: varchar("title", { length: 200 }).notNull(),
    reason: text("reason").notNull(),
    buId: int("buId"),
    replaceEquipmentId: int("replaceEquipmentId"),
    equipmentName: varchar("equipmentName", { length: 160 }).notNull(),
    modelSpec: varchar("modelSpec", { length: 200 }),
    quantity: int("quantity").default(1).notNull(),
    budget: decimal("budget", { precision: 14, scale: 2 }).default("0").notNull(),
    urgency: mysqlEnum("urgency", ["normal", "production", "shutdown"]).default("normal").notNull(),
    expectedDate: timestamp("expectedDate"),
    flowChain: text("flowChain").notNull(),
    nodeEnteredAt: timestamp("nodeEnteredAt").defaultNow().notNull(),
    purchaserStage: mysqlEnum("purchaserStage", ["pending", "quoting", "quoted", "ordered", "shipping", "arrived"]).default("pending"),
    selectedQuotationId: int("selectedQuotationId"),
    selectedSupplierName: varchar("selectedSupplierName", { length: 160 }),
    selectedAmount: decimal("selectedAmount", { precision: 14, scale: 2 }),
    submitterId: int("submitterId").notNull(),
    submitterName: varchar("submitterName", { length: 120 }),
    closedAt: timestamp("closedAt"),
    newEquipmentId: int("newEquipmentId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("purchase_apply_no_unique").on(table.applyNo),
    index("purchase_apply_status_index").on(table.status),
    index("purchase_apply_submitter_index").on(table.submitterId),
  ],
);

export const approvalFlowDefs = mysqlTable("approval_flow_defs", {
  id: int("id").autoincrement().primaryKey(),
  flowKey: varchar("flowKey", { length: 40 }).notNull().unique(),
  flowName: varchar("flowName", { length: 120 }).notNull(),
  chainJson: text("chainJson").notNull(),
  description: varchar("description", { length: 300 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const approvalRecords = mysqlTable(
  "approval_records",
  {
    id: int("id").autoincrement().primaryKey(),
    applyType: mysqlEnum("applyType", ["change", "purchase"]).notNull(),
    applyId: int("applyId").notNull(),
    nodeKey: varchar("nodeKey", { length: 40 }).notNull(),
    nodeName: varchar("nodeName", { length: 120 }).notNull(),
    action: mysqlEnum("action", ["approve", "reject", "resubmit", "submit", "withdraw", "urge", "execute", "accept", "close"]).notNull(),
    actorId: int("actorId").notNull(),
    actorName: varchar("actorName", { length: 120 }),
    actorRole: varchar("actorRole", { length: 40 }),
    comment: text("comment"),
    actedAt: timestamp("actedAt").defaultNow().notNull(),
  },
  table => [
    index("approval_record_apply_index").on(table.applyType, table.applyId),
    index("approval_record_actor_index").on(table.actorId),
  ],
);

export const maintenanceRecords = mysqlTable(
  "maintenance_records",
  {
    id: int("id").autoincrement().primaryKey(),
    equipmentId: int("equipmentId").notNull(),
    recordType: mysqlEnum("recordType", ["repair", "calib", "retrofit", "inspection"]).default("repair").notNull(),
    applyId: int("applyId"),
    applyNo: varchar("applyNo", { length: 40 }),
    content: text("content").notNull(),
    laborHours: decimal("laborHours", { precision: 8, scale: 1 }),
    fee: decimal("fee", { precision: 14, scale: 2 }).default("0").notNull(),
    executorName: varchar("executorName", { length: 120 }),
    executedAt: timestamp("executedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("maintenance_record_equipment_index").on(table.equipmentId)],
);

export const quotations = mysqlTable(
  "quotations",
  {
    id: int("id").autoincrement().primaryKey(),
    applyId: int("applyId").notNull(),
    supplierId: int("supplierId"),
    supplierName: varchar("supplierName", { length: 160 }).notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    leadTimeDays: int("leadTimeDays"),
    paymentTerm: varchar("paymentTerm", { length: 120 }),
    attachmentNote: varchar("attachmentNote", { length: 300 }),
    isSelected: boolean("isSelected").default(false).notNull(),
    createdById: int("createdById"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("quotation_apply_index").on(table.applyId)],
);

export const acceptanceRecords = mysqlTable(
  "acceptance_records",
  {
    id: int("id").autoincrement().primaryKey(),
    applyType: mysqlEnum("applyType", ["change", "purchase"]).notNull(),
    applyId: int("applyId").notNull(),
    result: mysqlEnum("result", ["pass", "fail"]).notNull(),
    remark: text("remark"),
    photos: text("photos"),
    signerId: int("signerId"),
    signerName: varchar("signerName", { length: 120 }),
    coSignerName: varchar("coSignerName", { length: 120 }),
    acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  },
  table => [index("acceptance_record_apply_index").on(table.applyType, table.applyId)],
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    content: varchar("content", { length: 500 }),
    link: varchar("link", { length: 200 }),
    isRead: boolean("isRead").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notification_user_index").on(table.userId)],
);

export const applySettings = mysqlTable("apply_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 60 }).notNull().unique(),
  settingValue: varchar("settingValue", { length: 120 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  unit: varchar("unit", { length: 40 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApplyUser = typeof applyUsers.$inferSelect;
export type ChangeApply = typeof changeApplies.$inferSelect;
export type PurchaseApply = typeof purchaseApplies.$inferSelect;
export type ApprovalRecord = typeof approvalRecords.$inferSelect;
export type Quotation = typeof quotations.$inferSelect;
export type AcceptanceRecord = typeof acceptanceRecords.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ApplySetting = typeof applySettings.$inferSelect;
