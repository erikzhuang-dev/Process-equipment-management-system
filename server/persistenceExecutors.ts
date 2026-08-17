import { eq } from "drizzle-orm";
import { inventoryTransactions, operationLogs, parts, users } from "../drizzle/schema";
import type { createInventoryWriteSet, createRoleChangeAudit } from "./persistenceWrites";

type InventoryWriteSet = ReturnType<typeof createInventoryWriteSet>;
type RoleChangeAudit = ReturnType<typeof createRoleChangeAudit>;

type SqlWriter = {
  update: (...args: any[]) => any;
  insert: (...args: any[]) => any;
};

export async function persistInventoryWriteSet(writer: SqlWriter, writeSet: InventoryWriteSet) {
  await writer.update(parts).set({ stockQuantity: writeSet.nextStock }).where(eq(parts.id, writeSet.transaction.partId));
  await writer.insert(inventoryTransactions).values(writeSet.transaction);
  await writer.insert(operationLogs).values(writeSet.audit);
}

export async function persistRoleChange(writer: SqlWriter, input: { userId: number; role: "admin" | "user"; audit: RoleChangeAudit }) {
  await writer.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
  await writer.insert(operationLogs).values(input.audit);
}
