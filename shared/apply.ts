/**
 * 设备申请管理（CHG 修改申请 / PUR 购买申请）前后端共享常量与类型。
 * 纯数据与纯类型，禁止引入 Node / DOM 依赖，保证两端可用。
 */

/* ---------- 角色（两类：普通人员 / 管理人员） ---------- */
export const APPLY_ROLE_KEYS = ["user", "admin"] as const;
export type ApplyRoleKey = (typeof APPLY_ROLE_KEYS)[number];

export const APPLY_ROLE_META: Record<ApplyRoleKey, { nameZh: string; nameEn: string }> = {
  user: { nameZh: "普通人员", nameEn: "Member" },
  admin: { nameZh: "管理人员", nameEn: "Administrator" },
};

/* ---------- 修改申请类型 ---------- */
export const CHANGE_TYPES = ["repair", "calib", "retrofit", "transfer", "scrap"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const CHANGE_TYPE_META: Record<ChangeType, { nameZh: string; nameEn: string; lockStatus: "maintenance" | "stopped" }> = {
  repair: { nameZh: "维修申请", nameEn: "Repair", lockStatus: "maintenance" },
  calib: { nameZh: "保养/校准申请", nameEn: "Maintenance / Calibration", lockStatus: "maintenance" },
  retrofit: { nameZh: "改造申请", nameEn: "Retrofit", lockStatus: "stopped" },
  transfer: { nameZh: "移装申请", nameEn: "Transfer", lockStatus: "stopped" },
  scrap: { nameZh: "报废申请", nameEn: "Scrap", lockStatus: "stopped" },
};

/* ---------- 购买申请类型 ---------- */
export const PURCHASE_BUY_TYPES = ["new_purchase", "replace", "capacity_expansion"] as const;
export type PurchaseBuyType = (typeof PURCHASE_BUY_TYPES)[number];

export const PURCHASE_BUY_TYPE_META: Record<PurchaseBuyType, { nameZh: string; nameEn: string }> = {
  new_purchase: { nameZh: "新购", nameEn: "New Purchase" },
  replace: { nameZh: "替换购置", nameEn: "Replacement" },
  capacity_expansion: { nameZh: "扩产增购", nameEn: "Capacity Expansion" },
};

/* ---------- 紧急程度 ---------- */
export const URGENCY_LEVELS = ["normal", "production", "shutdown"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const URGENCY_META: Record<Urgency, { nameZh: string; nameEn: string }> = {
  normal: { nameZh: "常规", nameEn: "Normal" },
  production: { nameZh: "影响产能", nameEn: "Affects Output" },
  shutdown: { nameZh: "已停线", nameEn: "Line Down" },
};

/* ---------- 单据主状态 ---------- */
export const APPLY_STATUSES = ["submitted", "approving", "approved", "executing", "pending_acceptance", "closed", "withdrawn", "rejected"] as const;
export type ApplyStatus = (typeof APPLY_STATUSES)[number];

export const APPLY_STATUS_META: Record<ApplyStatus, { nameZh: string; nameEn: string; badge: string }> = {
  submitted: { nameZh: "已提交", nameEn: "Submitted", badge: "border-sky-200 bg-sky-50 text-sky-700" },
  approving: { nameZh: "审批中", nameEn: "In Approval", badge: "border-amber-200 bg-amber-50 text-amber-700" },
  approved: { nameZh: "已批准", nameEn: "Approved", badge: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  executing: { nameZh: "执行中", nameEn: "Executing", badge: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  pending_acceptance: { nameZh: "待验收", nameEn: "Pending Acceptance", badge: "border-violet-200 bg-violet-50 text-violet-700" },
  closed: { nameZh: "已关闭", nameEn: "Closed", badge: "border-[#c9dbc4] bg-[#eef6ea] text-[#3e6a4b]" },
  withdrawn: { nameZh: "已撤回", nameEn: "Withdrawn", badge: "border-slate-200 bg-slate-50 text-slate-600" },
  rejected: { nameZh: "已驳回", nameEn: "Rejected", badge: "border-rose-200 bg-rose-50 text-rose-700" },
};

/** 主状态在进度条中的顺序（进度展示用） */
export const APPLY_STATUS_FLOW: readonly ApplyStatus[] = ["submitted", "approving", "approved", "executing", "pending_acceptance", "closed"];

/* ---------- 审批节点（单节点：管理人员审批） ---------- */
export type ApprovalNodeKey = "admin_approve";

export interface ApprovalNodeMeta {
  roleKey: ApplyRoleKey;
  nameZh: string;
  nameEn: string;
}

export const APPROVAL_NODES: Record<ApprovalNodeKey, ApprovalNodeMeta> = {
  admin_approve: { roleKey: "admin", nameZh: "管理员审批", nameEn: "Admin Approval" },
};

/* ---------- 比价规则 ---------- */
export const QUOTATION_MIN_COUNT = 3;

/* ---------- SLA（小时） ---------- */
export function slaHours(urgency: Urgency): { warn: number; escalate: number } {
  if (urgency === "shutdown") return { warn: 2, escalate: 4 };
  if (urgency === "production") return { warn: 24, escalate: 48 };
  return { warn: 24, escalate: 48 };
}

/* ---------- 单号 ---------- */
export function formatApplyNo(prefix: "CHG" | "PUR", now: Date, seq: number): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${`${seq}`.padStart(3, "0")}`;
}

/* ---------- 审批链构建（前后端共用；提交时确定，重新提交时重算） ---------- */
/** 两类角色权限模型：修改/购买申请均为单节点「管理员审批」，管理人员即可审批 */
export function buildChangeChain(): ApprovalNodeKey[] {
  return ["admin_approve"];
}

export function buildPurchaseChain(): ApprovalNodeKey[] {
  return ["admin_approve"];
}
