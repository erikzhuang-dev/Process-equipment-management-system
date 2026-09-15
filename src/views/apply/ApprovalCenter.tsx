import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronRight, Clock3, RefreshCw, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useIdentity } from "@/contexts/IdentityContext";
import { useApplyT } from "./useApplyT";
import { APPLY_TYPE_TONE, FeeText, UrgencyBadge } from "./applyUi";
import type { Urgency } from "@shared/apply";
import { ApplyDetailDialog } from "./ApplyDetailDialog";
import { APPROVAL_NODES, CHANGE_TYPE_META, type PurchaseBuyType } from "@shared/apply";


type ApplyType = "change" | "purchase";

interface PendingRow {
  applyType: ApplyType;
  id: number;
  applyNo: string;
  title: string;
  changeType: string;
  buyType?: PurchaseBuyType;
  currentNode: string | null;
  urgency: string;
  amount: string | number;
  equipmentName: string | null;
  equipmentCode: string | null;
  submitterName: string | null;
  nodeEnteredAt: string | Date | null;
  overdue: boolean;
  warning: boolean;
}

function timeAgo(value: string | Date | null, t: (zh: string, en: string) => string): string {
  if (!value) return "--";
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return t("1 小时内", "<1h");
  if (hours < 24) return `${hours} ${t("小时", "h")}`;
  return `${Math.floor(hours / 24)} ${t("天", "d")}`;
}

function ApprovalCard({ row, onOpenDetail, onActed }: { row: PendingRow; onOpenDetail: () => void; onActed: () => void }) {
  const t = useApplyT();
  const [comment, setComment] = useState("");
  const [openForm, setOpenForm] = useState<null | "approve" | "reject">(null);
  const act = trpc.applications.approval.act.useMutation();
  const utils = trpc.useUtils();

  const submit = (action: "approve" | "reject") => {
    if (action === "reject" && comment.trim().length < 4) {
      toast.error(t("驳回意见至少 4 个字", "Reject comment must be at least 4 characters"));
      return;
    }
    act.mutate(
      { applyType: row.applyType, id: row.id, action, comment: comment.trim() || null },
      {
        onSuccess: () => {
          toast.success(t("已处理并流转", "Processed and forwarded"));
          setOpenForm(null);
          setComment("");
          onActed();
        },
        onError: (err) => toast.error(t("操作失败", "Action failed"), { description: err.message }),
      }
    );
  };

  const typeMeta = row.applyType === "change" && row.changeType ? (CHANGE_TYPE_META as Record<string, { nameZh: string; nameEn: string }>)[row.changeType] : null;

  return (
    <Card className={`border-slate-200 shadow-sm transition-shadow hover:shadow-md ${row.overdue ? "border-l-4 border-l-rose-500" : row.warning ? "border-l-4 border-l-amber-400" : ""}`}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button className="flex-1 text-left" onClick={onOpenDetail}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{row.applyNo}</span>
            {typeMeta ? (
              <Badge variant="outline" className={APPLY_TYPE_TONE[row.changeType ?? ""] ?? "border-cyan-200 bg-cyan-50 text-cyan-700"}>{t(typeMeta.nameZh, typeMeta.nameEn)}</Badge>
            ) : (
              <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">{row.buyType === "new_purchase" ? t("全新采购", "New") : row.buyType === "replace" ? t("以旧换新", "Replace") : t("扩产增购", "Expansion")}</Badge>
            )}
            <UrgencyBadge urgency={row.urgency as Urgency} />
            {(row.overdue || row.warning) && (
              <Badge className="gap-1 bg-rose-50 text-rose-600 ring-1 ring-rose-200" variant="outline">
                <AlertTriangle className="h-3 w-3" />{row.overdue ? t("已超时", "Overdue") : t("临近时限", "Due soon")}
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{row.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {row.equipmentCode ? `${row.equipmentCode} · ` : ""}{row.equipmentName}
            {" · "}{t("提交人", "By")} {row.submitterName ?? "--"}
            {" · "}<span className="inline-flex items-center gap-0.5"><Clock3 className="h-3 w-3" />{timeAgo(row.nodeEnteredAt, t)}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <div className="mr-1 text-right">
            <span className="text-sm font-bold"><FeeText value={row.amount} /></span>
            <div className="text-[11px] text-slate-400">{APPROVAL_NODES[row.currentNode as keyof typeof APPROVAL_NODES]?.nameZh ?? ""}</div>
          </div>
          {openForm ? (
            <div className="flex w-56 flex-col gap-1.5">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2}
                placeholder={openForm === "reject" ? t("驳回意见（必填，≥4 字）", "Reject reason (required)") : t("同意意见（可选）", "Comment (optional)")} />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-7 flex-1" onClick={() => submit(openForm)} disabled={act.isPending}>
                  <Check className="mr-1 h-3.5 w-3.5" />{t("确认", "OK")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setOpenForm(null); setComment(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => setOpenForm("reject")}>
                <X className="mr-1 h-3.5 w-3.5" />{t("驳回", "Reject")}
              </Button>
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setOpenForm("approve")}>
                <Check className="mr-1 h-3.5 w-3.5" />{t("同意", "Approve")}
              </Button>
              <Button size="sm" variant="ghost" onClick={onOpenDetail}><ChevronRight className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApprovalCenter() {
  const t = useApplyT();
  const { users, current } = useIdentity();
  const [tab, setTab] = useState<"pending" | "acted">("pending");
  const [roleFilter, setRoleFilter] = useState("mine");
  const [detail, setDetail] = useState<{ type: ApplyType; id: number } | null>(null);

  const pending = trpc.applications.approval.myPending.useQuery(undefined, { refetchInterval: 30000 });
  const acted = trpc.applications.approval.actedHistory.useQuery(undefined, { enabled: tab === "acted" });

  const rows: PendingRow[] = (pending.data ?? []).filter((row) => {
    if (roleFilter === "mine") return true;
    return row.currentNode === roleFilter;
  });

  const refresh = () => { void pending.refetch(); void acted.refetch(); };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("审批中心", "Approval Center")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {t("当前身份", "Acting as")}：<span className="font-medium text-emerald-700">{current?.name ?? t("未选择", "none")}</span>
            {" · "}{t("待我处理", "Pending for me")} <span className="font-bold text-rose-600">{pending.data?.length ?? 0}</span> {t("件", "items")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "pending" && (
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">{t("我的待办节点", "My nodes")}</SelectItem>
                {Object.entries(APPROVAL_NODES).map(([key, node]) => (
                  <SelectItem key={key} value={key}>{node.nameZh}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant={tab === "pending" ? "default" : "outline"} size="sm" className={tab === "pending" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={() => setTab("pending")}>{t("待我审批", "Pending")}</Button>
          <Button variant={tab === "acted" ? "default" : "outline"} size="sm" className={tab === "acted" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={() => setTab("acted")}>{t("我已审批", "Acted")}</Button>
        </div>
      </div>

      {!current && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800">
            {t("请先在左下角选择身份，再进行审批操作。", "Pick an identity at the bottom-left sidebar first.")}
          </CardContent>
        </Card>
      )}

      {tab === "pending" ? (
        <div className="flex flex-col gap-3">
          {pending.isLoading ? (
            <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-slate-400"><RefreshCw className="h-4 w-4 animate-spin" />{t("加载中...", "Loading...")}</CardContent></Card>
          ) : rows.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-slate-400">{t("太棒了，没有待审批的单据", "No pending approvals. Great job!")}</CardContent></Card>
          ) : (
            rows.map((row) => (
              <ApprovalCard key={`${row.applyType}-${row.id}`} row={row} onActed={refresh} onOpenDetail={() => setDetail({ type: row.applyType, id: row.id })} />
            ))
          )}
          <p className="text-right text-xs text-slate-400">
            {t("超时规则：紧急（停机影响）2 小时预警，普通 24 小时", "SLA: shutdown-impact 2h warn, normal 24h")} ·
            <Link href="/apply/settings" className="ml-1 text-emerald-600 hover:underline">{t("SLA 配置", "SLA settings")}</Link>
          </p>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("我的审批记录（最近 60 条）", "My approval records (latest 60)")}</CardTitle></CardHeader>
          <CardContent className="flex flex-col divide-y">
            {(acted.data ?? []).map((rec) => (
              <div key={rec.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={rec.action === "approve" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : rec.action === "reject" ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-slate-50 text-slate-500"}>
                     {{ approve: "同意", reject: "驳回", submit: "提交", resubmit: "重新提交", urge: "催办", execute: "执行", accept: "验收", close: "关闭", withdraw: "撤回" }[rec.action] ?? rec.action}
                  </Badge>
                  <span className="text-slate-600">{rec.comment || "--"}</span>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{rec.actedAt ? new Date(rec.actedAt).toLocaleString() : "--"}</span>
              </div>
            ))}
            {(acted.data ?? []).length === 0 && <div className="py-8 text-center text-sm text-slate-400">{t("暂无审批记录", "No records yet")}</div>}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t("单据详情", "Apply detail")}
            </DialogTitle>
          </DialogHeader>
          {detail && <ApplyDetailDialog applyType={detail.type} applyId={detail.id} open onOpenChange={() => setDetail(null)} onChanged={() => { refresh(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
