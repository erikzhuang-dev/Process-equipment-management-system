import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { calculateEquipmentAmounts, displayOee } from "../lib/equipmentDetail";
import { Activity, ArrowLeft, BarChart3, Building2, CalendarClock, CircleDollarSign, Factory, Gauge, Pencil, ShieldCheck, UserRound, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";

const empty = "—";
const statusLabel = { running: "运行中", stopped: "停机", maintenance: "维修中", scrapped: "报废" } as const;

function dateValue(value: Date | string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function toDate(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function DetailCell({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="rounded-2xl border border-[#e0eadc] bg-[#fbfdf9] p-4"><p className="text-xs font-medium tracking-wide text-[#7c8c7b]">{label}</p><p className="mt-2 break-words text-base font-semibold text-[#314a36]">{value === null || value === undefined || value === "" ? empty : value}</p></div>;
}

function DetailEditor({ item, businessUnits, factories, suppliers, onClose }: { item: any; businessUnits: any[]; factories: any[]; suppliers: any[]; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState(() => ({
    name: item.name ?? "", model: item.model ?? "", specification: item.specification ?? "", process: item.process ?? "", location: item.location ?? "", supplier: item.supplier ?? "", supplierId: item.supplierId ? String(item.supplierId) : "none", businessUnitId: item.businessUnitId ? String(item.businessUnitId) : "none", factoryId: item.factoryId ? String(item.factoryId) : "none", assetCategory: item.assetCategory ?? "", criticality: item.criticality ?? "none", responsibleOwner: item.responsibleOwner ?? "", commissionedAt: dateValue(item.commissionedAt), warrantyExpiresAt: dateValue(item.warrantyExpiresAt), hourlyCapacity: item.hourlyCapacity ?? "", oee: item.oee ?? "", energyConsumption: item.energyConsumption ?? "", quantity: item.quantity ?? "", unitPrice: item.unitPrice ?? "", depreciationYears: item.depreciationYears ?? "", lossFactor: item.lossFactor ?? "", investmentIncluded: Boolean(item.investmentIncluded), lowOeeReason: item.lowOeeReason ?? "", notes: item.notes ?? "",
  }));
  const update = trpc.equipment.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.equipment.detail.invalidate({ id: item.id }), utils.equipment.list.invalidate(), utils.equipment.export.invalidate(), utils.dashboard.metrics.invalidate()]);
      toast.success("设备详情已保存");
      onClose();
    },
    onError: error => toast.error(error.message || "设备详情保存失败"),
  });
  const selectedBusinessUnitId = draft.businessUnitId === "none" ? null : Number(draft.businessUnitId);
  const availableFactories = factories.filter(factory => selectedBusinessUnitId === null || factory.businessUnitId === null || factory.businessUnitId === selectedBusinessUnitId);
  const numeric = (value: string | number) => value === "" ? null : Number(value);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const selectedSupplier = suppliers.find(supplier => String(supplier.id) === draft.supplierId);
    update.mutate({ id: item.id, values: {
      name: draft.name, model: draft.model, specification: draft.specification, process: draft.process, location: draft.location,
      supplierId: selectedSupplier ? selectedSupplier.id : null, supplier: selectedSupplier?.name ?? draft.supplier,
      businessUnitId: draft.businessUnitId === "none" ? null : Number(draft.businessUnitId), factoryId: draft.factoryId === "none" ? null : Number(draft.factoryId),
      assetCategory: draft.assetCategory, criticality: draft.criticality === "none" ? null : draft.criticality as "A" | "B" | "C", responsibleOwner: draft.responsibleOwner,
      commissionedAt: toDate(draft.commissionedAt), warrantyExpiresAt: toDate(draft.warrantyExpiresAt), hourlyCapacity: numeric(draft.hourlyCapacity), oee: numeric(draft.oee), energyConsumption: numeric(draft.energyConsumption), quantity: numeric(draft.quantity), unitPrice: numeric(draft.unitPrice), depreciationYears: numeric(draft.depreciationYears), lossFactor: numeric(draft.lossFactor), investmentIncluded: draft.investmentIncluded, lowOeeReason: draft.lowOeeReason, notes: draft.notes,
    } });
  };
  const textField = (label: string, key: keyof typeof draft, type = "text") => <label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">{label}</span><Input type={type} value={draft[key] as string | number} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} className="border-[#d9e5d6] bg-white" /></label>;
  return <form onSubmit={submit} className="industrial-card space-y-5 p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#26392a]">编辑设备详情</h2><p className="mt-1 text-xs text-[#829081]">保存后会刷新台账、详情、仪表盘与导出数据。</p></div><Button type="button" variant="outline" onClick={onClose}>取消</Button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{textField("名称", "name")}{textField("型号", "model")}{textField("规格", "specification")}{textField("所属工序", "process")}{textField("位置", "location")}<label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">所属 BU</span><Select value={draft.businessUnitId} onValueChange={value => setDraft(current => ({ ...current, businessUnitId: value, factoryId: "none" }))}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择 BU</SelectItem>{businessUnits.map(unit => <SelectItem key={unit.id} value={String(unit.id)}>{unit.code} · {unit.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">工厂</span><Select value={draft.factoryId} onValueChange={value => setDraft(current => ({ ...current, factoryId: value }))}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择工厂</SelectItem>{availableFactories.map(factory => <SelectItem key={factory.id} value={String(factory.id)}>{factory.code} · {factory.name}</SelectItem>)}</SelectContent></Select></label><label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">供应商</span><Select value={draft.supplierId} onValueChange={value => setDraft(current => ({ ...current, supplierId: value, supplier: suppliers.find(supplier => String(supplier.id) === value)?.name ?? "" }))}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择供应商</SelectItem>{suppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.code} · {supplier.name}</SelectItem>)}</SelectContent></Select></label>{textField("资产类别", "assetCategory")}<label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">关键等级</span><Select value={draft.criticality} onValueChange={value => setDraft(current => ({ ...current, criticality: value }))}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未分级</SelectItem><SelectItem value="A">A · 关键</SelectItem><SelectItem value="B">B · 重要</SelectItem><SelectItem value="C">C · 一般</SelectItem></SelectContent></Select></label>{textField("责任人", "responsibleOwner")}{textField("启用日期", "commissionedAt", "date")}{textField("保修到期日", "warrantyExpiresAt", "date")}{textField("每小时产能（pcs）", "hourlyCapacity", "number")}{textField("OEE（0–1）", "oee", "number")}{textField("能耗（kW）", "energyConsumption", "number")}{textField("数量（台）", "quantity", "number")}{textField("单价（万元）", "unitPrice", "number")}{textField("折旧年数", "depreciationYears", "number")}{textField("损耗系数", "lossFactor", "number")}</div><label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">OEE 偏低原因</span><Textarea value={draft.lowOeeReason} onChange={event => setDraft(current => ({ ...current, lowOeeReason: event.target.value }))} /></label><label className="space-y-1.5"><span className="text-sm font-medium text-[#405342]">备注</span><Textarea value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} /></label><Button type="button" variant="outline" onClick={() => setDraft(current => ({ ...current, investmentIncluded: !current.investmentIncluded }))} className={draft.investmentIncluded ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-[#d9e5d6]"}>计入投资：{draft.investmentIncluded ? "是" : "否"}</Button><div className="flex justify-end"><Button type="submit" disabled={update.isPending} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">{update.isPending ? "保存中…" : "保存详情"}</Button></div></form>;
}

export default function EquipmentDetail() {
  const { language } = useLanguage();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [editing, setEditing] = useState(false);
  const detail = trpc.equipment.detail.useQuery({ id }, { enabled: Number.isInteger(id) && id > 0 });
  const masterData = trpc.equipment.masterData.useQuery();
  useEffect(() => setEditing(false), [id]);
  const isAdmin = true;
  const item = detail.data;
  const detailData = useMemo(() => {
    if (!item) return null;
    const businessUnit = (masterData.data?.businessUnits ?? []).find(entry => entry.id === item.businessUnitId);
    const factory = (masterData.data?.factories ?? []).find(entry => entry.id === item.factoryId);
    const supplier = (masterData.data?.suppliers ?? []).find(entry => entry.id === item.supplierId);
    return { businessUnit: businessUnit ? `${businessUnit.code} · ${businessUnit.name}` : null, factory: factory ? `${factory.code} · ${factory.name}` : null, supplier: supplier?.name ?? item.supplier ?? null };
  }, [item, masterData.data]);
  if (detail.isLoading) return <div className="industrial-card flex min-h-72 items-center justify-center gap-3 text-sm text-[#607260]"><Activity className="h-5 w-5 animate-pulse text-[#4a7c59]" />正在读取设备详情…</div>;
  if (!item || !detailData) return <div className="industrial-card p-8"><p className="text-lg font-semibold text-[#314a36]">未找到该设备</p><Link href="/equipment"><Button variant="outline" className="mt-4">返回设备台账</Button></Link></div>;
  const amount = calculateEquipmentAmounts({ quantity: item.quantity, unitPrice: item.unitPrice === null ? null : Number(item.unitPrice), lossFactor: item.lossFactor === null ? null : Number(item.lossFactor), investmentIncluded: item.investmentIncluded });
  const oee = item.oee === null ? null : Number(item.oee);
  const lowOee = oee !== null && oee < 0.9;
  const title = language === "en" ? "Equipment Detail" : "资产详情 · 运营与投资";
  const updatedAt = new Date(item.updatedAt).toLocaleString(language === "en" ? "en-US" : "zh-CN");
  return <div className="space-y-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">{title}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#233428]">{item.name}</h1><p className="mt-2 text-sm text-[#6b7c6b]">设备编号 {item.code} · {item.process} · {item.location}</p></div><div className="flex gap-2"><Link href="/equipment"><Button variant="outline" className="border-[#9bbb9b] text-[#476e50]"><ArrowLeft className="mr-2 h-4 w-4" />返回台账</Button></Link>{isAdmin && <Button onClick={() => setEditing(current => !current)} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"><Pencil className="mr-2 h-4 w-4" />{editing ? "查看详情" : "编辑详情"}</Button>}</div></div>{editing && isAdmin ? <DetailEditor item={item} businessUnits={masterData.data?.businessUnits ?? []} factories={masterData.data?.factories ?? []} suppliers={masterData.data?.suppliers ?? []} onClose={() => setEditing(false)} /> : <><section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="industrial-card p-5"><Gauge className="h-5 w-5 text-[#4a7c59]" /><p className="mt-4 text-sm text-[#708170]">OEE</p><p className="mt-1 text-3xl font-semibold text-[#243627]">{displayOee(item.oee)}</p></div><div className="industrial-card p-5"><Factory className="h-5 w-5 text-[#4a7c59]" /><p className="mt-4 text-sm text-[#708170]">每小时产能（pcs）</p><p className="mt-1 text-3xl font-semibold text-[#243627]">{item.hourlyCapacity ?? empty}</p></div><div className="industrial-card p-5"><Zap className="h-5 w-5 text-[#4a7c59]" /><p className="mt-4 text-sm text-[#708170]">能耗（kW）</p><p className="mt-1 text-3xl font-semibold text-[#243627]">{item.energyConsumption ?? empty}</p></div><div className="industrial-card p-5"><CircleDollarSign className="h-5 w-5 text-[#4a7c59]" /><p className="mt-4 text-sm text-[#708170]">合计金额（万元）</p><p className="mt-1 text-3xl font-semibold text-[#243627]">{amount.totalAmount === null ? empty : amount.totalAmount.toFixed(2)}</p></div></section><section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]"><article className="industrial-card p-5"><div className="mb-4 flex items-center gap-2"><Building2 className="h-5 w-5 text-[#4a7c59]" /><h2 className="font-semibold text-[#26392a]">设备、生产与生命周期参数</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><DetailCell label="名称" value={item.name} /><DetailCell label="型号" value={item.model} /><DetailCell label="规格" value={item.specification} /><DetailCell label="状态" value={statusLabel[item.status]} /><DetailCell label="所属 BU" value={detailData.businessUnit} /><DetailCell label="工厂" value={detailData.factory} /><DetailCell label="供应商" value={detailData.supplier} /><DetailCell label="资产类别" value={item.assetCategory} /><DetailCell label="关键等级" value={item.criticality ? `${item.criticality} 级` : null} /><DetailCell label="责任人" value={item.responsibleOwner} /><DetailCell label="启用日期" value={dateValue(item.commissionedAt)} /><DetailCell label="保修到期日" value={dateValue(item.warrantyExpiresAt)} /><DetailCell label="每小时产能（pcs）" value={item.hourlyCapacity} /><DetailCell label="OEE" value={displayOee(item.oee)} /><DetailCell label="能耗（kW）" value={item.energyConsumption} /><DetailCell label="数量（台）" value={item.quantity} /></div>{lowOee && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">OEE偏低原因</p><p className="mt-1 text-sm text-amber-800">{item.lowOeeReason || empty}</p></div>}</article><article className="industrial-card p-5"><div className="mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#4a7c59]" /><h2 className="font-semibold text-[#26392a]">投资与折旧</h2></div><div className="space-y-3"><DetailCell label="单价（万元）" value={item.unitPrice} /><DetailCell label="折旧年数" value={item.depreciationYears} /><DetailCell label="损耗系数" value={item.lossFactor} /><DetailCell label="合计金额（万元）" value={amount.totalAmount === null ? null : amount.totalAmount.toFixed(2)} /><DetailCell label="计入投资" value={item.investmentIncluded ? "是" : item.investmentIncluded === false ? "否" : null} /><DetailCell label="计入投资金额（万元）" value={amount.investmentAmount === null ? null : amount.investmentAmount.toFixed(2)} /></div></article></section><section className="grid gap-5 lg:grid-cols-2"><article className="industrial-card p-5"><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#4a7c59]" /><h2 className="font-semibold text-[#26392a]">治理信息</h2></div><div className="grid gap-3 sm:grid-cols-2"><DetailCell label="设备编号" value={item.code} /><DetailCell label="所属工序" value={item.process} /><DetailCell label="位置" value={item.location} /><DetailCell label="资产记录更新时间" value={updatedAt} /></div></article><article className="industrial-card p-5"><div className="mb-3 flex items-center gap-2"><CalendarClock className="h-5 w-5 text-[#4a7c59]" /><h2 className="font-semibold text-[#26392a]">备注</h2></div><p className="whitespace-pre-wrap text-sm leading-6 text-[#5e705f]">{item.notes || empty}</p></article></section></>}</div>;
}
