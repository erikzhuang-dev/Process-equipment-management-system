"use client";

/** P2 设备购买申请发起页：单页长表单（购买类型驱动的条件字段）+ 实时审批链预览。 */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, FileText, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { buildPurchaseChain, PURCHASE_BUY_TYPE_META, PURCHASE_BUY_TYPES, type PurchaseBuyType, type Urgency, APPROVAL_NODES } from "@shared/apply";
import { NodeChainProgress, formatFee } from "./applyUi";

export default function PurchaseApplyNew() {
  const [, navigate] = useLocation();
  const trpcUtils = trpc.useUtils();
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const presetReplaceCode = search.get("replaceCode") ?? "";

  const [values, setValues] = useState({
    buyType: "new_purchase" as PurchaseBuyType,
    equipmentName: "",
    modelSpec: "",
    quantity: "1",
    budget: "",
    urgency: "normal" as Urgency,
    reason: "",
    replaceEquipmentCode: presetReplaceCode,
    existingStatus: "",
    expectedBuId: "",
    monthlyOutputGain: "",
  });

  const equipmentList = trpc.equipment.list.useQuery({ page: 1, pageSize: 200 });
  const businessUnits = trpc.equipment.masterData.useQuery();
  const create = trpc.applications.purchase.create.useMutation({
    onSuccess: result => {
      trpcUtils.applications.purchase.list.invalidate();
      toast.success("申请已提交", { description: `单号 ${result.applyNo}，已进入「${APPROVAL_NODES[result.chain[0]].nameZh}」` });
      navigate("/apply/mine");
    },
    onError: error => toast.error("提交失败", { description: error.message }),
  });

  const budget = Number(values.budget) || 0;
  const chain = useMemo(() => buildPurchaseChain(), []);

  const replaceMatch = useMemo(() => {
    const kw = values.replaceEquipmentCode.trim().toLowerCase();
    if (!kw) return null;
    return (equipmentList.data?.items ?? []).find(row => row.code.toLowerCase() === kw || row.code.toLowerCase().includes(kw)) ?? null;
  }, [equipmentList.data, values.replaceEquipmentCode]);

  const validate = (): string | null => {
    if (values.equipmentName.trim().length < 2) return "请填写设备名称";
    if (budget <= 0) return "请填写预算金额";
    if (values.reason.trim().length < 10) return "购买理由至少 10 个字";
    if (values.buyType === "replace") {
      if (!values.replaceEquipmentCode.trim()) return "替换购置需填写被替换设备编码";
      if (!replaceMatch) return "被替换设备编码未匹配到台账设备，请核对";
      if (!values.existingStatus.trim()) return "替换购置需填写被替换设备现状";
    }
    if (values.buyType === "capacity_expansion" && !values.expectedBuId) return "扩产增购需选择投产 BU";
    return null;
  };

  const submit = () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    const quantity = Number(values.quantity) || 1;
    const typeLabel = PURCHASE_BUY_TYPE_META[values.buyType].nameZh;
    create.mutate({
      buyType: values.buyType,
      title: `${values.equipmentName.trim()} · ${typeLabel}${quantity > 1 ? ` × ${quantity}` : ""}`,
      buId: values.buyType === "capacity_expansion" ? Number(values.expectedBuId) : null,
      replaceEquipmentId: values.buyType === "replace" && replaceMatch ? replaceMatch.id : null,
      equipmentName: values.equipmentName.trim(),
      modelSpec: values.modelSpec.trim() || null,
      quantity,
      budget,
      urgency: values.urgency,
      reason: values.reason.trim(),
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-[#2c4433]">发起设备购买申请</h1>
          <p className="text-xs text-[#789079]">新购 / 替换 / 扩产增购，提交后进入 BU 负责人审批；采购阶段需完成至少 3 家比价</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* 类型三选一 */}
        <div className="grid grid-cols-3 gap-2">
          {PURCHASE_BUY_TYPES.map(type => (
            <button key={type} type="button" onClick={() => setValues(v => ({ ...v, buyType: type }))}
              className={cn("rounded-xl border px-2 py-3 text-center text-sm transition-colors", values.buyType === type ? "border-[#4a7c59] bg-[#f0f7ec] font-semibold text-[#2c4433]" : "border-[#d9e5d6] bg-white text-[#4c6350] hover:border-[#b5c4b2]")}>
              {PURCHASE_BUY_TYPE_META[type].nameZh}
              <span className="mt-0.5 block text-[10px] text-[#8aa28b]">{type === "new_purchase" ? "新增产能设备" : type === "replace" ? "替换故障/老化设备" : "同型号增购"}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">设备名称 *</Label><Input value={values.equipmentName} onChange={event => setValues(v => ({ ...v, equipmentName: event.target.value }))} placeholder="如：全自动灌装机" /></div>
          <div><Label className="text-xs">型号规格</Label><Input value={values.modelSpec} onChange={event => setValues(v => ({ ...v, modelSpec: event.target.value }))} placeholder="如：GZ-450 / 不锈钢 316L" /></div>
          <div><Label className="text-xs">数量 *</Label><Input type="number" min="1" value={values.quantity} onChange={event => setValues(v => ({ ...v, quantity: event.target.value }))} /></div>
          <div><Label className="text-xs">预算（元）* <span className="text-[#789079]">¥{formatFee(budget)}</span></Label><Input type="number" min="0" value={values.budget} onChange={event => setValues(v => ({ ...v, budget: event.target.value }))} /></div>
          <div><Label className="text-xs">紧急程度 *</Label>
            <Select value={values.urgency} onValueChange={value => setValues(v => ({ ...v, urgency: value as Urgency }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">常规</SelectItem>
                <SelectItem value="production">影响产能</SelectItem>
                <SelectItem value="shutdown">已停线（急购）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label className="text-xs">购买理由 / 用途 *（至少 10 字）</Label><Textarea rows={3} value={values.reason} onChange={event => setValues(v => ({ ...v, reason: event.target.value }))} placeholder="说明产能缺口、替代方案对比、投资回收预期…" /></div>

          {values.buyType === "replace" && (
            <>
              <div className="relative">
                <Label className="text-xs">被替换设备编码 *</Label>
                <Input value={values.replaceEquipmentCode} onChange={event => setValues(v => ({ ...v, replaceEquipmentCode: event.target.value }))} placeholder="如 PEM-VAL-001" />
                {replaceMatch && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-[#4d8154]"><Search className="h-3 w-3" /> 已匹配：{replaceMatch.name}（{replaceMatch.location}）</p>
                )}
              </div>
              <div><Label className="text-xs">被替换设备现状 *</Label><Input value={values.existingStatus} onChange={event => setValues(v => ({ ...v, existingStatus: event.target.value }))} placeholder="如：故障停机 3 个月，维修成本高于更换" /></div>
            </>
          )}
          {values.buyType === "capacity_expansion" && (
            <>
              <div><Label className="text-xs">投产 BU *</Label>
                <Select value={values.expectedBuId} onValueChange={value => setValues(v => ({ ...v, expectedBuId: value }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="选择投产 BU" /></SelectTrigger>
                  <SelectContent>
                    {(businessUnits.data?.businessUnits ?? []).map(bu => (
                      <SelectItem key={bu.id} value={String(bu.id)}>{bu.code} · {bu.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">预计月增产能</Label><Input value={values.monthlyOutputGain} onChange={event => setValues(v => ({ ...v, monthlyOutputGain: event.target.value }))} placeholder="如：+12 万件/月" /></div>
            </>
          )}
        </div>

        {/* 实时链预览 */}
        <Card className="border-[#d9e5d6]">
          <CardContent className="p-4">
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#789079]"><FileText className="h-3.5 w-3.5" /> 提交后审批流</p>
            <NodeChainProgress chain={chain} currentNode={chain[0]} status="approving" />
            <p className="mt-2 text-xs text-[#8aa28b]">
              购买申请由管理人员统一审批；执行阶段须录入并选定报价（≥ 3 家方可提交验收）。
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 flex justify-end">
        <Button className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={create.isPending} onClick={submit}>
          {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} 提交申请
        </Button>
      </div>
    </div>
  );
}
