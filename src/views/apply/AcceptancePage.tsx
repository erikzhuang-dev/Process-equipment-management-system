import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useIdentity } from "@/contexts/IdentityContext";
import { useApplyT } from "./useApplyT";
import { APPLY_TYPE_TONE, FeeText, UrgencyBadge } from "./applyUi";
import type { Urgency } from "@shared/apply";

export default function AcceptancePage() {
  const t = useApplyT();
  const [, navigate] = useLocation();
  const { current } = useIdentity();
  const changeQ = trpc.applications.change.list.useQuery({ scope: "all", status: "pending_acceptance" });
  const purchaseQ = trpc.applications.purchase.list.useQuery({ scope: "all", status: "pending_acceptance" });

  const rows = [
    ...(changeQ.data ?? []).map((r: any) => ({
      type: "change" as const, id: r.id, applyNo: r.applyNo, title: r.title,
      typeKey: r.changeType as string, urgency: r.urgency as string, amount: r.estimatedFee,
      equipmentCode: r.equipmentCode as string | null, equipmentName: null as string | null, updatedAt: r.updatedAt,
    })),
    ...(purchaseQ.data ?? []).map((r: any) => ({
      type: "purchase" as const, id: r.id, applyNo: r.applyNo, title: r.title,
      typeKey: r.buyType as string, urgency: r.urgency as string, amount: r.budget,
      equipmentCode: null as string | null, equipmentName: r.equipmentName, updatedAt: r.updatedAt,
    })),
  ];

  const acting = current !== null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">{t("验收工作台", "Acceptance")}</h1>
        <p className="text-sm text-slate-500">{t("待验收的执行成果确认；通过后回写台账（购买申请自动建档）", "Confirm executed work; closing writes back to the equipment ledger")}</p>
      </div>

      {!acting && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {t("请先在左下角选择身份（管理人员）再验收。", "Pick an identity first (administrator).")}
        </p>
      )}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#d9e5d6] bg-[#f6faf5] px-6 py-12 text-center text-sm text-slate-400">
          {t("暂无待验收申请", "Nothing pending acceptance")}
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <AcceptanceCard key={`${row.type}-${row.id}`} row={row} disabled={!acting} onChanged={() => { changeQ.refetch(); purchaseQ.refetch(); }} onOpenDetail={() => navigate(`/apply/mine?applyId=${row.id}&type=${row.type}`)} />
        ))}
      </div>
    </div>
  );
}

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
  updatedAt: string | Date | null;
};

function AcceptanceCard({ row, disabled, onChanged, onOpenDetail }: { row: Row; disabled: boolean; onChanged: () => void; onOpenDetail: () => void }) {
  const t = useApplyT();
  const [result, setResult] = useState<"pass" | "fail">("pass");
  const [remark, setRemark] = useState("");
  const [coSignerName, setCoSignerName] = useState("");
  const [calibDueDate, setCalibDueDate] = useState("");
  const submit = trpc.applications.acceptance.submit.useMutation({
    onSuccess: (res) => {
      toast.success(res?.closed ? t("验收通过，台账已回写，单据关闭", "Accepted; ledger updated and request closed") : t("验收不通过，已退回执行阶段", "Rejected; sent back to execution"));
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="border-[#d9e5d6]">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-xs text-slate-500">{row.applyNo}</span>
          <Badge variant="outline" className={APPLY_TYPE_TONE[row.typeKey] ?? "border-slate-200"}>{row.typeKey}</Badge>
          {row.title}
          <UrgencyBadge urgency={row.urgency as Urgency} />
          <span className="ml-auto text-sm font-bold text-[#4a7c59]"><FeeText value={row.amount} /></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(row.equipmentCode || row.equipmentName) && (
          <p className="text-xs text-slate-500">{row.equipmentCode ? `设备：${row.equipmentCode}` : `采购内容：${row.equipmentName}`}</p>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant={result === "pass" ? "default" : "outline"} className={result === "pass" ? "bg-[#4a7c59]" : "border-[#d9e5d6]"} onClick={() => setResult("pass")}>
            <CheckCircle2 className="mr-1 h-4 w-4" />
            {t("验收通过", "Pass")}
          </Button>
          <Button size="sm" variant={result === "fail" ? "destructive" : "outline"} className={result === "fail" ? "" : "border-[#d9e5d6]"} onClick={() => setResult("fail")}>
            <XCircle className="mr-1 h-4 w-4" />
            {t("验收不通过", "Fail")}
          </Button>
        </div>

        {result === "pass" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">{t("共同验收人（选填）", "Co-signer (optional)")}</Label>
              <Input className="h-8" value={coSignerName} onChange={(event) => setCoSignerName(event.target.value)} placeholder={t("双签留痕", "Dual-sign record")} />
            </div>
            {row.type === "change" && row.typeKey === "calib" && (
              <div>
                <Label className="text-xs">{t("下次校准日期 *", "Next calibration date *")}</Label>
                <Input className="h-8" type="date" value={calibDueDate} onChange={(event) => setCalibDueDate(event.target.value)} />
              </div>
            )}
          </div>
        )}

        <div>
          <Label className="text-xs">{t("验收意见", "Remark")}</Label>
          <Textarea className="min-h-[56px]" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder={result === "pass" ? t("确认执行成果符合申请方案", "Confirm the result matches the plan") : t("说明不合格项与整改要求", "Describe what failed and required fixes")} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className={result === "pass" ? "bg-[#4a7c59] hover:bg-[#3d6849]" : ""}
            variant={result === "pass" ? "default" : "destructive"}
            disabled={disabled || submit.isPending || (result === "fail" && remark.trim().length < 4) || (result === "pass" && row.type === "change" && row.typeKey === "calib" && !calibDueDate)}
            onClick={() =>
              submit.mutate({
                applyType: row.type,
                id: row.id,
                result,
                remark: remark.trim() || null,
                coSignerName: coSignerName.trim() || null,
                calibDueDate: row.type === "change" && row.typeKey === "calib" && calibDueDate ? calibDueDate : null,
              })
            }
          >
            {submit.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            {t("提交验收结论", "Submit acceptance")}
          </Button>
          <Button size="sm" variant="ghost" onClick={onOpenDetail}>{t("查看申请详情", "Open detail")}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
