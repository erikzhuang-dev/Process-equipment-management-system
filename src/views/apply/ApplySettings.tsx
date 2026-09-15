import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useIdentity } from "@/contexts/IdentityContext";
import { useApplyT } from "./useApplyT";
import { APPROVAL_NODES } from "@shared/apply";
import type { ApprovalNodeKey } from "@shared/apply";

const ROLE_ZH: Record<string, string> = {
  user: "普通人员", admin: "管理人员",
};
const ROLE_EN: Record<string, string> = {
  user: "Member", admin: "Administrator",
};

export default function ApplySettings() {
  const t = useApplyT();
  const { current } = useIdentity();
  const overview = trpc.applications.settings.overview.useQuery();
  const toggleUser = trpc.applications.settings.toggleUser.useMutation({
    onSuccess: () => { toast.success(t("已更新用户状态", "User status updated")); overview.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const isAdmin = current?.roleKey === "admin";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">{t("审批配置", "Approval Settings")}</h1>
        <p className="text-sm text-slate-500">{t("审批流程与申请用户管理（权限仅两类：普通人员 / 管理人员，管理人员可审批）", "Flow templates and applicant users (roles: member / administrator; administrators approve)")}</p>
      </div>

      <Card className="mb-4 border-[#d9e5d6]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t("审批流程模板", "Approval flow templates")}</CardTitle></CardHeader>
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
                  disabled={!isAdmin || toggleUser.isPending}
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
