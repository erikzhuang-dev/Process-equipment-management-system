import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useIdentity } from "@/contexts/IdentityContext";
import { useApplyT } from "./useApplyT";
import { APPROVAL_NODES } from "@shared/apply";
import type { ApprovalNodeKey } from "@shared/apply";

const THRESHOLD_FIELDS = [
  { key: "CHG_L1", zh: "修改申请·主管直批上限", en: "Change · supervisor direct-approval cap" },
  { key: "CHG_L2", zh: "修改申请·BU负责人加签下限", en: "Change · BU-owner escalation floor" },
  { key: "CHG_GM", zh: "修改申请·总经理加签下限", en: "Change · GM escalation floor" },
  { key: "PUR_L1", zh: "购买申请·设备经理审批下限", en: "Purchase · manager approval floor" },
  { key: "PUR_L2", zh: "购买申请·总经理审批下限", en: "Purchase · GM approval floor" },
] as const;

const ROLE_ZH: Record<string, string> = {
  applicant: "申请人", equipment_admin: "设备管理员", engineer: "设备工程师", manager: "设备经理",
  bu_owner: "BU 负责人", gm: "总经理", purchaser: "采购主管", system_admin: "系统管理员",
};
const ROLE_EN: Record<string, string> = {
  applicant: "Applicant", equipment_admin: "Equipment Admin", engineer: "Engineer", manager: "Equipment Manager",
  bu_owner: "BU Owner", gm: "General Manager", purchaser: "Purchasing", system_admin: "System Admin",
};

export default function ApplySettings() {
  const t = useApplyT();
  const { current } = useIdentity();
  const overview = trpc.applications.settings.overview.useQuery();
  const updateThresholds = trpc.applications.settings.updateThresholds.useMutation({
    onSuccess: () => { toast.success(t("阈值已更新", "Thresholds updated")); overview.refetch(); },
    onError: (err) => toast.error(err.message),
  });
  const toggleUser = trpc.applications.settings.toggleUser.useMutation({
    onSuccess: () => { toast.success(t("已更新用户状态", "User status updated")); overview.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (overview.data?.thresholds) {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(overview.data.thresholds)) next[key] = String(value);
      setValues(next);
    }
  }, [overview.data]);

  const isSysAdmin = current?.roleKey === "system_admin";
  const parse = (raw: string | undefined) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">{t("审批配置", "Approval Settings")}</h1>
        <p className="text-sm text-slate-500">{t("金额阈值、流程链模板与申请用户管理（仅系统管理员可修改）", "Amount thresholds, flow templates and applicant users (system admin only)")}</p>
      </div>

      <Card className="mb-4 border-[#d9e5d6]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t("金额阈值（元）", "Amount thresholds (CNY)")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {THRESHOLD_FIELDS.map((field) => (
              <div key={field.key}>
                <Label className="text-xs">{t(field.zh, field.en)}</Label>
                <Input
                  className="h-8"
                  type="number"
                  min={0}
                  disabled={!isSysAdmin}
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-3 bg-[#4a7c59] hover:bg-[#3d6849]"
            disabled={!isSysAdmin || updateThresholds.isPending}
            onClick={() => {
              const payload: Record<string, number> = {};
              for (const field of THRESHOLD_FIELDS) {
                const num = parse(values[field.key]);
                if (num !== null) payload[field.key] = num;
              }
              if (Object.keys(payload).length === 0) { toast.error(t("请输入有效金额", "Enter valid amounts")); return; }
              updateThresholds.mutate({ values: payload });
            }}
          >
            {updateThresholds.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
            {t("保存阈值", "Save thresholds")}
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-4 border-[#d9e5d6]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t("流程链模板", "Flow templates")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(overview.data?.flowDefs ?? []).map((def) => {
            let chain: ApprovalNodeKey[] = [];
            try { chain = JSON.parse(def.chainJson) as ApprovalNodeKey[]; } catch { chain = []; }
            return (
              <div key={def.flowKey}>
                <p className="mb-1 text-xs font-semibold text-slate-600">{def.flowKey === "CHANGE" ? t("设备修改申请", "Change request") : t("设备购买申请", "Purchase request")}</p>
                <div className="flex flex-wrap items-center gap-1">
                  {chain.map((nodeKey, index) => (
                    <span key={nodeKey} className="flex items-center gap-1">
                      {index > 0 && <span className="text-slate-300">→</span>}
                      <Badge variant="outline" className="border-[#d9e5d6] bg-white font-normal">
                        {t(APPROVAL_NODES[nodeKey].nameZh, APPROVAL_NODES[nodeKey].nameEn)}
                      </Badge>
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">{def.description}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-[#d9e5d6]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t("申请用户", "Applicant users")}</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y divide-[#eef3ec]">
            {(overview.data?.users ?? []).map((user) => (
              <div key={user.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{user.name}</p>
                  <p className="text-[11px] text-slate-400">{t(ROLE_ZH[user.roleKey] ?? user.roleKey, ROLE_EN[user.roleKey] ?? user.roleKey)}</p>
                </div>
                <Switch
                  checked={user.isActive}
                  disabled={!isSysAdmin || toggleUser.isPending}
                  onCheckedChange={(checked) => toggleUser.mutate({ id: user.id, isActive: checked })}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
