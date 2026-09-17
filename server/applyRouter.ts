/**
 * 申请域 tRPC 路由：设备修改申请（CHG）/ 购买申请（PUR）/ 审批中心 / 执行验收 / 比价 / 配置 / 通知 / 履历。
 * 鉴权基于 ctx.actingUser（X-Acting-User-Id 头解析的申请域身份）。
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getDb } from "./db";
import { publicProcedure, router } from "./_core/trpc";
import {
  acceptanceRecords,
  approvalFlowDefs,
  approvalRecords,
  applyUsers,
  businessUnits,
  changeApplies,
  equipment,
  notifications,
  purchaseApplies,
  quotations,
} from "../drizzle/schema";
import {
  CHANGE_TYPES,
  PURCHASE_BUY_TYPES,
  URGENCY_LEVELS,
  APPLY_STATUSES,
} from "../shared/apply";
import type { ApplyRoleKey } from "../shared/apply";
import { isNodeOverdue, isNodeWarning, parseChain } from "./applyEngine";
import { requireIdentity } from "./applyAuthorization";

/** 管理员账户登录密码（双账户模型；仅存服务端，前端通过 verifyAdmin 校验） */
const ADMIN_LOGIN_PASSWORD = "admin";
import * as persistence from "./applyPersistence";

const acting = ({ ctx }: { ctx: { actingUser: null | { id: number; name: string | null; roleKey: ApplyRoleKey } } }) => requireIdentity(ctx.actingUser);

const nodeKeyEnum = z.enum(["admin_approve"]);

async function decoratePendingRows<T extends { status: string; urgency: string; nodeEnteredAt: Date }>(rows: T[]) {
  const now = new Date();
  return rows.map(row => ({
    ...row,
    overdue: isNodeOverdue({ nodeEnteredAt: row.nodeEnteredAt, urgency: row.urgency as never, now }),
    warning: isNodeWarning({ nodeEnteredAt: row.nodeEnteredAt, urgency: row.urgency as never, now }),
  }));
}

export const applyRouter = router({
  /* ---------- 身份 ---------- */
  identityUsers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select({ id: applyUsers.id, name: applyUsers.name, roleKey: applyUsers.roleKey, buId: applyUsers.buId, isActive: applyUsers.isActive })
      .from(applyUsers)
      .orderBy(applyUsers.id);
  }),

  /* 管理员登录密码校验（双账户模型：普通账户默认登录，管理员账户凭密码进入） */
  verifyAdmin: publicProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(({ input }) => {
      const ok = input.password === ADMIN_LOGIN_PASSWORD;
      if (!ok) return { ok: false as const, message: "密码错误" };
      return { ok: true as const };
    }),

  /* ---------- 修改申请 CHG ---------- */
  change: router({
    create: publicProcedure
      .input(
        z.object({
          equipmentId: z.number().int().positive(),
          changeType: z.enum(CHANGE_TYPES),
          title: z.string().trim().min(4).max(200),
          reason: z.string().trim().min(4),
          planDetail: z.string().trim().min(4),
          photos: z.array(z.string().trim().min(1)).max(9).optional(),
          estimatedFee: z.number().min(0).max(100000000),
          urgency: z.enum(URGENCY_LEVELS),
          targetBuId: z.number().int().positive().nullable().optional(),
          targetLocation: z.string().trim().max(160).nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => persistence.createChangeApplyTx(acting({ ctx }), input)),

    list: publicProcedure
      .input(
        z.object({
          scope: z.enum(["mine", "all"]).default("mine"),
          status: z.enum(APPLY_STATUSES).optional(),
          keyword: z.string().trim().max(80).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const identity = requireIdentity(ctx.actingUser);
        const conditions = [];
        if (input.scope === "mine") conditions.push(eq(changeApplies.submitterId, identity.id));
        if (input.status) conditions.push(eq(changeApplies.status, input.status));
        if (input.keyword) conditions.push(or(sql`${changeApplies.applyNo} LIKE ${`%${input.keyword}%`}`, sql`${changeApplies.title} LIKE ${`%${input.keyword}%`}`));
        const rows = await db
          .select({
            id: changeApplies.id,
            applyNo: changeApplies.applyNo,
            changeType: changeApplies.changeType,
            status: changeApplies.status,
            currentNode: changeApplies.currentNode,
            title: changeApplies.title,
            estimatedFee: changeApplies.estimatedFee,
            urgency: changeApplies.urgency,
            equipmentId: changeApplies.equipmentId,
            equipmentCode: equipment.code,
            equipmentName: equipment.name,
            location: equipment.location,
            submitterName: changeApplies.submitterName,
            nodeEnteredAt: changeApplies.nodeEnteredAt,
            createdAt: changeApplies.createdAt,
            closedAt: changeApplies.closedAt,
          })
          .from(changeApplies)
          .leftJoin(equipment, eq(changeApplies.equipmentId, equipment.id))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(changeApplies.createdAt))
          .limit(80);
        return decoratePendingRows(rows as never) as unknown as typeof rows;
      }),

    detail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(changeApplies).where(eq(changeApplies.id, input.id)).limit(1);
      const apply = rows[0];
      if (!apply) return null;
      const [equipmentRows, records, acceptances] = await Promise.all([
        db.select().from(equipment).where(eq(equipment.id, apply.equipmentId)).limit(1),
        db.select().from(approvalRecords).where(and(eq(approvalRecords.applyType, "change"), eq(approvalRecords.applyId, apply.id))).orderBy(approvalRecords.actedAt),
        db.select().from(acceptanceRecords).where(and(eq(acceptanceRecords.applyType, "change"), eq(acceptanceRecords.applyId, apply.id))).orderBy(desc(acceptanceRecords.acceptedAt)),
      ]);
      return { apply, chain: parseChain(apply.flowChain), equipment: equipmentRows[0] ?? null, records, acceptances };
    }),

    withdraw: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => persistence.withdrawApplyTx("change", input.id, acting({ ctx }))),
    resubmit: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(4).max(200).optional(),
          reason: z.string().trim().min(4).optional(),
          planDetail: z.string().trim().min(4).optional(),
          estimatedFee: z.number().min(0).optional(),
          photos: z.array(z.string().trim().min(1)).max(9).optional(),
        })
      )
      .mutation(({ ctx, input }) => persistence.resubmitChangeApplyTx(acting({ ctx }), input)),
  }),

  /* ---------- 购买申请 PUR ---------- */
  purchase: router({
    create: publicProcedure
      .input(
        z.object({
          buyType: z.enum(PURCHASE_BUY_TYPES),
          title: z.string().trim().min(4).max(200),
          reason: z.string().trim().min(4),
          buId: z.number().int().positive().nullable().optional(),
          replaceEquipmentId: z.number().int().positive().nullable().optional(),
          equipmentName: z.string().trim().min(2).max(160),
          modelSpec: z.string().trim().max(200).nullable().optional(),
          quantity: z.number().int().min(1).max(999).default(1),
          budget: z.number().min(0).max(100000000),
          urgency: z.enum(URGENCY_LEVELS),
          expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => persistence.createPurchaseApplyTx(acting({ ctx }), input)),

    list: publicProcedure
      .input(
        z.object({
          scope: z.enum(["mine", "all"]).default("mine"),
          status: z.enum(APPLY_STATUSES).optional(),
          keyword: z.string().trim().max(80).optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return [];
        const identity = requireIdentity(ctx.actingUser);
        const conditions = [];
        if (input.scope === "mine") conditions.push(eq(purchaseApplies.submitterId, identity.id));
        if (input.status) conditions.push(eq(purchaseApplies.status, input.status));
        if (input.keyword) conditions.push(or(sql`${purchaseApplies.applyNo} LIKE ${`%${input.keyword}%`}`, sql`${purchaseApplies.title} LIKE ${`%${input.keyword}%`}`));
        const buTable = businessUnits;
        const rows = await db
          .select({
            id: purchaseApplies.id,
            applyNo: purchaseApplies.applyNo,
            buyType: purchaseApplies.buyType,
            status: purchaseApplies.status,
            currentNode: purchaseApplies.currentNode,
            title: purchaseApplies.title,
            equipmentName: purchaseApplies.equipmentName,
            quantity: purchaseApplies.quantity,
            budget: purchaseApplies.budget,
            selectedAmount: purchaseApplies.selectedAmount,
            urgency: purchaseApplies.urgency,
            purchaserStage: purchaseApplies.purchaserStage,
            buName: buTable.name,
            submitterName: purchaseApplies.submitterName,
            nodeEnteredAt: purchaseApplies.nodeEnteredAt,
            createdAt: purchaseApplies.createdAt,
            closedAt: purchaseApplies.closedAt,
          })
          .from(purchaseApplies)
          .leftJoin(buTable, eq(purchaseApplies.buId, buTable.id))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(desc(purchaseApplies.createdAt))
          .limit(80);
        return decoratePendingRows(rows as never) as unknown as typeof rows;
      }),

    detail: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(purchaseApplies).where(eq(purchaseApplies.id, input.id)).limit(1);
      const apply = rows[0];
      if (!apply) return null;
      const [records, quotationRows, acceptances, replaceEquipment] = await Promise.all([
        db.select().from(approvalRecords).where(and(eq(approvalRecords.applyType, "purchase"), eq(approvalRecords.applyId, apply.id))).orderBy(approvalRecords.actedAt),
        db.select().from(quotations).where(eq(quotations.applyId, apply.id)).orderBy(quotations.amount),
        db.select().from(acceptanceRecords).where(and(eq(acceptanceRecords.applyType, "purchase"), eq(acceptanceRecords.applyId, apply.id))).orderBy(desc(acceptanceRecords.acceptedAt)),
        apply.replaceEquipmentId ? db.select({ id: equipment.id, code: equipment.code, name: equipment.name }).from(equipment).where(eq(equipment.id, apply.replaceEquipmentId)).limit(1) : Promise.resolve([]),
      ]);
      return { apply, chain: parseChain(apply.flowChain), records, quotations: quotationRows, acceptances, replaceEquipment: replaceEquipment[0] ?? null };
    }),

    withdraw: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => persistence.withdrawApplyTx("purchase", input.id, acting({ ctx }))),
    resubmit: publicProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          title: z.string().trim().min(4).max(200).optional(),
          reason: z.string().trim().min(4).optional(),
          budget: z.number().min(0).optional(),
        })
      )
      .mutation(({ ctx, input }) => persistence.resubmitPurchaseApplyTx(acting({ ctx }), input)),

    addQuotation: publicProcedure
      .input(
        z.object({
          applyId: z.number().int().positive(),
          supplierName: z.string().trim().min(1).max(160),
          supplierId: z.number().int().positive().nullable().optional(),
          amount: z.number().min(0),
          leadTimeDays: z.number().int().min(0).max(365).nullable().optional(),
          paymentTerm: z.string().trim().max(120).nullable().optional(),
          attachmentNote: z.string().trim().max(300).nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => persistence.addQuotationTx(acting({ ctx }), input)),
    removeQuotation: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => persistence.removeQuotationTx(acting({ ctx }), input.id)),
    selectQuotation: publicProcedure
      .input(z.object({ applyId: z.number().int().positive(), quotationId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => persistence.selectQuotationTx(acting({ ctx }), input)),

    updatePurchaserStage: publicProcedure
      .input(z.object({ id: z.number().int().positive(), stage: z.enum(["quoting", "quoted", "ordered", "shipping", "arrived"]) }))
      .mutation(({ ctx, input }) => persistence.updatePurchaserStageTx({ ...input, identity: acting({ ctx }) })),
  }),

  /* ---------- 审批中心 ---------- */
  approval: router({
    myPending: publicProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const identity = requireIdentity(ctx.actingUser);
      // 两类角色权限模型：管理人员可见并审批全部待审单据
      if (identity.roleKey !== "admin") return [];
      const [changeRows, purchaseRows] = await Promise.all([
        db
          .select({
            applyType: sql<"change">`'change'`,
            id: changeApplies.id,
            applyNo: changeApplies.applyNo,
            title: changeApplies.title,
            changeType: changeApplies.changeType,
            status: changeApplies.status,
            currentNode: changeApplies.currentNode,
            urgency: changeApplies.urgency,
            amount: changeApplies.estimatedFee,
            equipmentName: equipment.name,
            equipmentCode: equipment.code,
            submitterName: changeApplies.submitterName,
            nodeEnteredAt: changeApplies.nodeEnteredAt,
          })
          .from(changeApplies)
          .leftJoin(equipment, eq(changeApplies.equipmentId, equipment.id))
          .where(eq(changeApplies.status, "approving")),
        db
          .select({
            applyType: sql<"purchase">`'purchase'`,
            id: purchaseApplies.id,
            applyNo: purchaseApplies.applyNo,
            title: purchaseApplies.title,
            changeType: purchaseApplies.buyType,
            status: purchaseApplies.status,
            currentNode: purchaseApplies.currentNode,
            urgency: purchaseApplies.urgency,
            amount: purchaseApplies.budget,
            equipmentName: purchaseApplies.equipmentName,
            equipmentCode: sql<string | null>`NULL`,
            submitterName: purchaseApplies.submitterName,
            nodeEnteredAt: purchaseApplies.nodeEnteredAt,
          })
          .from(purchaseApplies)
          .where(eq(purchaseApplies.status, "approving")),
      ]);
      const merged = [...changeRows, ...purchaseRows];
      const decorated = (await decoratePendingRows(merged as never)) as unknown as Array<(typeof merged)[number] & { overdue: boolean; warning: boolean }>;
      return decorated.sort((a, b) => Number(b.overdue) - Number(a.overdue) || new Date(a.nodeEnteredAt).getTime() - new Date(b.nodeEnteredAt).getTime());
    }),

    actedHistory: publicProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const identity = requireIdentity(ctx.actingUser);
      return db.select().from(approvalRecords).where(eq(approvalRecords.actorId, identity.id)).orderBy(desc(approvalRecords.actedAt)).limit(60);
    }),

    act: publicProcedure
      .input(
        z.object({
          applyType: z.enum(["change", "purchase"]),
          id: z.number().int().positive(),
          action: z.enum(["approve", "reject"]),
          comment: z.string().trim().max(500).nullable().optional(),
          rejectToNode: nodeKeyEnum.nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        persistence.submitApprovalActionTx({
          applyType: input.applyType,
          id: input.id,
          identity: acting({ ctx }),
          action: input.action,
          comment: input.comment ?? null,
          rejectToNode: input.rejectToNode ?? null,
        })
      ),

    urge: publicProcedure
      .input(z.object({ applyType: z.enum(["change", "purchase"]), id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => persistence.urgeApplyTx(input.applyType, input.id, acting({ ctx }))),
  }),

  /* ---------- 执行与验收 ---------- */
  execution: router({
    pushProgress: publicProcedure
      .input(z.object({ applyType: z.enum(["change", "purchase"]), id: z.number().int().positive(), note: z.string().trim().min(2).max(500) }))
      .mutation(({ ctx, input }) => persistence.pushProgressTx({ ...input, identity: acting({ ctx }) })),
    submitForAcceptance: publicProcedure
      .input(z.object({ applyType: z.enum(["change", "purchase"]), id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => persistence.submitForAcceptanceTx(input.applyType, input.id, acting({ ctx }))),
  }),

  acceptance: router({
    submit: publicProcedure
      .input(
        z.object({
          applyType: z.enum(["change", "purchase"]),
          id: z.number().int().positive(),
          result: z.enum(["pass", "fail"]),
          remark: z.string().trim().max(500).nullable().optional(),
          coSignerName: z.string().trim().max(120).nullable().optional(),
          calibDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) =>
        persistence.submitAcceptanceTx({
          applyType: input.applyType,
          id: input.id,
          identity: acting({ ctx }),
          result: input.result,
          remark: input.remark ?? null,
          coSignerName: input.coSignerName ?? null,
          calibDueDate: input.calibDueDate ?? null,
        })
      ),
  }),

  /* ---------- 审批配置（两类角色权限模型：仅用户启用管理） ---------- */
  settings: router({
    overview: publicProcedure.query(async () => {
      const db = await getDb();
      const users = db ? await db.select().from(applyUsers).orderBy(applyUsers.id) : [];
      const flowDefs = db ? await db.select().from(approvalFlowDefs) : [];
      return { users, flowDefs };
    }),
    toggleUser: publicProcedure
      .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        requireIdentity(ctx.actingUser);
        if (ctx.actingUser!.roleKey !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅管理人员可调整申请用户状态" });
        }
        const db = await getDb();
        if (!db) throw new Error("数据库连接不可用");
        await db.update(applyUsers).set({ isActive: input.isActive }).where(eq(applyUsers.id, input.id));
      }),
  }),

  /* ---------- 站内通知 ---------- */
  notify: router({
    myNotifications: publicProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const identity = requireIdentity(ctx.actingUser);
      return db.select().from(notifications).where(eq(notifications.userId, identity.id)).orderBy(desc(notifications.createdAt)).limit(30);
    }),
    unreadCount: publicProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      const identity = requireIdentity(ctx.actingUser);
      const rows = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, identity.id), eq(notifications.isRead, false)));
      return Number(rows[0]?.count ?? 0);
    }),
    markRead: publicProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return;
      const identity = requireIdentity(ctx.actingUser);
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input.id), eq(notifications.userId, identity.id)));
    }),
    markAllRead: publicProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return;
      const identity = requireIdentity(ctx.actingUser);
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, identity.id));
    }),
  }),

  /* ---------- 设备变更履历（详情页） ---------- */
  trace: router({
    byEquipment: publicProcedure.input(z.object({ equipmentId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { changes: [], purchases: [] };
      const [changes, purchases] = await Promise.all([
        db
          .select({ id: changeApplies.id, applyNo: changeApplies.applyNo, title: changeApplies.title, changeType: changeApplies.changeType, status: changeApplies.status, estimatedFee: changeApplies.estimatedFee, submitterName: changeApplies.submitterName, createdAt: changeApplies.createdAt, closedAt: changeApplies.closedAt })
          .from(changeApplies)
          .where(eq(changeApplies.equipmentId, input.equipmentId))
          .orderBy(desc(changeApplies.createdAt))
          .limit(20),
        db
          .select({ id: purchaseApplies.id, applyNo: purchaseApplies.applyNo, title: purchaseApplies.title, buyType: purchaseApplies.buyType, status: purchaseApplies.status, budget: purchaseApplies.budget, submitterName: purchaseApplies.submitterName, createdAt: purchaseApplies.createdAt })
          .from(purchaseApplies)
          .where(or(eq(purchaseApplies.replaceEquipmentId, input.equipmentId), sql`${purchaseApplies.newEquipmentId} = ${input.equipmentId}`))
          .orderBy(desc(purchaseApplies.createdAt))
          .limit(20),
      ]);
      return { changes, purchases };
    }),
  }),
});

export type ApplyRouter = typeof applyRouter;
