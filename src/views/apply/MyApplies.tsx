"use client";

/** P3 我的申请：我的/全部申请列表（CHG + PUR 合并视图），支持状态过滤、详情查看、撤回入口与驳回后重新提交。 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ClipboardList, FilePlus2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useIdentity } from "@/contexts/IdentityContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { APPLY_STATUSES, APPLY_STATUS_META, APPROVAL_NODES, type ApplyStatus } from "@shared/apply";
import { ApplyDetailDialog, ResubmitForm } from "./ApplyDetailDialog";
import { ApplyStatusBadge, ChangeTypeBadge, FeeText, OverdueBadge, PurchaseTypeBadge, StatusFlowMini, UrgencyBadge } from "./applyUi";

type Scope = "mine" | "all";
type TypeFilter = "all" | "change" | "purchase";

interface ListRow {
  kind: "change" | "purchase";
  id: number;
  applyNo: string;
  type: string;
  status: ApplyStatus;
  currentNode: string | null;
  title: string;
  fee: number | null;
  urgency: string;
  equipmentCode: string | null;
  equipmentName: string | null;
  location: string | null;
  submitterName: string | null;
  nodeEnteredAt: string;
  createdAt: string;
  overdue: boolean;
  warning: boolean;
}

function decorateRow(row: Record<string, unknown>, kind: "change" | "purchase"): ListRow {
  return {
    kind,
    id: Number(row.id),
    applyNo: String(row.applyNo),
    type: String(kind === "change" ? row.changeType : row.buyType),
    status: row.status as ApplyStatus,
    currentNode: (row.currentNode as string | null) ?? null,
    title: String(row.title),
    fee: kind === "change" ? Number(row.estimatedFee ?? 0) : Number(row.budget ?? 0),
    urgency: String(row.urgency),
    equipmentCode: (row.equipmentCode as string | null) ?? null,
    equipmentName: (row.equipmentName as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    submitterName: (row.submitterName as string | null) ?? null,
    nodeEnteredAt: String(row.nodeEnteredAt),
    createdAt: String(row.createdAt),
    overdue: Boolean(row.overdue),
    warning: Boolean(row.warning),
  };
}

export default function MyApplies() {
  const [, navigate] = useLocation();
  const { current } = useIdentity();
  const [scope, setScope] = useState<Scope>("mine");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [keyword, setKeyword] = useState("");
  const [detail, setDetail] = useState<{ type: "change" | "purchase"; id: number } | null>(null);
  const [resubmitId, setResubmitId] = useState<number | null>(null);

  const changeList = trpc.applications.change.list.useQuery({ scope, status: statusFilter === "all" ? undefined : (statusFilter as ApplyStatus), keyword: keyword.trim() || undefined });
  const purchaseList = trpc.applications.purchase.list.useQuery({ scope, status: statusFilter === "all" ? undefined : (statusFilter as ApplyStatus), keyword: keyword.trim() || undefined });

  const rows = useMemo(() => {
    const merged: ListRow[] = [];
    if (typeFilter !== "purchase") for (const row of changeList.data ?? []) merged.push(decorateRow(row as unknown as Record<string, unknown>, "change"));
    if (typeFilter !== "change") for (const row of purchaseList.data ?? []) merged.push(decorateRow(row as unknown as Record<string, unknown>, "purchase"));
    return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [changeList.data, purchaseList.data, typeFilter]);

  const myPendingCount = rows.filter(row => row.status === "approving" && row.currentNode).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button size="icon" variant="outline" aria-label="返回" className="shrink-0 border-[#d9e5d6] text-[#56745b] hover:bg-[#f0f7ec]" onClick={() => navigate("/")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-[#2c4433]"><ClipboardList className="h-5 w-5" /> 申请中心</h1>
          <p className="text-xs text-[#789079]">修改申请与购买申请统一入口；审批中的单据可催办，被驳回可修改后重新提交{myPendingCount > 0 ? ` · 进行中 ${myPendingCount} 单` : ""}</p>
        </div>
        <Button size="sm" className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" onClick={() => navigate("/apply/change/new")}><FilePlus2 className="mr-1 h-4 w-4" /> 修改申请</Button>
        <Button size="sm" variant="outline" className="border-[#4a7c59] text-[#3e6a4b] hover:bg-[#f0f7ec]" onClick={() => navigate("/apply/purchase/new")}><PackagePlus className="mr-1 h-4 w-4" /> 购买申请</Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={scope} onValueChange={value => setScope(value as Scope)}>
          <TabsList className="h-8">
            <TabsTrigger value="mine" className="h-6 text-xs">我的申请</TabsTrigger>
            <TabsTrigger value="all" className="h-6 text-xs">全部申请</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={typeFilter} onValueChange={value => setTypeFilter(value as TypeFilter)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-6 text-xs">全部类型</TabsTrigger>
            <TabsTrigger value="change" className="h-6 text-xs">修改申请</TabsTrigger>
            <TabsTrigger value="purchase" className="h-6 text-xs">购买申请</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {APPLY_STATUSES.map(status => (
              <SelectItem key={status} value={status}>{APPLY_STATUS_META[status].nameZh}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="h-8 w-52 text-xs" placeholder="搜索单号 / 标题" value={keyword} onChange={event => setKeyword(event.target.value)} />
      </div>

      <div className="space-y-2">
        {rows.length === 0 && <p className="rounded-2xl border border-dashed border-[#c9dbc4] py-14 text-center text-sm text-[#a3b2a2]">暂无申请单据</p>}
        {rows.map(row => {
          const isMine = current ? row.submitterName === current.name : false;
          return (
            <div key={`${row.kind}-${row.id}`} className={cn("rounded-2xl border bg-white px-4 py-3 transition-colors hover:border-[#b5c4b2]", row.overdue ? "border-rose-300" : "border-[#d9e5d6]")}>
              <button type="button" className="w-full text-left" onClick={() => setDetail({ type: row.kind, id: row.id })}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-[#789079]">{row.applyNo}</span>
                  {row.kind === "change" ? <ChangeTypeBadge type={row.type as never} /> : <PurchaseTypeBadge type={row.type as never} />}
                  <ApplyStatusBadge status={row.status} />
                  {row.status === "approving" && <OverdueBadge overdue={row.overdue} />}
                  {row.status === "approving" && !row.overdue && row.warning && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">接近 SLA</span>}
                  <span className="ml-auto text-xs text-[#789079]">{new Date(row.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm font-medium text-[#2c4433]">{row.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8aa28b]">
                  {row.equipmentCode && <span>{row.equipmentCode} · {row.equipmentName}{row.location ? ` · ${row.location}` : ""}</span>}
                  <span>提交人：{row.submitterName ?? "—"}</span>
                  <UrgencyBadge urgency={row.urgency as never} />
                  <FeeText value={row.fee} />
                  {row.status === "approving" && row.currentNode && (
                    <span className="text-amber-700">当前节点：{APPROVAL_NODES[row.currentNode as keyof typeof APPROVAL_NODES]?.nameZh ?? row.currentNode}</span>
                  )}
                </div>
                <div className="mt-2"><StatusFlowMini status={row.status} /></div>
              </button>
              {isMine && row.status === "rejected" && (
                <div className="mt-2 border-t border-dashed border-rose-200 pt-2">
                  {resubmitId === row.id ? (
                    <ResubmitForm applyType={row.kind} applyId={row.id} onDone={() => setResubmitId(null)} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-600">此单已被驳回</span>
                      <Button size="sm" variant="outline" className="h-7 border-rose-200 text-xs text-rose-600 hover:bg-rose-50" onClick={() => setResubmitId(row.id)}>修改后重新提交</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detail && (
        <ApplyDetailDialog
          applyType={detail.type}
          applyId={detail.id}
          open={Boolean(detail)}
          onOpenChange={open => { if (!open) setDetail(null); }}
          onChanged={() => toast.success("列表已刷新")}
        />
      )}
    </div>
  );
}
