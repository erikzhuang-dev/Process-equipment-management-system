/**
 * 申请域持久化事务层：创建、审批动作、执行推进、验收回写、比价、配置。
 * 全部写操作走事务，审批留痕只插不改。
 */
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import {
  acceptanceRecords,
  applySettings,
  approvalFlowDefs,
  approvalRecords,
  applyUsers,
  businessUnits,
  changeApplies,
  equipment,
  equipmentStatusChanges,
  maintenanceRecords,
  notifications,
  operationLogs,
  purchaseApplies,
  quotations,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  APPROVAL_NODES,
  CHANGE_TYPE_META,
  QUOTATION_MIN_COUNT,
} from "../shared/apply";
import {
  buildChangeChain,
  buildPurchaseChain,
  formatApplyNo,
  isQuotationComplete,
  lockStatusFor,
  parseChain,
  restoredStatusFor,
  serializeChain,
} from "./applyEngine";
import { requireAdmin, requireNodeActor, requireOwnerOrAdmin, type ActingIdentity } from "./applyAuthorization";
import type {
  ApprovalNodeKey,
  ApplyStatus,
  ChangeType,
  PurchaseBuyType,
  Urgency,
} from "../shared/apply";

type Tx = Parameters<Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]>[0];

const ACTIVE_CHANGE_STATUSES: ApplyStatus[] = ["approving", "executing", "pending_acceptance"];

/* ---------------- 内部工具 ---------------- */

async function nextApplyNo(prefix: "CHG" | "PUR"): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const now = new Date();
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  const likePattern = `${prefix}-${y}${m}${d}-%`;
  const table = prefix === "CHG" ? changeApplies : purchaseApplies;
  const rows = await db.select({ no: table.applyNo }).from(table).where(like(table.applyNo, likePattern));
  return formatApplyNo(prefix, now, rows.length + 1);
}

function recordTx(tx: Tx, input: {
  applyType: "change" | "purchase";
  applyId: number;
  nodeKey: string;
  nodeName: string;
  action: "approve" | "reject" | "resubmit" | "submit" | "withdraw" | "urge" | "execute" | "accept" | "close";
  actor: ActingIdentity;
  comment?: string | null;
}) {
  return tx.insert(approvalRecords).values({
    applyType: input.applyType,
    applyId: input.applyId,
    nodeKey: input.nodeKey,
    nodeName: input.nodeName,
    action: input.action,
    actorId: input.actor.id,
    actorName: input.actor.name,
    actorRole: input.actor.roleKey,
    comment: input.comment ?? null,
  });
}

function notifyRoleTx(tx: Tx, roleKey: "admin", payload: { type: string; title: string; content?: string; link?: string }) {
  return tx
    .select({ id: applyUsers.id })
    .from(applyUsers)
    .where(and(eq(applyUsers.roleKey, roleKey), eq(applyUsers.isActive, true)))
    .then(rows => {
      if (!rows.length) return;
      return tx.insert(notifications).values(rows.map(row => ({
        userId: row.id,
        type: payload.type,
        title: payload.title,
        content: payload.content ?? null,
        link: payload.link ?? null,
      })));
    });
}

function notifyUserTx(tx: Tx, userId: number, payload: { type: string; title: string; content?: string; link?: string }) {
  return tx.insert(notifications).values({
    userId,
    type: payload.type,
    title: payload.title,
    content: payload.content ?? null,
    link: payload.link ?? null,
  });
}

async function statusChangeTx(tx: Tx, input: { equipmentId: number; from: string | null; to: string; changedBy: number }) {
  await tx.insert(equipmentStatusChanges).values({
    equipmentId: input.equipmentId,
    fromStatus: (input.from ?? null) as never,
    toStatus: input.to as never,
    changedBy: input.changedBy,
  });
}

async function operationLogTx(tx: Tx, input: { module: string; action: string; targetType: string; targetId: string; detail?: string; userId: number }) {
  await tx.insert(operationLogs).values({
    userId: input.userId,
    module: input.module,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    detail: input.detail ?? null,
  });
}

/* ---------------- 创建 ---------------- */

export interface CreateChangeInput {
  equipmentId: number;
  changeType: ChangeType;
  title: string;
  reason: string;
  planDetail: string;
  photos?: string[];
  estimatedFee: number;
  urgency: Urgency;
  targetBuId?: number | null;
  targetLocation?: string | null;
}

export async function createChangeApplyTx(identity: ActingIdentity, input: CreateChangeInput) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const equipmentRows = await db.select().from(equipment).where(eq(equipment.id, input.equipmentId)).limit(1);
  const item = equipmentRows[0];
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "设备不存在" });
  if (item.status === "scrapped" && input.changeType !== "scrap") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "该设备已报废，不能再发起维修/改造类申请" });
  }
  const activeRows = await db
    .select({ id: changeApplies.id, applyNo: changeApplies.applyNo })
    .from(changeApplies)
    .where(and(eq(changeApplies.equipmentId, input.equipmentId), inArray(changeApplies.status, ACTIVE_CHANGE_STATUSES)))
    .limit(1);
  if (activeRows.length) {
    throw new TRPCError({ code: "CONFLICT", message: `该设备存在进行中的修改申请（${activeRows[0].applyNo}），请先完成或撤回` });
  }
  if (input.changeType === "transfer" && !input.targetBuId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "移装申请必须选择目标 BU" });
  }
  if (input.changeType !== "transfer" && (!(input.estimatedFee > 0))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "预估费用必须大于 0（移装申请除外）" });
  }

  const chain = buildChangeChain();
  const applyNo = await nextApplyNo("CHG");
  const lockStatus = lockStatusFor(input.changeType);
  const typeMeta = CHANGE_TYPE_META[input.changeType];

  return db.transaction(async tx => {
    const inserted = await tx
      .insert(changeApplies)
      .values({
        applyNo,
        equipmentId: input.equipmentId,
        changeType: input.changeType,
        status: "approving",
        currentNode: chain[0],
        title: input.title,
        reason: input.reason,
        planDetail: input.planDetail,
        photos: input.photos?.length ? JSON.stringify(input.photos) : null,
        estimatedFee: String(input.estimatedFee),
        urgency: input.urgency,
        preLockStatus: item.status,
        targetBuId: input.targetBuId ?? null,
        targetLocation: input.targetLocation ?? null,
        flowChain: serializeChain(chain),
        nodeEnteredAt: new Date(),
        submitterId: identity.id,
        submitterName: identity.name,
      })
      .$returningId();
    const applyId = Number(inserted[0]?.id);
    if (!Number.isInteger(applyId) || applyId <= 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建申请失败" });

    await tx.update(equipment).set({ status: lockStatus }).where(eq(equipment.id, input.equipmentId));
    await statusChangeTx(tx, { equipmentId: input.equipmentId, from: item.status, to: lockStatus, changedBy: identity.id });

    await recordTx(tx, {
      applyType: "change",
      applyId,
      nodeKey: "submit",
      nodeName: "提交申请",
      action: "submit",
      actor: identity,
      comment: `${typeMeta.nameZh} · 预估费用 ${input.estimatedFee} 万元`,
    });
    await notifyRoleTx(tx, "admin", {
      type: "approval_pending",
      title: `新修改申请待审批：${input.title}`,
      content: `${identity.name ?? "申请人"} 提交了 ${typeMeta.nameZh}（${applyNo}），请及时处理`,
      link: `/apply/change/${applyId}`,
    });
    await operationLogTx(tx, {
      module: "设备修改申请",
      action: "提交申请",
      targetType: "change_apply",
      targetId: applyNo,
      detail: `${typeMeta.nameZh} · 设备 ${item.code} · 预估 ${input.estimatedFee} 万元`,
      userId: identity.id,
    });
    return { id: applyId, applyNo, chain };
  });
}

export interface CreatePurchaseInput {
  buyType: PurchaseBuyType;
  title: string;
  reason: string;
  buId?: number | null;
  replaceEquipmentId?: number | null;
  equipmentName: string;
  modelSpec?: string | null;
  quantity: number;
  budget: number;
  urgency: Urgency;
  expectedDate?: string | null;
}

export async function createPurchaseApplyTx(identity: ActingIdentity, input: CreatePurchaseInput) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  if (!(input.budget > 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "预算金额必须大于 0" });
  if (input.buyType === "replace" && !input.replaceEquipmentId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "替换购置必须选择被替换的现有设备" });
  }
  const chain = buildPurchaseChain();
  const applyNo = await nextApplyNo("PUR");
  const expectedAt = input.expectedDate ? new Date(`${input.expectedDate}T00:00:00`) : null;

  return db.transaction(async tx => {
    const inserted = await tx
      .insert(purchaseApplies)
      .values({
        applyNo,
        buyType: input.buyType,
        status: "approving",
        currentNode: chain[0],
        title: input.title,
        reason: input.reason,
        buId: input.buId ?? null,
        replaceEquipmentId: input.replaceEquipmentId ?? null,
        equipmentName: input.equipmentName,
        modelSpec: input.modelSpec ?? null,
        quantity: input.quantity,
        budget: String(input.budget),
        urgency: input.urgency,
        expectedDate: expectedAt && !Number.isNaN(expectedAt.getTime()) ? expectedAt : null,
        flowChain: serializeChain(chain),
        nodeEnteredAt: new Date(),
        purchaserStage: "pending",
        submitterId: identity.id,
        submitterName: identity.name,
      })
      .$returningId();
    const applyId = Number(inserted[0]?.id);
    if (!Number.isInteger(applyId) || applyId <= 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "创建申请失败" });

    await recordTx(tx, {
      applyType: "purchase",
      applyId,
      nodeKey: "submit",
      nodeName: "提交申请",
      action: "submit",
      actor: identity,
      comment: `预算 ${input.budget} 万元 · 数量 ${input.quantity}`,
    });
    await notifyRoleTx(tx, "admin", {
      type: "approval_pending",
      title: `新购买申请待审批：${input.title}`,
      content: `${identity.name ?? "申请人"} 提交了购买申请（${applyNo}），预算 ${input.budget} 万元`,
      link: `/apply/purchase/${applyId}`,
    });
    await operationLogTx(tx, {
      module: "设备购买申请",
      action: "提交申请",
      targetType: "purchase_apply",
      targetId: applyNo,
      detail: `${input.equipmentName} · 预算 ${input.budget} 万元`,
      userId: identity.id,
    });
    return { id: applyId, applyNo, chain };
  });
}

/* ---------------- 撤回 / 重新提交 ---------------- */

export async function withdrawApplyTx(applyType: "change" | "purchase", id: number, identity: ActingIdentity) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const table = applyType === "change" ? changeApplies : purchaseApplies;
  const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "approving" && apply.status !== "rejected") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "当前状态不可撤回（审批中或已驳回状态可撤回）" });
  }
  requireOwnerOrAdmin({ user: identity, submitterId: apply.submitterId });

  return db.transaction(async tx => {
    await tx.update(table).set({ status: "withdrawn", currentNode: null }).where(eq(table.id, id));
    if (applyType === "change") {
      const change = apply as typeof changeApplies.$inferSelect;
      if (change.preLockStatus) {
        const currentRows = await tx.select({ status: equipment.status }).from(equipment).where(eq(equipment.id, change.equipmentId)).limit(1);
        const currentStatus = currentRows[0]?.status;
        if (currentStatus && currentStatus !== change.preLockStatus) {
          await tx.update(equipment).set({ status: change.preLockStatus }).where(eq(equipment.id, change.equipmentId));
          await statusChangeTx(tx, { equipmentId: change.equipmentId, from: currentStatus, to: change.preLockStatus, changedBy: identity.id });
        }
      }
    }
    await recordTx(tx, { applyType, applyId: id, nodeKey: "withdraw", nodeName: "撤回申请", action: "withdraw", actor: identity });
    await notifyRoleTx(tx, "admin", {
      type: "apply_withdrawn",
      title: `申请已撤回：${apply.applyNo}`,
      content: `${identity.name ?? "申请人"} 撤回了申请「${apply.title}」`,
      link: applyType === "change" ? `/apply/change/${id}` : `/apply/purchase/${id}`,
    });
    await operationLogTx(tx, {
      module: applyType === "change" ? "设备修改申请" : "设备购买申请",
      action: "撤回申请",
      targetType: applyType === "change" ? "change_apply" : "purchase_apply",
      targetId: apply.applyNo,
      userId: identity.id,
    });
  });
}

export interface ResubmitInput {
  id: number;
  title?: string;
  reason?: string;
  planDetail?: string;
  estimatedFee?: number;
  photos?: string[];
}

export async function resubmitChangeApplyTx(identity: ActingIdentity, input: ResubmitInput) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const rows = await db.select().from(changeApplies).where(eq(changeApplies.id, input.id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "rejected") throw new TRPCError({ code: "BAD_REQUEST", message: "仅被驳回的申请可重新提交" });
  requireOwnerOrAdmin({ user: identity, submitterId: apply.submitterId });

  const estimatedFee = input.estimatedFee ?? Number(apply.estimatedFee);
  const chain = buildChangeChain();

  return db.transaction(async tx => {
    await tx
      .update(changeApplies)
      .set({
        title: input.title ?? apply.title,
        reason: input.reason ?? apply.reason,
        planDetail: input.planDetail ?? apply.planDetail,
        estimatedFee: String(estimatedFee),
        photos: input.photos?.length ? JSON.stringify(input.photos) : apply.photos,
        status: "approving",
        currentNode: chain[0],
        flowChain: serializeChain(chain),
        nodeEnteredAt: new Date(),
      })
      .where(eq(changeApplies.id, apply.id));
    await recordTx(tx, {
      applyType: "change",
      applyId: apply.id,
      nodeKey: "resubmit",
      nodeName: "重新提交",
      action: "resubmit",
      actor: identity,
      comment: "按驳回意见修改后重新提交",
    });
    await notifyRoleTx(tx, "admin", {
      type: "approval_pending",
      title: `修改申请重新提交：${apply.title}`,
      content: `${identity.name ?? "申请人"} 重新提交了 ${apply.applyNo}，请审批`,
      link: `/apply/change/${apply.id}`,
    });
  });
}

export async function resubmitPurchaseApplyTx(identity: ActingIdentity, input: { id: number; title?: string; reason?: string; budget?: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const rows = await db.select().from(purchaseApplies).where(eq(purchaseApplies.id, input.id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "rejected") throw new TRPCError({ code: "BAD_REQUEST", message: "仅被驳回的申请可重新提交" });
  requireOwnerOrAdmin({ user: identity, submitterId: apply.submitterId });

  const budget = input.budget ?? Number(apply.budget);
  const chain = buildPurchaseChain();

  return db.transaction(async tx => {
    await tx
      .update(purchaseApplies)
      .set({
        title: input.title ?? apply.title,
        reason: input.reason ?? apply.reason,
        budget: String(budget),
        status: "approving",
        currentNode: chain[0],
        flowChain: serializeChain(chain),
        nodeEnteredAt: new Date(),
      })
      .where(eq(purchaseApplies.id, apply.id));
    await recordTx(tx, {
      applyType: "purchase",
      applyId: apply.id,
      nodeKey: "resubmit",
      nodeName: "重新提交",
      action: "resubmit",
      actor: identity,
      comment: "按驳回意见修改后重新提交",
    });
    await notifyRoleTx(tx, "admin", {
      type: "approval_pending",
      title: `购买申请重新提交：${apply.title}`,
      content: `${identity.name ?? "申请人"} 重新提交了 ${apply.applyNo}，请审批`,
      link: `/apply/purchase/${apply.id}`,
    });
  });
}

/* ---------------- 审批动作 ---------------- */

export async function submitApprovalActionTx(input: {
  applyType: "change" | "purchase";
  id: number;
  identity: ActingIdentity;
  action: "approve" | "reject";
  comment?: string | null;
  rejectToNode?: ApprovalNodeKey | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const table = input.applyType === "change" ? changeApplies : purchaseApplies;
  const rows = await db.select().from(table).where(eq(table.id, input.id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "approving") throw new TRPCError({ code: "BAD_REQUEST", message: "该申请当前不在审批中" });
  const currentNode = apply.currentNode as ApprovalNodeKey | null;
  if (!currentNode) throw new TRPCError({ code: "BAD_REQUEST", message: "申请缺少当前节点" });
  requireNodeActor({ user: input.identity });

  const chain = parseChain(apply.flowChain);
  const chainIndex = chain.indexOf(currentNode);
  const nodeMeta = APPROVAL_NODES[currentNode];

  if (input.action === "reject") {
    if (!input.comment || input.comment.trim().length < 4) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "驳回必须填写不少于 4 个字的驳回意见" });
    }
    const backToNode = input.rejectToNode && chain.includes(input.rejectToNode) && chain.indexOf(input.rejectToNode) < chainIndex ? input.rejectToNode : null;

    return db.transaction(async tx => {
      if (backToNode) {
        await tx.update(table).set({ currentNode: backToNode, nodeEnteredAt: new Date() }).where(eq(table.id, apply.id));
        await notifyRoleTx(tx, "admin", {
          type: "approval_pending",
          title: `申请被驳回重审：${apply.title}`,
          content: `${input.identity.name ?? ""} 驳回至「${APPROVAL_NODES[backToNode].nameZh}」：${input.comment}`,
          link: input.applyType === "change" ? `/apply/change/${apply.id}` : `/apply/purchase/${apply.id}`,
        });
      } else {
        await tx.update(table).set({ status: "rejected", currentNode: null }).where(eq(table.id, apply.id));
        await notifyUserTx(tx, apply.submitterId, {
          type: "apply_rejected",
          title: `申请被驳回：${apply.title}`,
          content: `${input.identity.name ?? ""} 驳回了 ${apply.applyNo}：${input.comment}`,
          link: input.applyType === "change" ? `/apply/change/${apply.id}` : `/apply/purchase/${apply.id}`,
        });
      }
      await recordTx(tx, {
        applyType: input.applyType,
        applyId: apply.id,
        nodeKey: currentNode,
        nodeName: nodeMeta.nameZh,
        action: "reject",
        actor: input.identity,
        comment: backToNode ? `驳回至 ${APPROVAL_NODES[backToNode].nameZh}：${input.comment}` : input.comment,
      });
      await operationLogTx(tx, {
        module: input.applyType === "change" ? "设备修改申请" : "设备购买申请",
        action: backToNode ? "驳回至节点" : "驳回申请",
        targetType: input.applyType === "change" ? "change_apply" : "purchase_apply",
        targetId: apply.applyNo,
        detail: input.comment ?? undefined,
        userId: input.identity.id,
      });
    });
  }

  // approve
  return db.transaction(async tx => {
    const next = chain[chainIndex + 1];
    if (next) {
      await tx.update(table).set({ currentNode: next, nodeEnteredAt: new Date() }).where(eq(table.id, apply.id));
      await notifyRoleTx(tx, "admin", {
        type: "approval_pending",
        title: `申请待审批：${apply.title}`,
        content: `${input.identity.name ?? ""} 已通过「${nodeMeta.nameZh}」，等待「${APPROVAL_NODES[next].nameZh}」处理`,
        link: input.applyType === "change" ? `/apply/change/${apply.id}` : `/apply/purchase/${apply.id}`,
      });
    } else {
      await tx.update(table).set({ status: "executing", currentNode: null }).where(eq(table.id, apply.id));
      await notifyUserTx(tx, apply.submitterId, {
        type: "apply_approved",
        title: `申请已批准：${apply.title}`,
        content: `${apply.applyNo} 审批链全部通过，进入执行阶段`,
        link: input.applyType === "change" ? `/apply/change/${apply.id}` : `/apply/purchase/${apply.id}`,
      });
    }
    await recordTx(tx, {
      applyType: input.applyType,
      applyId: apply.id,
      nodeKey: currentNode,
      nodeName: nodeMeta.nameZh,
      action: "approve",
      actor: input.identity,
      comment: input.comment ?? null,
    });
    await operationLogTx(tx, {
      module: input.applyType === "change" ? "设备修改申请" : "设备购买申请",
      action: "审批通过",
      targetType: input.applyType === "change" ? "change_apply" : "purchase_apply",
      targetId: apply.applyNo,
      detail: `${nodeMeta.nameZh} · ${input.identity.name ?? ""}`,
      userId: input.identity.id,
    });
  });
}

export async function urgeApplyTx(applyType: "change" | "purchase", id: number, identity: ActingIdentity) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const table = applyType === "change" ? changeApplies : purchaseApplies;
  const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "approving") throw new TRPCError({ code: "BAD_REQUEST", message: "仅审批中的申请可催办" });
  if (identity.id !== apply.submitterId && identity.roleKey !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅申请人本人或管理人员可催办" });
  }
  const currentNode = apply.currentNode as ApprovalNodeKey | null;
  if (!currentNode) throw new TRPCError({ code: "BAD_REQUEST", message: "申请缺少当前节点" });

  return db.transaction(async tx => {
    await recordTx(tx, { applyType, applyId: id, nodeKey: currentNode, nodeName: APPROVAL_NODES[currentNode].nameZh, action: "urge", actor: identity });
    await notifyRoleTx(tx, "admin", {
      type: "approval_urge",
      title: `催办提醒：${apply.title}`,
      content: `${identity.name ?? "申请人"} 催办了 ${apply.applyNo}，当前停留在「${APPROVAL_NODES[currentNode].nameZh}」`,
      link: applyType === "change" ? `/apply/change/${id}` : `/apply/purchase/${id}`,
    });
  });
}

/* ---------------- 执行推进 ---------------- */

/** 执行推进、采购执行、验收等管理动作统一要求管理人员身份 */
export async function pushProgressTx(input: { applyType: "change" | "purchase"; id: number; identity: ActingIdentity; note: string }) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  if (!input.note.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写执行进度说明" });
  requireAdmin(input.identity);
  const table = input.applyType === "change" ? changeApplies : purchaseApplies;
  const rows = await db.select().from(table).where(eq(table.id, input.id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "executing") throw new TRPCError({ code: "BAD_REQUEST", message: "仅执行中的申请可更新进度" });

  return db.transaction(async tx => {
    await recordTx(tx, {
      applyType: input.applyType,
      applyId: apply.id,
      nodeKey: "execution",
      nodeName: "执行跟踪",
      action: "execute",
      actor: input.identity,
      comment: input.note,
    });
    await notifyUserTx(tx, apply.submitterId, {
      type: "execution_progress",
      title: `执行进度更新：${apply.title}`,
      content: `${input.identity.name ?? "执行人"}：${input.note}`,
      link: input.applyType === "change" ? `/apply/change/${apply.id}` : `/apply/purchase/${apply.id}`,
    });
  });
}

export async function updatePurchaserStageTx(input: { id: number; identity: ActingIdentity; stage: "quoting" | "quoted" | "ordered" | "shipping" | "arrived" }) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  requireAdmin(input.identity);
  const rows = await db.select().from(purchaseApplies).where(eq(purchaseApplies.id, input.id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "executing") throw new TRPCError({ code: "BAD_REQUEST", message: "仅执行中的申请可推进采购阶段" });
  await db.transaction(async tx => {
    await tx.update(purchaseApplies).set({ purchaserStage: input.stage }).where(eq(purchaseApplies.id, apply.id));
    await recordTx(tx, {
      applyType: "purchase",
      applyId: apply.id,
      nodeKey: "purchasing",
      nodeName: "采购执行",
      action: "execute",
      actor: input.identity,
      comment: `采购阶段推进为「${input.stage}」`,
    });
  });
}

export async function submitForAcceptanceTx(applyType: "change" | "purchase", id: number, identity: ActingIdentity) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  requireAdmin(identity);
  const table = applyType === "change" ? changeApplies : purchaseApplies;
  const rows = await db.select().from(table).where(eq(table.id, id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "executing") throw new TRPCError({ code: "BAD_REQUEST", message: "仅执行中的申请可提交验收" });
  if (applyType === "purchase") {
    const purchase = apply as typeof purchaseApplies.$inferSelect;
    const quotationRows = await db.select({ id: quotations.id }).from(quotations).where(eq(quotations.applyId, apply.id));
    if (!isQuotationComplete(quotationRows.length)) {
      throw new TRPCError({ code: "CONFLICT", message: `采购硬性规则：至少 ${QUOTATION_MIN_COUNT} 家比价齐全后才可提交验收（当前 ${quotationRows.length} 家）` });
    }
    if (!purchase.selectedQuotationId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "请先选定中标报价，再提交验收" });
    }
    if (purchase.purchaserStage !== "arrived") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "设备到货后才可提交验收（当前采购进度未到「到货」）" });
    }
  }

  return db.transaction(async tx => {
    await tx.update(table).set({ status: "pending_acceptance" }).where(eq(table.id, id));
    await recordTx(tx, {
      applyType,
      applyId: id,
      nodeKey: "acceptance",
      nodeName: "提交验收",
      action: "execute",
      actor: identity,
      comment: "执行完成，提交验收",
    });
    await notifyUserTx(tx, apply.submitterId, {
      type: "acceptance_pending",
      title: `申请待验收：${apply.title}`,
      content: `${identity.name ?? "执行人"} 已提交验收，请安排验收人`,
      link: applyType === "change" ? `/apply/change/${id}` : `/apply/purchase/${id}`,
    });
  });
}

/* ---------------- 验收与回写 ---------------- */

export async function submitAcceptanceTx(input: {
  applyType: "change" | "purchase";
  id: number;
  identity: ActingIdentity;
  result: "pass" | "fail";
  remark?: string | null;
  coSignerName?: string | null;
  calibDueDate?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  requireAdmin(input.identity);
  const table = input.applyType === "change" ? changeApplies : purchaseApplies;
  const rows = await db.select().from(table).where(eq(table.id, input.id)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  if (apply.status !== "pending_acceptance") throw new TRPCError({ code: "BAD_REQUEST", message: "该申请当前不在待验收状态" });

  if (input.result === "fail") {
    await db.transaction(async tx => {
      await tx.update(table).set({ status: "executing" }).where(eq(table.id, apply.id));
      await tx.insert(acceptanceRecords).values({
        applyType: input.applyType,
        applyId: apply.id,
        result: "fail",
        remark: input.remark ?? null,
        signerId: input.identity.id,
        signerName: input.identity.name,
        coSignerName: input.coSignerName ?? null,
      });
      await recordTx(tx, {
        applyType: input.applyType,
        applyId: apply.id,
        nodeKey: "acceptance",
        nodeName: "验收",
        action: "accept",
        actor: input.identity,
        comment: `验收不通过：${input.remark ?? ""}`,
      });
      await notifyUserTx(tx, apply.submitterId, {
        type: "acceptance_failed",
        title: `验收不通过：${apply.title}`,
        content: input.remark ?? "验收不通过，已退回执行阶段",
        link: input.applyType === "change" ? `/apply/change/${apply.id}` : `/apply/purchase/${apply.id}`,
      });
    });
    return { closed: false, message: "验收不通过，已退回执行阶段" };
  }

  if (input.applyType === "change") return closeChangeApplyWithWriteback(apply as typeof changeApplies.$inferSelect, input);
  return closePurchaseApplyWithArchiving(apply as typeof purchaseApplies.$inferSelect, input);
}

/** 修改申请验收通过：按类型事务回写台账 */
async function closeChangeApplyWithWriteback(
  apply: typeof changeApplies.$inferSelect,
  input: { identity: ActingIdentity; remark?: string | null; coSignerName?: string | null; calibDueDate?: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  const changeType = apply.changeType as ChangeType;
  const targetStatus = restoredStatusFor(changeType);
  if (changeType === "calib" && !input.calibDueDate) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "校准申请验收通过时必须填写下次校准到期日" });
  }
  const calibDue = input.calibDueDate ? new Date(`${input.calibDueDate}T00:00:00`) : null;
  const equipmentRows = await db.select().from(equipment).where(eq(equipment.id, apply.equipmentId)).limit(1);
  const item = equipmentRows[0];

  return db.transaction(async tx => {
    if (item) {
      const patch: Partial<typeof equipment.$inferInsert> = { status: targetStatus };
      if (changeType === "calib" && calibDue && !Number.isNaN(calibDue.getTime())) patch.calibDueDate = calibDue;
      if (changeType === "transfer") {
        if (apply.targetBuId) patch.businessUnitId = apply.targetBuId;
        if (apply.targetLocation) patch.location = apply.targetLocation;
      }
      if (changeType === "retrofit" && input.remark) {
        patch.notes = `${item.notes ? `${item.notes}\n` : ""}[改造记录 ${apply.applyNo}] ${input.remark}`;
      }
      await tx.update(equipment).set(patch).where(eq(equipment.id, apply.equipmentId));
      if (item.status !== targetStatus) {
        await statusChangeTx(tx, { equipmentId: apply.equipmentId, from: item.status, to: targetStatus, changedBy: input.identity.id });
      }
      if (changeType === "repair" || changeType === "calib" || changeType === "retrofit") {
        await tx.insert(maintenanceRecords).values({
          equipmentId: apply.equipmentId,
          recordType: changeType === "repair" ? "repair" : changeType === "calib" ? "calib" : "retrofit",
          applyId: apply.id,
          applyNo: apply.applyNo,
          content: input.remark || apply.planDetail,
          fee: apply.estimatedFee,
          executorName: input.identity.name,
        });
      }
    }

    await tx.update(changeApplies).set({ status: "closed", currentNode: null, closedAt: new Date() }).where(eq(changeApplies.id, apply.id));
    await tx.insert(acceptanceRecords).values({
      applyType: "change",
      applyId: apply.id,
      result: "pass",
      remark: input.remark ?? null,
      signerId: input.identity.id,
      signerName: input.identity.name,
      coSignerName: input.coSignerName ?? null,
    });
    await recordTx(tx, {
      applyType: "change",
      applyId: apply.id,
      nodeKey: "acceptance",
      nodeName: "验收通过",
      action: "accept",
      actor: input.identity,
      comment: input.remark ?? "验收通过",
    });
    await recordTx(tx, {
      applyType: "change",
      applyId: apply.id,
      nodeKey: "close",
      nodeName: "关闭归档",
      action: "close",
      actor: input.identity,
      comment: "台账已回写",
    });
    await notifyUserTx(tx, apply.submitterId, {
      type: "apply_closed",
      title: `申请已关闭：${apply.title}`,
      content: `${apply.applyNo} 验收通过，台账已回写`,
      link: `/apply/change/${apply.id}`,
    });
    await operationLogTx(tx, {
      module: "设备修改申请",
      action: "验收通过并回写台账",
      targetType: "change_apply",
      targetId: apply.applyNo,
      detail: `${CHANGE_TYPE_META[changeType].nameZh} · 设备 #${apply.equipmentId} · 状态恢复 ${targetStatus}`,
      userId: input.identity.id,
    });
    return { closed: true, message: "验收通过，台账已回写" };
  });
}

/** 购买申请验收通过：自动建档入台账 */
async function closePurchaseApplyWithArchiving(
  apply: typeof purchaseApplies.$inferSelect,
  input: { identity: ActingIdentity; remark?: string | null; coSignerName?: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");

  return db.transaction(async tx => {
    let newEquipmentId: number | null = null;
    if (apply.selectedQuotationId && apply.selectedSupplierName) {
      const buRows = apply.buId ? await tx.select({ code: businessUnits.code }).from(businessUnits).where(eq(businessUnits.id, apply.buId)).limit(1) : [];
      const buCode = buRows[0]?.code ?? "GEN";
      const prefix = `PEM-${buCode}-`;
      const existing = await tx.select({ code: equipment.code }).from(equipment).where(like(equipment.code, `${prefix}%`));
      let code = `${prefix}${`${existing.length + 1}`.padStart(3, "0")}`;
      let collision = existing.some(row => row.code === code);
      for (let attempt = 1; collision && attempt <= 5; attempt += 1) {
        code = `${prefix}${`${existing.length + 1}`.padStart(3, "0")}-${attempt}`;
        collision = existing.some(row => row.code === code);
      }
      const insertedEquip = await tx
        .insert(equipment)
        .values({
          code,
          name: apply.equipmentName,
          model: apply.modelSpec || apply.equipmentName,
          specification: apply.modelSpec || "-",
          process: "-",
          location: "-",
          status: "running",
          supplier: apply.selectedSupplierName,
          businessUnitId: apply.buId ?? null,
          quantity: apply.quantity,
          unitPrice: apply.selectedAmount,
          assetCategory: "-",
          notes: `由购买申请 ${apply.applyNo} 验收后自动建档`,
        })
        .$returningId();
      newEquipmentId = Number(insertedEquip[0]?.id) || null;
      await operationLogTx(tx, {
        module: "设备购买申请",
        action: "验收通过自动建档",
        targetType: "equipment",
        targetId: code,
        detail: `${apply.equipmentName} · ${apply.selectedSupplierName} · ${apply.selectedAmount} 万元`,
        userId: input.identity.id,
      });
    }

    await tx
      .update(purchaseApplies)
      .set({ status: "closed", currentNode: null, closedAt: new Date(), newEquipmentId })
      .where(eq(purchaseApplies.id, apply.id));
    await tx.insert(acceptanceRecords).values({
      applyType: "purchase",
      applyId: apply.id,
      result: "pass",
      remark: input.remark ?? null,
      signerId: input.identity.id,
      signerName: input.identity.name,
      coSignerName: input.coSignerName ?? null,
    });
    await recordTx(tx, {
      applyType: "purchase",
      applyId: apply.id,
      nodeKey: "acceptance",
      nodeName: "验收通过",
      action: "accept",
      actor: input.identity,
      comment: input.remark ?? "验收通过",
    });
    await recordTx(tx, {
      applyType: "purchase",
      applyId: apply.id,
      nodeKey: "close",
      nodeName: "关闭归档",
      action: "close",
      actor: input.identity,
      comment: newEquipmentId ? `新设备已建档（台账 ID ${newEquipmentId}）` : "已关闭",
    });
    await notifyUserTx(tx, apply.submitterId, {
      type: "apply_closed",
      title: `申请已关闭：${apply.title}`,
      content: `${apply.applyNo} 验收通过${newEquipmentId ? "，设备已自动建档入台账" : ""}`,
      link: `/apply/purchase/${apply.id}`,
    });
    return { closed: true, message: newEquipmentId ? `新设备已建档（台账 ID ${newEquipmentId}）` : "验收通过，单据已关闭" };
  });
}

/* ---------------- 比价 ---------------- */

export async function addQuotationTx(identity: ActingIdentity, input: {
  applyId: number;
  supplierId?: number | null;
  supplierName: string;
  amount: number;
  leadTimeDays?: number | null;
  paymentTerm?: string | null;
  attachmentNote?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  requireAdmin(identity);
  const rows = await db.select().from(purchaseApplies).where(eq(purchaseApplies.id, input.applyId)).limit(1);
  const apply = rows[0];
  if (!apply) throw new TRPCError({ code: "NOT_FOUND", message: "申请不存在" });
  const quoting = apply.status === "approving" || apply.status === "executing";
  if (!quoting) throw new TRPCError({ code: "BAD_REQUEST", message: "当前阶段不允许录入报价（审批中或执行阶段可录）" });
  if (!(input.amount > 0)) throw new TRPCError({ code: "BAD_REQUEST", message: "报价金额必须大于 0" });

  return db.transaction(async tx => {
    await tx.insert(quotations).values({
      applyId: input.applyId,
      supplierId: input.supplierId ?? null,
      supplierName: input.supplierName,
      amount: String(input.amount),
      leadTimeDays: input.leadTimeDays ?? null,
      paymentTerm: input.paymentTerm ?? null,
      attachmentNote: input.attachmentNote ?? null,
      createdById: identity.id,
    });
    if (apply.status === "executing" && apply.purchaserStage === "pending") {
      await tx.update(purchaseApplies).set({ purchaserStage: "quoting" }).where(eq(purchaseApplies.id, input.applyId));
    }
  });
}

export async function removeQuotationTx(identity: ActingIdentity, quotationId: number) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  requireAdmin(identity);
  const rows = await db.select().from(quotations).where(eq(quotations.id, quotationId)).limit(1);
  const quotation = rows[0];
  if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价不存在" });
  if (quotation.isSelected) throw new TRPCError({ code: "BAD_REQUEST", message: "已中标的报价不可删除" });
  await db.delete(quotations).where(eq(quotations.id, quotationId));
}

export async function selectQuotationTx(identity: ActingIdentity, input: { applyId: number; quotationId: number }) {
  const db = await getDb();
  if (!db) throw new Error("数据库连接不可用");
  requireAdmin(identity);
  const rows = await db.select().from(quotations).where(and(eq(quotations.id, input.quotationId), eq(quotations.applyId, input.applyId))).limit(1);
  const quotation = rows[0];
  if (!quotation) throw new TRPCError({ code: "NOT_FOUND", message: "报价不存在" });

  return db.transaction(async tx => {
    await tx.update(quotations).set({ isSelected: false }).where(eq(quotations.applyId, input.applyId));
    await tx.update(quotations).set({ isSelected: true }).where(eq(quotations.id, input.quotationId));
    await tx
      .update(purchaseApplies)
      .set({
        selectedQuotationId: quotation.id,
        selectedSupplierName: quotation.supplierName,
        selectedAmount: quotation.amount,
        purchaserStage: "quoted",
      })
      .where(eq(purchaseApplies.id, input.applyId));
    await recordTx(tx, {
      applyType: "purchase",
      applyId: input.applyId,
      nodeKey: "purchasing",
      nodeName: "选型定标",
      action: "execute",
      actor: identity,
      comment: `选定 ${quotation.supplierName} · ${quotation.amount} 万元`,
    });
  });
}

/* ---------------- 配置 ---------------- */

/** 两类角色权限模型下审批流固定为单节点「管理员审批」，不再提供阈值与流程链配置 */

