"use client";

/** 申请域共享展示组件：状态徽章 / 类型徽章 / 节点进度条 / 金额格式化。 */
import { cn } from "@/lib/utils";
import {
  APPLY_STATUS_FLOW,
  APPLY_STATUS_META,
  APPROVAL_NODES,
  CHANGE_TYPE_META,
  PURCHASE_BUY_TYPE_META,
  URGENCY_META,
  type ApprovalNodeKey,
  type ApplyStatus,
  type ChangeType,
  type PurchaseBuyType,
  type Urgency,
} from "@shared/apply";

export function formatFee(value: number | string | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function ApplyStatusBadge({ status }: { status: ApplyStatus }) {
  const meta = APPLY_STATUS_META[status];
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", meta.badge)}>{meta.nameZh}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const cls = urgency === "shutdown" ? "border-rose-200 bg-rose-50 text-rose-700" : urgency === "production" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", cls)}>{URGENCY_META[urgency].nameZh}</span>;
}

export function ChangeTypeBadge({ type }: { type: ChangeType }) {
  const cls: Record<ChangeType, string> = {
    repair: "border-sky-200 bg-sky-50 text-sky-700",
    calib: "border-teal-200 bg-teal-50 text-teal-700",
    retrofit: "border-indigo-200 bg-indigo-50 text-indigo-700",
    transfer: "border-orange-200 bg-orange-50 text-orange-700",
    scrap: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", cls[type])}>{CHANGE_TYPE_META[type].nameZh}</span>;
}

export function PurchaseTypeBadge({ type }: { type: PurchaseBuyType }) {
  const cls: Record<PurchaseBuyType, string> = {
    new_purchase: "border-emerald-200 bg-emerald-50 text-emerald-700",
    replace: "border-amber-200 bg-amber-50 text-amber-700",
    capacity_expansion: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs", cls[type])}>{PURCHASE_BUY_TYPE_META[type].nameZh}</span>;
}

/** 节点审批链步骤条：已完成 / 当前 / 未到 */
export function NodeChainProgress({ chain, currentNode, status }: { chain: ApprovalNodeKey[]; currentNode: string | null; status: ApplyStatus }) {
  const done = status === "closed" || status === "pending_acceptance";
  const currentIndex = currentNode ? chain.indexOf(currentNode as ApprovalNodeKey) : -1;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chain.map((node, index) => {
        const isDone = done || (currentIndex >= 0 && index < currentIndex);
        const isCurrent = status === "approving" && currentNode === node;
        const meta = APPROVAL_NODES[node];
        return (
          <span key={`${node}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <span className="text-[#b5c4b2]">→</span>}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
                isCurrent && "border-amber-300 bg-amber-100 text-amber-800 shadow-[0_0_0_2px_rgba(252,211,77,.35)]",
                !isDone && !isCurrent && "border-slate-200 bg-white text-slate-400"
              )}
            >
              {meta.nameZh}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** 主状态迷你进度（列表行用） */
export function StatusFlowMini({ status }: { status: ApplyStatus }) {
  const flowIndex = APPLY_STATUS_FLOW.indexOf(status);
  if (flowIndex < 0) {
    const closedMeta = status === "withdrawn" || status === "rejected";
    return <span className={cn("text-[11px]", closedMeta ? "text-slate-400" : "text-rose-500")}>{APPLY_STATUS_META[status].nameZh}</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {APPLY_STATUS_FLOW.map((item, index) => (
        <span key={item} title={APPLY_STATUS_META[item].nameZh}
          className={cn("h-1.5 rounded-full transition-all", index < flowIndex ? "w-5 bg-emerald-400" : index === flowIndex ? "w-8 bg-amber-400" : "w-5 bg-slate-200")} />
      ))}
    </div>
  );
}

export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">已超时</span>;
}

export function FeeText({ value, prefix }: { value: number | string | null | undefined; prefix?: string }) {
  return (
    <span className="tabular-nums font-medium">
      {prefix ? `${prefix} ` : ""}¥{formatFee(value)}
    </span>
  );
}

/** 设备状态中文（6 态，申请域展示用） */
export const EQUIPMENT_STATUS_ZH: Record<string, string> = {
  running: "运行中",
  stopped: "停机",
  maintenance: "维修/保养中",
  calibrating: "保养/校准中",
  pending_acceptance: "待验收",
  scrapped: "已报废",
};

// 申请类型色板（审批中心/列表卡片徽章）
export const APPLY_TYPE_TONE: Record<string, string> = {
  repair: "border-rose-200 bg-rose-50 text-rose-700",
  calib: "border-cyan-200 bg-cyan-50 text-cyan-700",
  retrofit: "border-amber-200 bg-amber-50 text-amber-700",
  transfer: "border-indigo-200 bg-indigo-50 text-indigo-700",
  scrap: "border-slate-300 bg-slate-100 text-slate-600",
  new: "border-emerald-200 bg-emerald-50 text-emerald-700",
  replace: "border-orange-200 bg-orange-50 text-orange-700",
  new_purchase: "border-emerald-200 bg-emerald-50 text-emerald-700",
  capacity_expansion: "border-violet-200 bg-violet-50 text-violet-700",
};
