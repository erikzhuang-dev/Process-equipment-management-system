import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Loader2, PlayCircle, ClipboardCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useIdentity } from "@/contexts/IdentityContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApplyStatusBadge, APPLY_TYPE_TONE, FeeText, UrgencyBadge } from "./applyUi";
import type { Urgency } from "@shared/apply";

const zh = {
  title: "执行跟踪",
  subtitle: "修改与购买申请的执行进度看板；完成后提交验收",
  empty: "暂无执行中的申请",
  progress: "登记进度",
  progressPh: "记录本阶段完成的工作、遇到的问题（至少 2 字）",
  submitAcceptance: "提交验收",
  needQuotation: "购买申请需先在详情中选定中标报价，再提交验收",
  filter: "仅看修改申请",
  refresh: "刷新",
  all: "全部",
  hint: "请先在左下角选择身份（管理人员）以执行操作。",
  goMine: "前往我的申请",
};

const en: Record<keyof typeof zh, string> = {
  title: "Execution Board",
  subtitle: "Track executing change & purchase requests; submit for acceptance when done",
  empty: "No executing requests",
  progress: "Log progress",
  progressPh: "Describe completed work or issues (min 2 chars)",
  submitAcceptance: "Submit for acceptance",
  needQuotation: "Select the winning quotation in detail before submitting",
  filter: "Change requests only",
  refresh: "Refresh",
  all: "All",
  hint: "Pick an identity (administrator) at the sidebar footer first.",
  goMine: "Go to my requests",
};

export default function ExecutionBoard() {
  const { language } = useLanguage();
  const t = (k: keyof typeof zh) => (language === "en" ? en[k] : zh[k]);
  const [, navigate] = useLocation();
  const { current } = useIdentity();
  const [typeFilter, setTypeFilter] = useState<"all" | "change">("all");
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const changeQ = trpc.applications.change.list.useQuery({ scope: "all", status: "executing" });
  const purchaseQ = trpc.applications.purchase.list.useQuery({ scope: "all", status: "executing" });

  const push = trpc.applications.execution.pushProgress.useMutation({
    onSuccess: (_res, vars) => {
      toast.success("进度已登记");
      setNote("");
      setNoteFor(null);
      if (vars.applyType === "change") changeQ.refetch();
      else purchaseQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const submitAcceptance = trpc.applications.execution.submitForAcceptance.useMutation({
    onSuccess: () => {
      toast.success("已提交验收，等待验收人处理");
      changeQ.refetch();
      purchaseQ.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  type Row = {
    type: "change" | "purchase";
    id: number;
    applyNo: string;
    title: string;
    typeKey: string;
    urgency: string;
    amount: number;
    equipmentCode: string | null;
    equipmentName: string | null;
    nodeEnteredAt: string | Date | null;
  };
  const rows = useMemo<Row[]>(() => {
    const c = (changeQ.data ?? []).map((r: any) => ({
      type: "change" as const, id: r.id, applyNo: r.applyNo, title: r.title,
      typeKey: r.changeType as string, urgency: r.urgency as string,
      amount: r.estimatedFee, equipmentCode: r.equipmentCode, equipmentName: null,
      nodeEnteredAt: r.updatedAt as string | Date | null,
    }));
    const p = (purchaseQ.data ?? []).map((r: any) => ({
      type: "purchase" as const, id: r.id, applyNo: r.applyNo, title: r.title,
      typeKey: r.buyType as string, urgency: r.urgency as string,
      amount: r.budget, equipmentCode: null, equipmentName: r.equipmentName,
      nodeEnteredAt: r.updatedAt as string | Date | null,
    }));
    return typeFilter === "change" ? c : [...c, ...p].sort((a, b) => a.nodeEnteredAt ? new Date(a.nodeEnteredAt).getTime() : 0 - (b.nodeEnteredAt ? new Date(b.nodeEnteredAt).getTime() : 0));
  }, [changeQ.data, purchaseQ.data, typeFilter]);

  const acting = current !== null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant={typeFilter === "all" ? "default" : "outline"} className={typeFilter === "all" ? "bg-[#4a7c59]" : "border-[#d9e5d6]"} onClick={() => setTypeFilter("all")}>
          {t("all")}
        </Button>
        <Button size="sm" variant={typeFilter === "change" ? "default" : "outline"} className={typeFilter === "change" ? "bg-[#4a7c59]" : "border-[#d9e5d6]"} onClick={() => setTypeFilter("change")}>
          {t("filter")}
        </Button>
        <span className="ml-auto text-xs text-slate-400">{rows.length} 项</span>
      </div>

      {!acting && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t("hint")}
        </p>
      )}

      {rows.length === 0 && <EmptyState text={t("empty")} />}

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={`${row.type}-${row.id}`} className="border-[#d9e5d6]">
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <span className="font-mono text-xs text-slate-500">{row.applyNo}</span>
                <Badge variant="outline" className={APPLY_TYPE_TONE[row.typeKey] ?? "border-slate-200"}>{row.typeKey}</Badge>
                {row.title}
                <UrgencyBadge urgency={row.urgency as Urgency} />
                <span className="ml-auto text-sm font-bold text-[#4a7c59]"><FeeText value={row.amount} /></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {row.equipmentCode && <p className="text-xs text-slate-500">设备：{row.equipmentCode}</p>}
              {row.equipmentName && <p className="text-xs text-slate-500">采购内容：{row.equipmentName}</p>}

              {noteFor === row.id ? (
                <div className="space-y-2">
                  <Textarea className="min-h-[64px]" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("progressPh")} />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#4a7c59] hover:bg-[#3d6849]" disabled={push.isPending || note.trim().length < 2}
                      onClick={() => push.mutate({ applyType: row.type, id: row.id, note: note.trim() })}>
                      {push.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <PlayCircle className="mr-1 h-4 w-4" />}
                      {t("progress")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>取消</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="border-[#d9e5d6]" disabled={!acting} onClick={() => { setNoteFor(row.id); setNote(""); }}>
                    <PlayCircle className="mr-1 h-4 w-4" />
                    {t("progress")}
                  </Button>
                  <Button size="sm" className="bg-[#4a7c59] hover:bg-[#3d6849]" disabled={!acting || submitAcceptance.isPending}
                    onClick={() => submitAcceptance.mutate({ applyType: row.type, id: row.id })}>
                    {submitAcceptance.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ClipboardCheck className="mr-1 h-4 w-4" />}
                    {t("submitAcceptance")}
                  </Button>
                  {row.type === "purchase" && (
                    <span className="self-center text-[11px] text-slate-400">{t("needQuotation")}</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" className="text-[#4a7c59]" onClick={() => navigate("/apply/mine")}>
          {t("goMine")}
        </Button>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-slate-800">{title}</h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9e5d6] bg-[#f6faf5] px-6 py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

