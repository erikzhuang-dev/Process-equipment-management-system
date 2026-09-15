/**
 * 审批流引擎（纯函数）：状态机推进、比价拦截、超时判断。
 * 链构建函数在 shared/apply.ts（前后端共用），此处 re-export。
 * 不依赖 DB，可被单元测试直接覆盖。
 */
import {
  APPROVAL_NODES,
  APPLY_STATUS_FLOW,
  CHANGE_TYPE_META,
  HEAVY_CHANGE_TYPES,
  QUOTATION_MIN_COUNT,
  THRESHOLD_META,
  slaHours,
  type ApplyRoleKey,
  type ApplyStatus,
  type ApprovalNodeKey,
  type ChangeType,
  type Thresholds,
  type Urgency,
} from "../shared/apply";

export { buildChangeChain, buildPurchaseChain, THRESHOLD_META, QUOTATION_MIN_COUNT, APPROVAL_NODES, slaHours } from "../shared/apply";

/** 单据编号：CHG-20250101-001 / PUR-20250101-001 */
export function formatApplyNo(prefix: "CHG" | "PUR", date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${String(seq).padStart(3, "0")}`;
}

export { DEFAULT_THRESHOLDS } from "../shared/apply";

/**
 * 购买申请审批链（固定一级）：负责人审批 → 工程师评审（选型）→ 采购主管（比价确认）
 */
/** 链序列化 / 反序列化（存库为 JSON 文本） */
export function serializeChain(chain: ApprovalNodeKey[]): string {
  return JSON.stringify(chain);
}

export function parseChain(raw: string | null | undefined): ApprovalNodeKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is ApprovalNodeKey => typeof key === "string" && key in APPROVAL_NODES);
  } catch {
    return [];
  }
}

/** 节点准入角色 */
export function nodeRoleKey(node: ApprovalNodeKey): ApplyRoleKey {
  return APPROVAL_NODES[node].roleKey;
}

/** 比价硬拦截：采购主管节点通过前必须已有 ≥3 家报价 */
export function isQuotationComplete(quotationCount: number): boolean {
  return Number(quotationCount) >= QUOTATION_MIN_COUNT;
}

/** 单据当前是否处于某节点的审批等待中 */
export function isAwaitingNode(input: { status: ApplyStatus; currentNode: string | null; node: ApprovalNodeKey }): boolean {
  return input.status === "approving" && input.currentNode === input.node;
}

/** 超时判断：当前节点停留时间超过 SLA 升级阈值 */
export function isNodeOverdue(input: { nodeEnteredAt: Date | string; urgency: Urgency; now?: Date }): boolean {
  const entered = new Date(input.nodeEnteredAt).getTime();
  if (Number.isNaN(entered)) return false;
  const now = (input.now ?? new Date()).getTime();
  const { escalate } = slaHours(input.urgency);
  return now - entered >= escalate * 3600 * 1000;
}

/** 预警判断：接近 SLA（提醒催办） */
export function isNodeWarning(input: { nodeEnteredAt: Date | string; urgency: Urgency; now?: Date }): boolean {
  const entered = new Date(input.nodeEnteredAt).getTime();
  if (Number.isNaN(entered)) return false;
  const now = (input.now ?? new Date()).getTime();
  const { warn, escalate } = slaHours(input.urgency);
  return now - entered >= warn * 3600 * 1000 && now - entered < escalate * 3600 * 1000;
}

/** 审批通过后推进到的下一个节点；返回 null 表示链走完 */
export function nextNode(chain: ApprovalNodeKey[], currentIndex: number): ApprovalNodeKey | null {
  const next = chain[currentIndex + 1];
  return next ?? null;
}

/** 驳回回退目标：回退到链中指定节点（默认回申请人重新提交） */
export function rejectTargetIndex(chain: ApprovalNodeKey[], currentNode: ApprovalNodeKey | null): number {
  if (!currentNode) return -1;
  return Math.max(chain.indexOf(currentNode), 0);
}

/** 验收通过后的设备状态恢复值（修改申请） */
export function restoredStatusFor(changeType: ChangeType): "running" | "scrapped" {
  return changeType === "scrap" ? "scrapped" : "running";
}

/** 申请锁定设备状态（创建单据时写入） */
export function lockStatusFor(changeType: ChangeType) {
  return CHANGE_TYPE_META[changeType].lockStatus;
}

/** 阈值键 → 单位 */
export function thresholdUnit(key: keyof Thresholds): string {
  return key.startsWith("CHG") ? "万元" : "万元";
}
