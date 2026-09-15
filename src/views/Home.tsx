import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { filterEquipmentByBusinessUnit, getSelectedBusinessUnit, toggleBusinessUnitSelection } from "@/lib/businessUnitFilter";
import { useFormPrompt } from "@/components/prompt-dialog";
import { reconcileInlineEditorSnapshot } from "@/lib/inlineEditorState";
import { useLanguage } from "@/contexts/LanguageContext";
import { languageCopy } from "@/contexts/languageCopy";
import { downloadWorkbook, parseEquipmentWorkbook, parseMaintenanceWorkbook, parseRepairWorkbook } from "@/lib/excel";
import { importResultMessage } from "@/lib/importResultMessage";
import { canSubmitMaintenanceCompletion, createMaintenanceCompletionDraft, type MaintenanceCompletionDraft } from "@/lib/maintenanceCompletion";
import { isValidMaintenanceCycle } from "@/lib/maintenancePlanInput";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  Factory,
  FileSpreadsheet,
  Gauge,
  HardHat,
  History,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Wrench,
  ImagePlus,
  Target,
  FilePenLine,
  ShoppingCart,
  ArrowRight,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type EquipmentForm = {
  code: string;
  name: string;
  model: string;
  specification: string;
  process: string;
  location: string;
  status: "running" | "stopped" | "maintenance" | "scrapped";
  supplier: string; supplierId: string; businessUnitId: string; factoryId: string; productId: string; assetCategory: string; criticality: "" | "A" | "B" | "C"; responsibleOwner: string; commissionedAt: string; warrantyExpiresAt: string; hourlyCapacity: string; oee: string; lowOeeReason: string; energyConsumption: string; quantity: string; unitPrice: string; depreciationYears: string; lossFactor: string; notes: string;
};

const emptyEquipment: EquipmentForm = {
  code: "",
  name: "",
  model: "",
  specification: "",
  process: "",
  location: "",
  status: "running",
  supplier: "", supplierId: "", businessUnitId: "", factoryId: "", productId: "", assetCategory: "", criticality: "", responsibleOwner: "", commissionedAt: "", warrantyExpiresAt: "", hourlyCapacity: "", oee: "", lowOeeReason: "", energyConsumption: "", quantity: "", unitPrice: "", depreciationYears: "", lossFactor: "", notes: "",
};

const nullableNumber = (value: string) => value.trim() === "" ? null : Number(value);
const nullableDate = (value: string) => value.trim() === "" ? null : new Date(`${value}T00:00:00.000Z`);
const toDateInputValue = (value: Date | string | null | undefined) => value ? new Date(value).toISOString().slice(0, 10) : "";
const toEquipmentPayload = (values: EquipmentForm) => ({ ...values, supplierId: nullableNumber(values.supplierId), businessUnitId: nullableNumber(values.businessUnitId), factoryId: nullableNumber(values.factoryId), productId: nullableNumber(values.productId), criticality: values.criticality || null, commissionedAt: nullableDate(values.commissionedAt), warrantyExpiresAt: nullableDate(values.warrantyExpiresAt), hourlyCapacity: nullableNumber(values.hourlyCapacity), oee: nullableNumber(values.oee), energyConsumption: nullableNumber(values.energyConsumption), quantity: nullableNumber(values.quantity), unitPrice: nullableNumber(values.unitPrice), depreciationYears: nullableNumber(values.depreciationYears), lossFactor: nullableNumber(values.lossFactor) });
const toEquipmentForm = (item: any): EquipmentForm => ({ ...emptyEquipment, code: item.code, name: item.name, model: item.model, specification: item.specification, process: item.process, location: item.location, status: item.status, supplier: item.supplier ?? "", supplierId: item.supplierId == null ? "" : String(item.supplierId), businessUnitId: item.businessUnitId == null ? "" : String(item.businessUnitId), factoryId: item.factoryId == null ? "" : String(item.factoryId), productId: item.productId == null ? "" : String(item.productId), assetCategory: item.assetCategory ?? "", criticality: item.criticality === "A" || item.criticality === "B" || item.criticality === "C" ? item.criticality : "", responsibleOwner: item.responsibleOwner ?? "", commissionedAt: toDateInputValue(item.commissionedAt), warrantyExpiresAt: toDateInputValue(item.warrantyExpiresAt), hourlyCapacity: item.hourlyCapacity === null || item.hourlyCapacity === undefined ? "" : String(item.hourlyCapacity), oee: item.oee === null || item.oee === undefined ? "" : String(item.oee), lowOeeReason: item.lowOeeReason ?? "", energyConsumption: item.energyConsumption === null || item.energyConsumption === undefined ? "" : String(item.energyConsumption), quantity: item.quantity === null || item.quantity === undefined ? "" : String(item.quantity), unitPrice: item.unitPrice === null || item.unitPrice === undefined ? "" : String(item.unitPrice), depreciationYears: item.depreciationYears === null || item.depreciationYears === undefined ? "" : String(item.depreciationYears), lossFactor: item.lossFactor === null || item.lossFactor === undefined ? "" : String(item.lossFactor), notes: item.notes ?? "" });

const statusMeta = {
  running: { label: "运行中", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  stopped: { label: "停机", className: "bg-slate-100 text-slate-700 border-slate-200" },
  maintenance: { label: "维修中", className: "bg-amber-100 text-amber-800 border-amber-200" },
  calibrating: { label: "保养/校准中", className: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  pending_acceptance: { label: "待验收", className: "bg-violet-100 text-violet-800 border-violet-200" },
  scrapped: { label: "报废", className: "bg-rose-100 text-rose-700 border-rose-200" },
} as const;

const maintenanceStatus = { pending: "待执行", in_progress: "执行中", completed: "已完成" } as const;
const repairStatus = { pending: "待接单", in_progress: "维修中", completed: "已完成" } as const;

function dateText(value?: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

const equipmentExportRow = (item: any, businessUnits: any[] = [], factories: any[] = [], suppliers: any[] = []) => ({
  "编号": item.code, "名称": item.name, "型号": item.model, "规格": item.specification, "所属工序": item.process, "位置": item.location, "状态": statusMeta[item.status as keyof typeof statusMeta].label,
  "BU编码": businessUnits.find(entry => entry.id === item.businessUnitId)?.code ?? "", "工厂编码": factories.find(entry => entry.id === item.factoryId)?.code ?? "", "供应商编码": suppliers.find(entry => entry.id === item.supplierId)?.code ?? "", "供应商": item.supplier,
  "每小时产能（pcs）": item.hourlyCapacity, "OEE": item.oee, "OEE偏低原因": item.lowOeeReason, "能耗（kW）": item.energyConsumption, "数量（台）": item.quantity, "单价（万元）": item.unitPrice, "折旧年数": item.depreciationYears, "损耗系数": item.lossFactor, "备注": item.notes,
});

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  const { language } = useLanguage();
  const [lastImportMessage, setLastImportMessage] = useState<string | null>(null);
  useEffect(() => {
    const handleImportResult = (event: Event) => setLastImportMessage((event as CustomEvent<string>).detail);
    window.addEventListener("process-equipment-import-result", handleImportResult);
    return () => window.removeEventListener("process-equipment-import-result", handleImportResult);
  }, []);
  const english: Record<string, string> = { "设备运营中心": "Equipment Operations Center", "设备登记、权属、资质、保养与运行状态追踪。": "Equipment registry, ownership, qualification, maintenance, and operational status tracking", "设备全生命周期": "Equipment Lifecycle", "预防性维护": "Preventive Maintenance", "故障处置": "Fault Resolution", "备件运营": "Parts Operations", "治理与追溯": "Governance & Traceability", "生产工艺设备仪表盘": "Process Equipment Dashboard", "设备管理": "Equipment Management", "保养计划与工单": "Maintenance Plans & Work Orders", "故障与维修": "Faults & Repairs", "备件 / 耗材": "Parts / Consumables", "用户权限与操作日志": "User Permissions & Audit Log", "围绕设备运行、保养、维修和库存风险进行统一监控。": "Monitor equipment operations, maintenance, repairs, and inventory risks in one place.", "维护生产设备基本信息，并对设备状态变更进行完整追溯。": "Maintain equipment master data and fully trace every status change.", "制定设备周期性保养计划，完成工单后自动生成下一周期待执行记录。": "Schedule recurring maintenance and automatically create the next work order upon completion.", "登记故障、生成维修工单，并保留从发现到完成的闭环记录。": "Log faults, create repair work orders, and retain the closed-loop record from discovery to completion.", "维护备件安全库存，并完整追溯每一笔入库与领用流水。": "Maintain safety stock and trace every inbound and issued inventory transaction.", "管理角色权限，并集中留存关键业务操作的审计记录。": "Manage roles and retain an auditable record of key business operations." };
  const text = (value: string) => language === "en" ? (english[value] ?? value) : value;
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="mb-1 text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">{eyebrow ? text(eyebrow) : null}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#233428]">{text(title)}</h1>
        <p className="mt-1 text-sm text-[#6b7c6b]">{text(description)}</p>
        {title === "用户权限与操作日志" && <p className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">{language === "zh" ? "项目所有者必须保留管理员角色，不能降级为普通用户。" : "The project owner must retain the Administrator role and cannot be downgraded."}</p>}
      </div>
      {action && <div className="w-full lg:w-auto">{action}<ImportResultNotice message={lastImportMessage} /></div>}
    </div>
  );
}

function DataCard({ icon: Icon, label, value, hint, tone = "green" }: { icon: typeof Activity; label: string; value: string | number; hint: string; tone?: "green" | "amber" | "red" | "slate" }) {
  const toneClasses = { green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", red: "bg-rose-100 text-rose-700", slate: "bg-slate-100 text-slate-700" };
  return <article className="industrial-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-[#6b7c6b]">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-[#233428]">{value}</p><p className="mt-2 text-xs text-[#829081]">{hint}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClasses[tone]}`}><Icon className="h-5 w-5" /></span></div></article>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-[#d9e5d6] bg-[#fbfdf9] px-5 text-center"><PackageSearch className="mb-3 h-7 w-7 text-[#9aab99]" /><p className="text-sm font-medium text-[#4e614f]">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#829081]">{description}</p></div>;
}

type ProductOption = { id: number; code: string; name: string; imageUrl: string | null };

async function uploadImageFile(file: File): Promise<string> {
  const dataBase64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.onerror = () => reject(new Error("读取文件失败")); reader.readAsDataURL(file); });
  const response = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, dataBase64 }) });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.url) throw new Error(json?.error || "图片上传失败");
  return String(json.url);
}

const EQUIPMENT_DRAFT_KEY = "process-equipment-dialog-draft";

function EquipmentDialog({ initial, onSubmit, trigger }: { initial?: Partial<EquipmentForm>; onSubmit: (values: EquipmentForm) => Promise<unknown>; trigger: React.ReactNode }) {
  const masterData = trpc.equipment.masterData.useQuery();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<EquipmentForm>({ ...emptyEquipment, ...initial });
  const handleOpenChange = (next: boolean) => {
    if (next) {
      if (initial) {
        setValues({ ...emptyEquipment, ...initial });
      } else {
        try {
          const draft = sessionStorage.getItem(EQUIPMENT_DRAFT_KEY);
          if (draft) setValues({ ...emptyEquipment, ...(JSON.parse(draft) as EquipmentForm) });
        } catch {
          // 草稿损坏时忽略, 使用默认值
        }
      }
    }
    setOpen(next);
  };
  useEffect(() => {
    if (open && !initial) sessionStorage.setItem(EQUIPMENT_DRAFT_KEY, JSON.stringify(values));
  }, [values, open, initial]);
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof EquipmentForm>(key: K, value: EquipmentForm[K]) => setValues(current => ({ ...current, [key]: value }));
  const businessUnits = masterData.data?.businessUnits ?? [];
  const factories = masterData.data?.factories ?? [];
  const suppliers = masterData.data?.suppliers ?? [];
  const products = masterData.data?.products ?? [];
  const selectedBusinessUnitId = values.businessUnitId ? Number(values.businessUnitId) : null;
  const availableFactories = factories.filter(factory => selectedBusinessUnitId === null || factory.businessUnitId === null || factory.businessUnitId === selectedBusinessUnitId || String(factory.id) === values.factoryId);
  const selectBusinessUnit = (value: string) => {
    const businessUnitId = value === "none" ? "" : value;
    setValues(current => {
      const selectedId = businessUnitId ? Number(businessUnitId) : null;
      const currentFactory = factories.find(factory => String(factory.id) === current.factoryId);
      const canRetainFactory = !currentFactory || selectedId === null || currentFactory.businessUnitId === null || currentFactory.businessUnitId === selectedId;
      return { ...current, businessUnitId, factoryId: canRetainFactory ? current.factoryId : "" };
    });
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(values);
      sessionStorage.removeItem(EQUIPMENT_DRAFT_KEY);
      setOpen(false);
      setValues({ ...emptyEquipment, ...initial });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设备保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };
  return <Dialog open={open} onOpenChange={handleOpenChange}><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{initial ? "编辑设备" : "新增设备"}</DialogTitle><DialogDescription>带星号字段为台账必填项；可选关联 BU、工厂与供应商主数据，运营与投资数据可在取得真实记录后补充。</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><FormInput required label="编号" value={values.code} onChange={value => update("code", value)} /><FormInput required label="名称" value={values.name} onChange={value => update("name", value)} /><FormInput required label="型号" value={values.model} onChange={value => update("model", value)} /><FormInput required label="规格" value={values.specification} onChange={value => update("specification", value)} /><FormInput required label="所属工序" value={values.process} onChange={value => update("process", value)} /><FormInput required label="位置" value={values.location} onChange={value => update("location", value)} /><div className="space-y-1.5"><label className="text-sm font-medium text-[#405342]">所属 BU</label><Select value={values.businessUnitId || "none"} onValueChange={selectBusinessUnit} disabled={masterData.isLoading}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue placeholder="选择 BU（可选）" /></SelectTrigger><SelectContent><SelectItem value="none">未选择 BU</SelectItem>{businessUnits.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><label className="text-sm font-medium text-[#405342]">工厂</label><Select value={values.factoryId || "none"} onValueChange={value => update("factoryId", value === "none" ? "" : value)} disabled={masterData.isLoading}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue placeholder="选择工厂（可选）" /></SelectTrigger><SelectContent><SelectItem value="none">未选择工厂</SelectItem>{availableFactories.length ? availableFactories.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code}</SelectItem>) : <p className="px-2 py-1.5 text-xs text-[#829081]">当前 BU 暂无可选工厂</p>}</SelectContent></Select></div><div className="space-y-1.5"><label className="text-sm font-medium text-[#405342]">所属产品</label><Select value={values.productId || "none"} onValueChange={(value: string) => update("productId", value === "none" ? "" : value)}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue placeholder="选择产品（可选）" /></SelectTrigger><SelectContent><SelectItem value="none">未选择产品</SelectItem>{products.map((item: ProductOption) => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></div><SupplierSelect supplierId={values.supplierId} supplier={values.supplier} suppliers={suppliers} onChange={(supplierId, supplier) => setValues(current => ({ ...current, supplierId, supplier }))} disabled={masterData.isLoading} /><FormInput label="每小时产能（pcs）" type="number" value={values.hourlyCapacity} onChange={value => update("hourlyCapacity", value)} /><FormInput label="OEE（0-1）" type="number" value={values.oee} onChange={value => update("oee", value)} /><FormInput label="能耗（kW）" type="number" value={values.energyConsumption} onChange={value => update("energyConsumption", value)} /><FormInput label="数量（台）" type="number" value={values.quantity} onChange={value => update("quantity", value)} /><FormInput label="单价（万元）" type="number" value={values.unitPrice} onChange={value => update("unitPrice", value)} /><FormInput label="折旧年数" type="number" value={values.depreciationYears} onChange={value => update("depreciationYears", value)} /><FormInput label="损耗系数" type="number" value={values.lossFactor} onChange={value => update("lossFactor", value)} /><div className="space-y-1.5"><label className="text-sm font-medium">状态</label><Select value={values.status} onValueChange={value => update("status", value as EquipmentForm["status"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusMeta).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select></div></div>{masterData.error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">BU、工厂与供应商主数据暂时无法读取，仍可保存不关联主数据的设备信息。</p>}<div className="space-y-1.5"><label className="text-sm font-medium">OEE偏低原因</label><Textarea value={values.lowOeeReason} onChange={event => update("lowOeeReason", event.target.value)} placeholder="仅 OEE 低于 0.9 时在详情页展示" /></div><div className="space-y-1.5"><label className="text-sm font-medium">备注</label><Textarea value={values.notes} onChange={event => update("notes", event.target.value)} /></div><DialogFooter><Button type="submit" disabled={saving} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存设备</Button></DialogFooter></form></DialogContent></Dialog>;
}

function SupplierSelect({ supplierId, supplier, suppliers, onChange, disabled = false }: { supplierId: string; supplier: string; suppliers: Array<{ id: number; code: string; name: string }>; onChange: (supplierId: string, supplier: string) => void; disabled?: boolean }) {
  const currentValue = supplierId || (supplier ? "legacy" : "none");
  return <div className="space-y-1.5"><label className="text-sm font-medium text-[#405342]">供应商</label><Select value={currentValue} onValueChange={value => { if (value === "none") onChange("", ""); else { const selected = suppliers.find(item => String(item.id) === value); if (selected) onChange(String(selected.id), selected.name); } }} disabled={disabled}><SelectTrigger className="border-[#d9e5d6] bg-white"><SelectValue placeholder="选择供应商（可选）" /></SelectTrigger><SelectContent><SelectItem value="none">未选择供应商</SelectItem>{supplier && !supplierId && <SelectItem value="legacy" disabled>历史文本：{supplier}</SelectItem>}{suppliers.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></div>;
}

function FormInput({ label, value, onChange, type = "text", required = false }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean }) {
  const isNumeric = type === "number";
  return <div className="space-y-1.5"><label className="text-sm font-medium text-[#405342]">{label}{required ? " *" : ""}</label><Input type={isNumeric ? "text" : type} inputMode={isNumeric ? "decimal" : undefined} value={value} onChange={event => onChange(event.target.value)} required={required} className="border-[#d9e5d6] bg-white focus-visible:ring-[#6f9a73]" /></div>;
}

function ImportResultNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">{message}</p>;
}

function publishImportResult(message: string) {
  window.dispatchEvent(new CustomEvent<string>("process-equipment-import-result", { detail: message }));
}

function DashboardView() {
  const metrics = trpc.dashboard.metrics.useQuery();
  const [, navigate] = useLocation();
  const data = metrics.data;
  return <><PageHeader eyebrow="设备运营中心" title="生产工艺设备仪表盘" description="围绕设备运行、保养、维修、资产与库存风险进行统一监控。" />
  <section className="mb-5 grid gap-4 sm:grid-cols-2">
    <button onClick={() => navigate("/apply/change/new")} className="group rounded-2xl border border-[#dcead8] bg-gradient-to-br from-[#f4faf0] to-white p-5 text-left transition hover:border-[#4a7c59] hover:shadow-md">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-[#eaf3e6] p-2.5 text-[#4a7c59]"><FilePenLine className="h-5 w-5" /></span><div><p className="font-semibold text-[#26392a]">设备修改申请</p><p className="mt-0.5 text-xs text-[#829081]">维修 / 保养校准 / 改造 / 移装 / 报废，全流程审批</p></div><ArrowRight className="ml-auto h-4 w-4 text-[#4a7c59] opacity-0 transition group-hover:opacity-100" /></div>
    </button>
    <button onClick={() => navigate("/apply/purchase/new")} className="group rounded-2xl border border-[#dcead8] bg-gradient-to-br from-[#f4faf0] to-white p-5 text-left transition hover:border-[#4a7c59] hover:shadow-md">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-[#eaf3e6] p-2.5 text-[#4a7c59]"><ShoppingCart className="h-5 w-5" /></span><div><p className="font-semibold text-[#26392a]">设备购买申请</p><p className="mt-0.5 text-xs text-[#829081]">购买 / 以旧换新 / 扩产增购，比价后自动建档</p></div><ArrowRight className="ml-auto h-4 w-4 text-[#4a7c59] opacity-0 transition group-hover:opacity-100" /></div>
    </button>
  </section>
  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
<DataCard icon={Factory} label="设备总数" value={data?.totalEquipment ?? 0} hint="已纳入设备台账" />
<DataCard icon={Gauge} label="在线率" value={`${data?.onlineRate ?? 0}%`} hint="运行中 / 非报废设备" tone="green" />
<DataCard icon={Target} label="OEE 达标率" value={`${data?.oeeComplianceRate ?? 0}%`} hint={`阈值 ≥ ${data?.oeeOverview?.threshold ?? 0.9}，达标 ${data?.oeeOverview?.compliant ?? 0} 台`} tone="green" />
<DataCard icon={Coins} label="资产原值" value={`${(data?.totalAssetValue ?? 0).toFixed(2)} 万`} hint="按 数量 × 单价 汇总" />
</section>
<section className="mt-5"><article className="industrial-card p-5">
<div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#26392a]">BU 分布</h2><p className="mt-1 text-xs text-[#829081]">各业务单元设备数量与资产原值</p></div><Building2 className="h-5 w-5 text-[#4a7c59]" /></div>
{data?.buDistribution?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{data.buDistribution.map(bu => <div key={bu.buId} className="rounded-2xl border border-[#dcead8] bg-[#fbfdf9] p-4"><div className="flex items-center justify-between"><span className="text-sm font-semibold text-[#2f3e2f]">{bu.buCode}</span><span className="rounded-full bg-[#eaf3e6] px-2 py-0.5 text-xs text-[#56745b]">{bu.count} 台</span></div><p className="mt-2 truncate text-xs text-[#7c8c7b]">{bu.buName}</p><p className="mt-2 text-lg font-semibold text-[#405342]">{bu.assetValue.toFixed(2)} <span className="text-xs font-normal text-[#829081]">万</span></p></div>)}</div> : <p className="rounded-2xl bg-[#f8fbf6] p-4 text-sm text-[#829081]">暂无 BU 数据，在后台基础数据管理中新增 BU 后，这里将展示各 BU 的设备与资产分布。</p>}
</article></section>
<section className="mt-5 grid gap-5 lg:grid-cols-2">
<article className="industrial-card p-5">
<div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#26392a]">设备状态分布</h2><p className="mt-1 text-xs text-[#829081]">当前台账状态实时汇总</p></div><Activity className="h-5 w-5 text-[#4a7c59]" /></div>
<div className="space-y-4">{(data?.statusBreakdown ?? []).map(item => <div key={item.status}><div className="mb-1.5 flex items-center justify-between text-sm"><span className="text-[#516552]">{item.label}</span><span className="font-semibold text-[#2d3b2d]">{item.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf3ea]"><div className="h-full rounded-full bg-[#78a879]" style={{ width: `${data?.totalEquipment ? (item.count / data.totalEquipment) * 100 : 0}%` }} /></div></div>)}</div>
</article>
<article className="industrial-card p-5">
<div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#26392a]">保修状态概览</h2><p className="mt-1 text-xs text-[#829081]">按保修到期日与 {data?.warrantyOverview?.dueSoonWindowDays ?? 90} 天临期窗口划分</p></div><ShieldCheck className="h-5 w-5 text-[#4a7c59]" /></div>
<div className="grid gap-3 sm:grid-cols-2">
<div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4"><p className="text-xs text-rose-700">已过保</p><p className="mt-1 text-2xl font-semibold text-rose-700">{data?.warrantyOverview?.expired ?? 0}<span className="ml-1 text-xs font-normal">台</span></p><p className="mt-1 text-xs text-rose-500">建议评估续保或更换</p></div>
<div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><p className="text-xs text-amber-700">临期（{data?.warrantyOverview?.dueSoonWindowDays ?? 90} 天内到期）</p><p className="mt-1 text-2xl font-semibold text-amber-700">{data?.warrantyOverview?.dueSoon ?? 0}<span className="ml-1 text-xs font-normal">台</span></p><p className="mt-1 text-xs text-amber-600">提前安排保修检查</p></div>
<div className="rounded-2xl border border-[#dcead8] bg-[#f7fbf4] p-4"><p className="text-xs text-[#56745b]">在保设备</p><p className="mt-1 text-2xl font-semibold text-[#3f6a45]">{data?.warrantyOverview?.inWarranty ?? 0}<span className="ml-1 text-xs font-normal">台</span></p><p className="mt-1 text-xs text-[#7c8c7b]">保修期在临期窗口之外</p></div>
<div className="rounded-2xl border border-[#e4eee0] bg-white p-4"><p className="text-xs text-[#829081]">未录入</p><p className="mt-1 text-2xl font-semibold text-[#526652]">{data?.warrantyOverview?.notEntered ?? 0}<span className="ml-1 text-xs font-normal">台</span></p><p className="mt-1 text-xs text-[#9aa89a]">请在设备台账补充保修到期日</p></div>
</div>
</article>
</section>
<section className="mt-5 grid gap-5 lg:grid-cols-2">
<article className="industrial-card p-5">
<div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#26392a]">OEE 达标分析</h2><p className="mt-1 text-xs text-[#829081]">OEE ≥ {data?.oeeOverview?.threshold ?? 0.9} 计入达标</p></div><Target className="h-5 w-5 text-[#4a7c59]" /></div>
<div className="flex items-baseline gap-2"><span className="text-4xl font-semibold text-[#2f3e2f]">{data?.oeeComplianceRate ?? 0}<span className="text-lg">%</span></span><span className="text-xs text-[#829081]">达标率</span></div>
<div className="mt-4 grid grid-cols-3 gap-3 text-center">
<div className="rounded-xl bg-[#f0f7ec] p-3"><p className="text-lg font-semibold text-[#3f6a45]">{data?.oeeOverview?.compliant ?? 0}</p><p className="mt-0.5 text-xs text-[#56745b]">达标</p></div>
<div className="rounded-xl bg-[#fdf6ec] p-3"><p className="text-lg font-semibold text-amber-700">{data?.oeeOverview?.nonCompliant ?? 0}</p><p className="mt-0.5 text-xs text-amber-600">未达标</p></div>
<div className="rounded-xl bg-[#f4f6f4] p-3"><p className="text-lg font-semibold text-[#526652]">{data?.oeeOverview?.notEntered ?? 0}</p><p className="mt-0.5 text-xs text-[#829081]">未录入</p></div>
</div>
<p className="mt-4 rounded-xl bg-[#f8fbf6] p-3 text-xs leading-5 text-[#607260]">未达标设备请在设备台账中补充 OEE 偏低原因，便于制定改进措施。</p>
</article>
<article className="industrial-card p-5">
<div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-[#26392a]">资产与工龄</h2><p className="mt-1 text-xs text-[#829081]">关键等级、启用年份与高价值设备</p></div><Boxes className="h-5 w-5 text-[#4a7c59]" /></div>
<div className="grid gap-5 sm:grid-cols-2">
<div>
<p className="mb-2 text-xs font-medium text-[#7c8c7b]">关键等级分布</p>
<div className="space-y-2.5">{(data?.criticalityBreakdown ?? []).map(item => <div key={item.label}><div className="mb-1 flex items-center justify-between text-xs"><span className="text-[#516552]">{item.label}</span><span className="font-semibold text-[#2d3b2d]">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf3ea]"><div className="h-full rounded-full bg-[#78a879]" style={{ width: `${data?.totalEquipment ? (item.count / data.totalEquipment) * 100 : 0}%` }} /></div></div>)}</div>
<p className="mb-2 mt-4 text-xs font-medium text-[#7c8c7b]">启用年份分布</p>
<div className="space-y-2.5">{(data?.ageDistribution ?? []).map(item => <div key={item.label}><div className="mb-1 flex items-center justify-between text-xs"><span className="text-[#516552]">{item.label}</span><span className="font-semibold text-[#2d3b2d]">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf3ea]"><div className="h-full rounded-full bg-[#78a879]" style={{ width: `${data?.totalEquipment ? (item.count / data.totalEquipment) * 100 : 0}%` }} /></div></div>)}</div>
</div>
<div>
<p className="mb-2 text-xs font-medium text-[#7c8c7b]">资产原值 TOP5（万元）</p>
<div className="space-y-2">{(data?.topValueEquipment ?? []).map((item, index) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#f8fbf6] px-3 py-2"><span className="flex items-center gap-2 truncate text-xs text-[#405342]"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${index === 0 ? "bg-[#4a7c59] text-white" : "bg-[#e3ecdf] text-[#56745b]"}`}>{index + 1}</span><span className="truncate">{item.code} · {item.name}</span></span><span className="shrink-0 text-sm font-semibold text-[#2d3b2d]">{item.assetValue.toFixed(2)}</span></div>)}
{(data?.topValueEquipment ?? []).length === 0 && <p className="rounded-xl bg-[#f8fbf6] p-3 text-xs text-[#829081]">暂无同时录入数量与单价的设备，请在设备台账补充后查看。</p>}
</div>
</div>
</div>
</article>
</section>
</>;
}

export function InlineEquipmentDetailEditor({ item, businessUnits, factories, suppliers, isAdmin, onSave }: { item: any; businessUnits: any[]; factories: any[]; suppliers: any[]; isAdmin: boolean; onSave: (values: EquipmentForm) => Promise<unknown> }) {
  const [values, setValues] = useState<EquipmentForm>(() => toEquipmentForm(item));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const valuesRef = useRef<EquipmentForm>(toEquipmentForm(item));
  const savedFingerprint = useRef(JSON.stringify(toEquipmentPayload(toEquipmentForm(item))));
  const saveQueue = useRef(Promise.resolve());
  const editorSnapshot = useRef<{ equipmentId: number; values: EquipmentForm; saveState: "idle" | "saving" | "saved" | "error" }>({ equipmentId: item.id, values: toEquipmentForm(item), saveState: "idle" });

  useEffect(() => {
    const nextValues = toEquipmentForm(item);
    const nextSnapshot = reconcileInlineEditorSnapshot(editorSnapshot.current, item.id, nextValues);
    if (nextSnapshot === editorSnapshot.current) return;
    editorSnapshot.current = nextSnapshot;
    valuesRef.current = nextSnapshot.values;
    setValues(nextSnapshot.values);
    savedFingerprint.current = JSON.stringify(toEquipmentPayload(nextValues));
    setSaveState("idle");
  }, [item.id]);

  const updateDraft = <K extends keyof EquipmentForm>(key: K, value: EquipmentForm[K]) => setValues(current => {
    const nextValues = { ...current, [key]: value };
    valuesRef.current = nextValues;
    editorSnapshot.current = { ...editorSnapshot.current, values: nextValues };
    return nextValues;
  });
  const queueSave = (nextValues: EquipmentForm) => {
    if (!isAdmin) return;
    const nextFingerprint = JSON.stringify(toEquipmentPayload(nextValues));
    if (nextFingerprint === savedFingerprint.current) return;
    setSaveState("saving");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      await onSave(nextValues);
      savedFingerprint.current = nextFingerprint;
      setSaveState("saved");
    }).catch(error => {
      setSaveState("error");
      toast.error(error instanceof Error ? error.message : "设备详情自动保存失败，请修改后重试");
    });
  };
  const selectedBusinessUnitId = values.businessUnitId ? Number(values.businessUnitId) : null;
  const availableFactories = factories.filter(factory => selectedBusinessUnitId === null || factory.businessUnitId === null || factory.businessUnitId === selectedBusinessUnitId || String(factory.id) === values.factoryId);
  const saveStatus = saveState === "saving" ? "正在自动保存…" : saveState === "saved" ? "已自动保存" : saveState === "error" ? "保存失败，请重试" : isAdmin ? "字段失焦后自动保存" : "仅管理员可编辑";
  const saveClassName = saveState === "error" ? "text-rose-700" : saveState === "saved" ? "text-emerald-700" : "text-[#829081]";
  const amount = values.quantity === "" || values.unitPrice === "" ? null : Number(values.quantity) * Number(values.unitPrice);
  const commitBusinessUnit = (value: string) => {
    const businessUnitId = value === "none" ? "" : value;
    const selectedId = businessUnitId ? Number(businessUnitId) : null;
    const currentFactory = factories.find(factory => String(factory.id) === values.factoryId);
    const canRetainFactory = !currentFactory || selectedId === null || currentFactory.businessUnitId === null || currentFactory.businessUnitId === selectedId;
    const nextValues = { ...values, businessUnitId, factoryId: canRetainFactory ? values.factoryId : "" };
    valuesRef.current = nextValues;
    setValues(nextValues);
    queueSave(nextValues);
  };
  const commitFactory = (value: string) => { const nextValues = { ...valuesRef.current, factoryId: value === "none" ? "" : value }; valuesRef.current = nextValues; setValues(nextValues); queueSave(nextValues); };
  const commitSupplier = (value: string) => { const selected = suppliers.find(supplier => String(supplier.id) === value); const nextValues = value === "none" ? { ...valuesRef.current, supplierId: "", supplier: "" } : selected ? { ...valuesRef.current, supplierId: String(selected.id), supplier: selected.name } : valuesRef.current; valuesRef.current = nextValues; setValues(nextValues); queueSave(nextValues); };
  const inputClass = "mt-1 h-8 border-[#d9e5d6] bg-white px-2 text-sm focus-visible:ring-[#6f9a73]";
  const field = (label: string, control: React.ReactNode) => <label className="block rounded-xl border border-[#e4eee0] bg-[#fbfdf9] p-3 text-xs font-medium text-[#7c8c7b]"><span>{label}</span>{control}</label>;

  return <div className="rounded-2xl border border-[#dbe9d7] bg-white p-4 shadow-sm"><div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#34513a]">{item.code} · 设备详情</p><p className="mt-1 text-xs text-[#829081]">{isAdmin ? "可直接编辑运营与投资字段；切换选择项或离开输入框后系统自动保存。" : "设备运营与投资字段由管理员维护。"}</p></div><span className={`text-xs font-medium ${saveClassName}`}>{saveState === "saving" && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}{saveStatus}</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{field("所属 BU", <Select value={values.businessUnitId || "none"} onValueChange={commitBusinessUnit} disabled={!isAdmin}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择 BU</SelectItem>{businessUnits.map(unit => <SelectItem key={unit.id} value={String(unit.id)}>{unit.code}</SelectItem>)}</SelectContent></Select>)}{field("工厂", <Select value={values.factoryId || "none"} onValueChange={commitFactory} disabled={!isAdmin}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择工厂</SelectItem>{availableFactories.map(factory => <SelectItem key={factory.id} value={String(factory.id)}>{factory.code}</SelectItem>)}</SelectContent></Select>)}{field("供应商", <Select value={values.supplierId || (values.supplier ? "legacy" : "none")} onValueChange={commitSupplier} disabled={!isAdmin}><SelectTrigger className={inputClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">未选择供应商</SelectItem>{values.supplier && !values.supplierId && <SelectItem value="legacy" disabled>历史文本：{values.supplier}</SelectItem>}{suppliers.map(supplier => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.code} · {supplier.name}</SelectItem>)}</SelectContent></Select>)}{field("每小时产能（pcs）", <Input type="text" inputMode="decimal" value={values.hourlyCapacity} onChange={event => updateDraft("hourlyCapacity", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("OEE（0–1）", <Input type="text" inputMode="decimal" value={values.oee} onChange={event => updateDraft("oee", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("能耗（kW）", <Input type="text" inputMode="decimal" value={values.energyConsumption} onChange={event => updateDraft("energyConsumption", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("数量（台）", <Input type="text" inputMode="decimal" value={values.quantity} onChange={event => updateDraft("quantity", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("单价（万元）", <Input type="text" inputMode="decimal" value={values.unitPrice} onChange={event => updateDraft("unitPrice", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("折旧年数", <Input type="text" inputMode="decimal" value={values.depreciationYears} onChange={event => updateDraft("depreciationYears", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("损耗系数", <Input type="text" inputMode="decimal" value={values.lossFactor} onChange={event => updateDraft("lossFactor", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className={inputClass} placeholder="未录入" />)}{field("合计金额（万元）", <p className="mt-1 h-8 pt-1 text-sm font-semibold text-[#405342]">{amount === null || Number.isNaN(amount) ? "未录入" : amount.toFixed(2)}</p>)}</div>{Number(values.oee) < 0.9 && values.oee !== "" && <label className="mt-3 block rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs font-medium text-amber-900">OEE 偏低原因<Textarea value={values.lowOeeReason} onChange={event => updateDraft("lowOeeReason", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className="mt-1 min-h-16 border-amber-200 bg-white text-sm text-[#405342]" placeholder="请说明 OEE 偏低原因" /></label>}<label className="mt-3 block rounded-xl border border-[#e4eee0] bg-[#fbfdf9] p-3 text-xs font-medium text-[#7c8c7b]">备注<Textarea value={values.notes} onChange={event => updateDraft("notes", event.target.value)} onBlur={() => queueSave(valuesRef.current)} disabled={!isAdmin} className="mt-1 min-h-20 border-[#d9e5d6] bg-white text-sm text-[#405342]" placeholder="未录入" /></label></div>;
}

const businessUnitCards = [
  { code: "BU1", name: "Injection and Pharma Delivery" },
  { code: "BU2", name: "Diagnostics" },
  { code: "BU3", name: "Diabetes Care" },
  { code: "BU4", name: "Vascular Access & Infusion Therapy" },
] as const;

function BusinessUnitOverview({ businessUnits, equipment, selectedCode, onSelect, language }: { businessUnits: any[]; equipment: any[]; selectedCode: string | null; onSelect: (code: string) => void; language: "zh" | "en" }) {
  const label = language === "en" ? { total: "Total equipment", active: "Running", alert: "Maintenance" } : { total: "设备总数", active: "运行中", alert: "维修中" };
  return <section className="mb-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4" aria-label={language === "en" ? "Business unit filters" : "业务单元筛选"}>{businessUnitCards.map(card => {
    const businessUnit = getSelectedBusinessUnit(businessUnits, card.code);
    const rows = filterEquipmentByBusinessUnit(equipment, businessUnit?.id ?? -1);
    const selected = selectedCode === card.code;
    return <button key={card.code} type="button" onClick={() => onSelect(card.code)} aria-pressed={selected} className={`overflow-hidden rounded-[22px] border bg-white text-left shadow-[0_12px_28px_rgba(69,111,74,.10)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(69,111,74,.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a7c59] ${selected ? "border-[#397349] ring-2 ring-[#b9dcb6]" : "border-[#cfe4c9]"}`}><div className="bg-gradient-to-r from-[#98cb91] to-[#84bb7f] px-4 py-3 text-center text-white"><p className="font-semibold tracking-wide">{card.code}</p><p className="mt-0.5 text-xs text-white/90">{card.name}</p></div><div className="flex items-center justify-between gap-4 px-5 py-4"><div className="flex h-14 w-14 items-center justify-center rounded-full border-[8px] border-[#eff6ea] text-xs font-semibold text-[#4a7c59]">{card.code}</div><div className="flex-1 space-y-1 text-xs text-[#718372]"><p className="flex justify-between"><span>{label.total}</span><b className="text-sm text-[#26392a]">{rows.length}</b></p><p className="flex justify-between"><span>{label.active}</span><b className="text-sm text-[#4a7c59]">{rows.filter(item => item.status === "running").length}</b></p><p className="flex justify-between"><span>{label.alert}</span><b className="text-sm text-[#c88625]">{rows.filter(item => item.status === "maintenance").length}</b></p></div></div>{selected && <p className="border-t border-[#e1eedc] bg-[#f3f9ef] px-4 py-2 text-center text-xs font-medium text-[#3f7049]">{language === "en" ? "Filtering equipment list · Click again to clear" : "正在筛选设备清单 · 再次点击可清除"}</p>}</button>;
  })}</section>;
}

function LegacyEquipmentView({ isAdmin }: { isAdmin: boolean }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [statusId, setStatusId] = useState<number | null>(null);
  const [expandedEquipmentId, setExpandedEquipmentId] = useState<number | null>(null);
  const [selectedBusinessUnitCode, setSelectedBusinessUnitCode] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const exportData = trpc.equipment.export.useQuery();
  const masterData = trpc.equipment.masterData.useQuery();
  const selectedBusinessUnit = useMemo(() => getSelectedBusinessUnit(masterData.data?.businessUnits ?? [], selectedBusinessUnitCode), [masterData.data?.businessUnits, selectedBusinessUnitCode]);
  const result = trpc.equipment.list.useQuery({ search: search || undefined, businessUnitId: selectedBusinessUnit?.id, page, pageSize: 8 });
  const history = trpc.equipment.statusHistory.useQuery({ equipmentId: historyId ?? 1 }, { enabled: historyId !== null });
  const create = trpc.equipment.create.useMutation({ onSuccess: () => { toast.success("设备已新增"); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); utils.dashboard.metrics.invalidate(); } });
  const update = trpc.equipment.update.useMutation({ onSuccess: () => { utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); } });
  const inlineUpdate = trpc.equipment.update.useMutation({ onSuccess: () => {
    utils.equipment.list.invalidate({ search: search || undefined, businessUnitId: selectedBusinessUnit?.id, page, pageSize: 8 });
    utils.equipment.export.invalidate();
  } });
  const remove = trpc.equipment.remove.useMutation({ onSuccess: () => { toast.success("设备已删除"); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); utils.dashboard.metrics.invalidate(); } });
  const changeStatus = trpc.equipment.changeStatus.useMutation({ onSuccess: () => { toast.success("设备状态已变更并留痕"); setStatusId(null); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); utils.dashboard.metrics.invalidate(); if (historyId) utils.equipment.statusHistory.invalidate({ equipmentId: historyId }); } });
  const batchImport = trpc.equipment.batchImport.useMutation({ onSuccess: data => { toast.success(`已处理 ${data.processed} 条设备台账`); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); utils.dashboard.metrics.invalidate(); } });
  const onImport = async (file?: File) => { if (!file) return; try { await batchImport.mutateAsync(await parseEquipmentWorkbook(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "设备台账导入失败"); } };
  const exportExcel = () => { downloadWorkbook("设备台账.xlsx", "设备台账", (exportData.data ?? []).map(item => equipmentExportRow(item, masterData.data?.businessUnits ?? [], masterData.data?.factories ?? [], masterData.data?.suppliers ?? []))); };
  const maxPage = Math.max(1, Math.ceil((result.data?.total ?? 0) / 8));
  const businessUnitById = useMemo(() => new Map((masterData.data?.businessUnits ?? []).map(item => [item.id, item])), [masterData.data?.businessUnits]);
  const factoryById = useMemo(() => new Map((masterData.data?.factories ?? []).map(item => [item.id, item])), [masterData.data?.factories]);
  return <><PageHeader title="设备管理" description="设备登记、权属、资质、保养与运行状态追踪。" action={<div className="flex flex-wrap gap-2"><input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={event => onImport(event.target.files?.[0])} />{isAdmin && <Button variant="outline" onClick={() => inputRef.current?.click()} className="border-[#9bbb9b] text-[#476e50]"><ArrowUpFromLine className="mr-2 h-4 w-4" />导入 Excel</Button>}<Button variant="outline" onClick={exportExcel} disabled={!exportData.data?.length} className="border-[#9bbb9b] text-[#476e50]"><ArrowDownToLine className="mr-2 h-4 w-4" />导出 Excel</Button>{isAdmin && <EquipmentDialog onSubmit={values => create.mutateAsync(toEquipmentPayload(values))} trigger={<Button className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"><Plus className="mr-2 h-4 w-4" />新增设备</Button>} />}</div>} /><BusinessUnitOverview businessUnits={masterData.data?.businessUnits ?? []} equipment={exportData.data ?? []} selectedCode={selectedBusinessUnitCode} onSelect={code => { setSelectedBusinessUnitCode(current => toggleBusinessUnitSelection(current, code)); setPage(1); setExpandedEquipmentId(null); }} language={language} /><div className="industrial-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#e5eee2] p-4 md:flex-row md:items-center md:justify-between"><div className="relative w-full md:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9a89]" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="搜索编号、名称或所属工序" className="border-[#d9e5d6] bg-[#fbfdf9] pl-9" /></div><div className="flex items-center gap-3"><span className="text-sm text-[#718372]">共 <strong className="font-semibold text-[#38543d]">{result.data?.total ?? 0}</strong> 条记录</span>{selectedBusinessUnit && <Button size="sm" variant="outline" onClick={() => { setSelectedBusinessUnitCode(null); setPage(1); }} className="border-[#9bbb9b] text-[#476e50]">清除 {selectedBusinessUnit.code} 筛选</Button>}</div></div>{result.data?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-[#eff7eb] text-left text-xs font-medium text-[#6a7d6a]"><tr>{["编号", "名称", "型号", "规格", "所属工序", "位置", "状态", "操作"].map(head => <th key={head} className="px-4 py-3.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#edf2eb]">{result.data.items.map(item => <tr key={item.id} className="transition-colors hover:bg-[#fbfdf9]"><td className="px-4 py-4 font-medium text-[#34513a]">{item.code}</td><td className="px-4 py-4 text-[#2d3b2d]">{item.name}</td><td className="px-4 py-4 text-[#627562]">{item.model}</td><td className="px-4 py-4 text-[#627562]">{item.specification}</td><td className="px-4 py-4 text-[#627562]">{item.process}</td><td className="px-4 py-4 text-[#627562]">{item.location}</td><td className="px-4 py-4"><Badge variant="outline" className={statusMeta[item.status].className}>{statusMeta[item.status].label}</Badge></td><td className="px-4 py-4"><div className="flex items-center gap-1"><Button size="sm" variant="ghost" onClick={() => navigate(`/equipment/${item.id}`)} className="h-8 px-2 text-[#56745b]">详情</Button><Button size="sm" variant="ghost" onClick={() => setHistoryId(item.id)} className="h-8 px-2 text-[#56745b]">历史</Button><Button size="sm" variant="ghost" onClick={() => setStatusId(item.id)} className="h-8 px-2 text-[#56745b]">状态</Button><Button size="sm" variant="ghost" onClick={() => navigate(`/apply/change/new?equipmentId=${item.id}`)} className="h-8 px-2 text-[#56745b]">申请</Button><Button size="sm" variant="ghost" className="h-8 px-2 text-[#56745b]">状态</Button>{isAdmin && <EquipmentDialog initial={toEquipmentForm(item)} onSubmit={values => update.mutateAsync({ id: item.id, values: toEquipmentPayload(values) })} trigger={<Button size="sm" variant="ghost" className="h-8 px-2 text-[#56745b]">编辑</Button>} />}{isAdmin && <Button size="sm" variant="ghost" onClick={() => { if (confirm(`确定删除设备“${item.name}”吗？`)) remove.mutate({ id: item.id }); }} className="h-8 px-2 text-rose-600">删除</Button>}</div></td></tr>)}</tbody></table></div> : <div className="p-6"><EmptyState title={selectedBusinessUnit ? `${selectedBusinessUnit.code} 暂无设备` : "暂无设备台账"} description={selectedBusinessUnit ? "当前 BU 暂无归属设备；可清除筛选查看全部设备。" : "管理员可新增设备，或按标准字段导入 Excel 台账；系统不会预置虚构设备数据。"} /></div>}<div className="flex items-center justify-between border-t border-[#e5eee2] px-4 py-3 text-sm text-[#718372]"><span>第 {page} / {maxPage} 页</span><div className="flex gap-1"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage(current => current - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={page >= maxPage} onClick={() => setPage(current => current + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div></div><Dialog open={historyId !== null} onOpenChange={open => !open && setHistoryId(null)}><DialogContent><DialogHeader><DialogTitle>设备状态变更历史</DialogTitle><DialogDescription>每次状态变更均记录变更前后状态、变更人及时间。</DialogDescription></DialogHeader><div className="max-h-80 space-y-2 overflow-y-auto">{history.data?.length ? history.data.map(item => <div key={item.id} className="rounded-xl bg-[#f5f9f2] p-3 text-sm text-[#526652]"><strong>{item.fromStatus ? statusMeta[item.fromStatus].label : "初始状态"}</strong> → <strong>{statusMeta[item.toStatus].label}</strong><span className="ml-2 text-xs text-[#829081]">{dateText(item.changedAt)}</span></div>) : <EmptyState title="暂无状态变更记录" description="初始登记后的状态变更将在此处显示。" />}</div></DialogContent></Dialog><Dialog open={statusId !== null} onOpenChange={open => !open && setStatusId(null)}><DialogContent><DialogHeader><DialogTitle>变更设备状态</DialogTitle><DialogDescription>状态变更会自动写入设备状态历史和操作日志。</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{Object.entries(statusMeta).map(([key, item]) => <Button key={key} variant="outline" disabled={changeStatus.isPending} onClick={() => statusId && changeStatus.mutate({ id: statusId, status: key as EquipmentForm["status"] })} className="justify-start border-[#d9e5d6] hover:bg-[#eff7eb]"><span className={`mr-2 h-2 w-2 rounded-full ${item.className.split(" ")[0]}`} />{item.label}</Button>)}</div></DialogContent></Dialog></>;
}

export function EquipmentTableRow({ item, expanded, isAdmin, businessUnits, factories, suppliers, onToggle, onInlineSave, onDelete }: { item: { status: keyof typeof statusMeta; [key: string]: any }; expanded: boolean; isAdmin: boolean; businessUnits: any[]; factories: any[]; suppliers: any[]; onToggle: () => void; onInlineSave: (values: EquipmentForm) => Promise<unknown>; onDelete: () => void }) {
  const interactive = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest("button,a,input,select,textarea"));
  return <><tr onClick={event => { if (!interactive(event.target)) onToggle(); }} className={`cursor-pointer transition-colors hover:bg-[#fbfdf9] ${expanded ? "bg-[#f8fcf6]" : ""}`} aria-expanded={expanded}><td className="px-4 py-4 font-medium text-[#34513a]">{item.code}</td><td className="px-4 py-4 text-[#2d3b2d]">{item.name}</td><td className="px-4 py-4 text-[#627562]">{item.model}</td><td className="px-4 py-4 text-[#627562]">{item.specification}</td><td className="px-4 py-4 text-[#627562]">{item.process}</td><td className="px-4 py-4 text-[#627562]">{item.location}</td><td className="px-4 py-4"><Badge variant="outline" className={statusMeta[item.status].className}>{statusMeta[item.status].label}</Badge></td><td className="px-4 py-4"><div className="flex items-center gap-1">{isAdmin && <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 px-2 text-rose-600">删除</Button>}</div></td></tr>{expanded && <tr className="bg-[#f6fbf3]"><td colSpan={8} className="px-5 py-5"><InlineEquipmentDetailEditor item={item} businessUnits={businessUnits} factories={factories} suppliers={suppliers} isAdmin={isAdmin} onSave={onInlineSave} /></td></tr>}</>;
}

function EquipmentView({ isAdmin }: { isAdmin: boolean }) {
  const { language } = useLanguage();
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [historyId, setHistoryId] = useState<number | null>(null); const [statusId, setStatusId] = useState<number | null>(null); const [expandedEquipmentId, setExpandedEquipmentId] = useState<number | null>(null); const [productDrawerOpen, setProductDrawerOpen] = useState(false); const [selectedBusinessUnitCode, setSelectedBusinessUnitCode] = useState<string | null>(null); const [, navigate] = useLocation(); const inputRef = useRef<HTMLInputElement>(null); const utils = trpc.useUtils();
  const masterData = trpc.equipment.masterData.useQuery(); const exportData = trpc.equipment.export.useQuery(); const selectedBusinessUnit = useMemo(() => getSelectedBusinessUnit(masterData.data?.businessUnits ?? [], selectedBusinessUnitCode), [masterData.data?.businessUnits, selectedBusinessUnitCode]); const result = trpc.equipment.list.useQuery({ search: search || undefined, businessUnitId: selectedBusinessUnit?.id, page, pageSize: 8 }); const history = trpc.equipment.statusHistory.useQuery({ equipmentId: historyId ?? 1 }, { enabled: historyId !== null });
  const refreshEquipment = () => { utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); utils.dashboard.metrics.invalidate(); };
  const create = trpc.equipment.create.useMutation({ onSuccess: () => { toast.success("设备已新增"); refreshEquipment(); } }); const update = trpc.equipment.update.useMutation({ onSuccess: refreshEquipment }); const inlineUpdate = trpc.equipment.update.useMutation({ onSuccess: refreshEquipment }); const remove = trpc.equipment.remove.useMutation({ onSuccess: () => { toast.success("设备已删除"); setExpandedEquipmentId(null); refreshEquipment(); } }); const changeStatus = trpc.equipment.changeStatus.useMutation({ onSuccess: () => { toast.success("设备状态已变更并留痕"); setStatusId(null); refreshEquipment(); if (historyId) utils.equipment.statusHistory.invalidate({ equipmentId: historyId }); } }); const batchImport = trpc.equipment.batchImport.useMutation({ onSuccess: data => { const message = importResultMessage("equipment", data.processed, language); toast.success(message, { id: "equipment-import-result", duration: Infinity }); publishImportResult(message); refreshEquipment(); } });
  const onImport = async (file?: File) => { if (!file) return; try { await batchImport.mutateAsync(await parseEquipmentWorkbook(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "设备台账导入失败"); } };
  const exportExcel = () => {
    downloadWorkbook("设备台账.xlsx", "设备台账", (exportData.data ?? []).map(item => equipmentExportRow(item, masterData.data?.businessUnits ?? [], masterData.data?.factories ?? [], masterData.data?.suppliers ?? [])));
    toast.success(language === "en" ? "Equipment register exported" : "设备台账已导出");
  };
  const maxPage = Math.max(1, Math.ceil((result.data?.total ?? 0) / 8)); const items = result.data?.items ?? []; const businessUnits = masterData.data?.businessUnits ?? []; const factories = masterData.data?.factories ?? []; const suppliers = masterData.data?.suppliers ?? [];
  return <><PageHeader title="设备管理" description="设备登记、权属、资质、保养与运行状态追踪。" action={<div className="flex flex-wrap gap-2"><input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={event => onImport(event.target.files?.[0])} />{isAdmin && <Button variant="outline" onClick={() => inputRef.current?.click()} className="border-[#9bbb9b] text-[#476e50]"><ArrowUpFromLine className="mr-2 h-4 w-4" />导入 Excel</Button>}<Button variant="outline" onClick={exportExcel} disabled={!exportData.data?.length} className="border-[#9bbb9b] text-[#476e50]"><ArrowDownToLine className="mr-2 h-4 w-4" />导出 Excel</Button><Button type="button" variant="outline" className="border-[#d9e5d6] bg-white text-[#476e50] hover:bg-[#f0f4ee]" onClick={() => setProductDrawerOpen(true)}><ImagePlus className="mr-2 h-4 w-4" />产品图册</Button>{isAdmin && <EquipmentDialog onSubmit={values => create.mutateAsync(toEquipmentPayload(values))} trigger={<Button className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"><Plus className="mr-2 h-4 w-4" />新增设备</Button>} />}</div>} /><ProductDrawer open={productDrawerOpen} onOpenChange={setProductDrawerOpen} onLocate={(id: number) => { setProductDrawerOpen(false); setExpandedEquipmentId(id); }} /><BusinessUnitOverview businessUnits={businessUnits} equipment={exportData.data ?? []} selectedCode={selectedBusinessUnitCode} onSelect={code => { setSelectedBusinessUnitCode(current => toggleBusinessUnitSelection(current, code)); setPage(1); setExpandedEquipmentId(null); }} language={language} /><div className="industrial-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-[#e5eee2] p-4 md:flex-row md:items-center md:justify-between"><div className="relative w-full md:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a9a89]" /><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); setExpandedEquipmentId(null); }} placeholder="搜索编号、名称或所属工序" className="border-[#d9e5d6] bg-[#fbfdf9] pl-9" /></div><div className="flex items-center gap-3"><span className="text-sm text-[#718372]">共 <strong className="font-semibold text-[#38543d]">{result.data?.total ?? 0}</strong> 条记录</span>{selectedBusinessUnit && <Button size="sm" variant="outline" onClick={() => { setSelectedBusinessUnitCode(null); setPage(1); setExpandedEquipmentId(null); }} className="border-[#9bbb9b] text-[#476e50]">清除 {selectedBusinessUnit.code} 筛选</Button>}</div></div>{items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-[#eff7eb] text-left text-xs font-medium text-[#6a7d6a]"><tr>{["编号", "名称", "型号", "规格", "所属工序", "位置", "状态", "操作"].map(head => <th key={head} className="px-4 py-3.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#edf2eb]">{items.map(item => <EquipmentTableRow key={item.id} item={item} expanded={expandedEquipmentId === item.id} isAdmin={isAdmin} businessUnits={businessUnits} factories={factories} suppliers={suppliers} onToggle={() => setExpandedEquipmentId(current => current === item.id ? null : item.id)} onInlineSave={values => inlineUpdate.mutateAsync({ id: item.id, values: toEquipmentPayload(values) })} onDelete={() => { if (confirm(`确定删除设备“${item.name}”吗？`)) remove.mutate({ id: item.id }); }} />)}</tbody></table></div> : <div className="p-6"><EmptyState title={selectedBusinessUnit ? `${selectedBusinessUnit.code} 暂无设备` : "暂无设备台账"} description={selectedBusinessUnit ? "当前 BU 暂无归属设备；可清除筛选查看全部设备。" : "管理员可新增设备，或按标准字段导入 Excel 台账；系统不会预置虚构设备数据。"} /></div>}<div className="flex items-center justify-between border-t border-[#e5eee2] px-4 py-3 text-sm text-[#718372]"><span>第 {page} / {maxPage} 页</span><div className="flex gap-1"><Button variant="outline" size="icon" disabled={page <= 1} onClick={() => { setPage(current => current - 1); setExpandedEquipmentId(null); }}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" disabled={page >= maxPage} onClick={() => { setPage(current => current + 1); setExpandedEquipmentId(null); }}><ChevronRight className="h-4 w-4" /></Button></div></div></div><Dialog open={historyId !== null} onOpenChange={open => !open && setHistoryId(null)}><DialogContent><DialogHeader><DialogTitle>设备状态变更历史</DialogTitle><DialogDescription>每次状态变更均记录变更前后状态、变更人及时间。</DialogDescription></DialogHeader><div className="max-h-80 space-y-2 overflow-y-auto">{history.data?.length ? history.data.map(item => <div key={item.id} className="rounded-xl bg-[#f5f9f2] p-3 text-sm text-[#526652]"><strong>{item.fromStatus ? statusMeta[item.fromStatus].label : "初始状态"}</strong> → <strong>{statusMeta[item.toStatus].label}</strong><span className="ml-2 text-xs text-[#829081]">{dateText(item.changedAt)}</span></div>) : <EmptyState title="暂无状态变更记录" description="初始登记后的状态变更将在此处显示。" />}</div></DialogContent></Dialog><Dialog open={statusId !== null} onOpenChange={open => !open && setStatusId(null)}><DialogContent><DialogHeader><DialogTitle>变更设备状态</DialogTitle><DialogDescription>状态变更会自动写入设备状态历史和操作日志。</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{Object.entries(statusMeta).map(([key, meta]) => <Button key={key} variant="outline" disabled={changeStatus.isPending} onClick={() => statusId && changeStatus.mutate({ id: statusId, status: key as EquipmentForm["status"] })} className="justify-start border-[#d9e5d6] hover:bg-[#eff7eb]"><span className={`mr-2 h-2 w-2 rounded-full ${meta.className.split(" ")[0]}`} />{meta.label}</Button>)}</div></DialogContent></Dialog></>;
}

function MaintenanceView({ isAdmin }: { isAdmin: boolean }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false); const [equipmentId, setEquipmentId] = useState(""); const [cycleDays, setCycleDays] = useState("30"); const [content, setContent] = useState(""); const [scheduledAt, setScheduledAt] = useState(""); const [completionDraft, setCompletionDraft] = useState<MaintenanceCompletionDraft | null>(null); const inputRef = useRef<HTMLInputElement>(null); const utils = trpc.useUtils();
  const hasValidCycleDays = isValidMaintenanceCycle(cycleDays);
  const equipment = trpc.equipment.export.useQuery(undefined, { refetchOnMount: "always", staleTime: 0 }); const rows = trpc.maintenance.list.useQuery(undefined, { refetchOnMount: "always", staleTime: 0 });
  const createPlan = trpc.maintenance.createPlan.useMutation({ onSuccess: () => { toast.success("保养计划已建立，并生成首张工单"); setOpen(false); utils.maintenance.list.invalidate(); utils.dashboard.metrics.invalidate(); } });
  const complete = trpc.maintenance.complete.useMutation({ onSuccess: () => { toast.success("保养工单已完成，下一周期工单已生成"); setCompletionDraft(null); utils.maintenance.list.invalidate(); utils.dashboard.metrics.invalidate(); }, onError: error => toast.error(error.message || "保养工单完成失败") });
  const batchImport = trpc.maintenance.batchImport.useMutation({ onSuccess: data => { const message = importResultMessage("maintenance", data.processed, language); toast.success(message, { id: "maintenance-import-result", duration: Infinity }); publishImportResult(message); utils.maintenance.list.invalidate(); utils.dashboard.metrics.invalidate(); } });
  const equipmentById = new Map((equipment.data ?? []).map(item => [item.id, item]));
  const exportExcel = () => downloadWorkbook("保养记录.xlsx", "保养记录", (rows.data ?? []).filter(item => item.status === "completed").map(item => ({ "设备编号": equipmentById.get(item.equipmentId)?.code ?? "", "执行人": item.executor ?? "", "完成时间": item.completedAt ?? "", "保养内容": item.maintenanceContent, "备注": item.notes ?? "" })));
  if (rows.isLoading && rows.data === undefined) {
    return <><PageHeader eyebrow="预防性维护" title="保养计划与工单" description="正在读取已建立的保养计划与工单。" /><div className="industrial-card flex min-h-52 items-center justify-center gap-3 text-sm text-[#607260]"><Loader2 className="h-5 w-5 animate-spin text-[#4a7c59]" />正在加载保养计划与工单…</div></>;
  }
  return <>
    <PageHeader
      eyebrow="预防性维护"
      title="保养计划与工单"
      description="制定设备周期性保养计划，完成工单后自动生成下一周期待执行记录。"
      action={<div className="flex gap-2">
        <input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={async event => { try { const file = event.target.files?.[0]; if (file) await batchImport.mutateAsync(await parseMaintenanceWorkbook(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "保养记录导入失败"); } }} />
        {isAdmin && <Button variant="outline" onClick={() => inputRef.current?.click()} className="border-[#9bbb9b] text-[#476e50]"><ArrowUpFromLine className="mr-2 h-4 w-4" />导入 Excel</Button>}
        <Button variant="outline" onClick={exportExcel} disabled={!rows.data?.some(item => item.status === "completed")} className="border-[#9bbb9b] text-[#476e50]"><ArrowDownToLine className="mr-2 h-4 w-4" />导出 Excel</Button>
        {isAdmin && <Button onClick={() => setOpen(true)} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"><Plus className="mr-2 h-4 w-4" />制定计划</Button>}
      </div>}
    />
    <div className="industrial-card overflow-hidden">
      {rows.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-[#eff7eb] text-left text-xs text-[#6a7d6a]"><tr>{["工单", "设备", "计划时间", "状态", "执行人", "完成时间", "操作"].map(head => <th key={head} className="px-4 py-3.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#edf2eb]">{rows.data.map(item => <tr key={item.id}><td className="px-4 py-4 font-medium text-[#38543d]">#{item.id}</td><td className="px-4 py-4">{equipmentById.get(item.equipmentId)?.name ?? `设备 #${item.equipmentId}`}</td><td className="px-4 py-4 text-[#627562]">{dateText(item.scheduledAt)}</td><td className="px-4 py-4"><Badge variant="outline" className="border-[#d7e6d5] bg-[#f8fbf6] text-[#58705a]">{maintenanceStatus[item.status]}</Badge></td><td className="px-4 py-4 text-[#627562]">{item.executor ?? "—"}</td><td className="px-4 py-4 text-[#627562]">{dateText(item.completedAt)}</td><td className="px-4 py-4">{item.status !== "completed" ? <Button size="sm" variant="outline" onClick={() => setCompletionDraft(createMaintenanceCompletionDraft(item.id, item.maintenanceContent))} className="border-[#9bbb9b] text-[#476e50]">完成工单</Button> : <span className="text-xs text-[#829081]">已留痕</span>}</td></tr>)}</tbody></table></div> : <div className="p-6"><EmptyState title="暂无保养计划或工单" description="制定周期性保养计划后，系统会生成首张待执行工单。" /></div>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>制定周期性保养计划</DialogTitle><DialogDescription>系统根据周期生成首张保养工单；完成后将自动推进下一周期。</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1.5"><label className="text-sm font-medium">设备</label><Select value={equipmentId} onValueChange={setEquipmentId}><SelectTrigger><SelectValue placeholder="选择设备" /></SelectTrigger><SelectContent>{(equipment.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><label className="text-sm font-medium">保养周期（天）</label><Input type="text" inputMode="decimal" value={cycleDays} onChange={event => setCycleDays(event.target.value)} className="border-[#d9e5d6] bg-white focus-visible:ring-[#6f9a73]" /><p className="text-xs text-[#718372]">仅支持大于 0 的整数天数。</p></div><FormInput label="计划时间" type="datetime-local" value={scheduledAt} onChange={setScheduledAt} /><div className="space-y-1.5"><label className="text-sm font-medium">保养内容</label><Textarea value={content} onChange={event => setContent(event.target.value)} required /></div></div><DialogFooter><Button disabled={!equipmentId || !scheduledAt || !content || !hasValidCycleDays || createPlan.isPending} onClick={() => createPlan.mutate({ equipmentId: Number(equipmentId), cycleDays: Number(cycleDays), maintenanceContent: content, nextScheduledAt: new Date(scheduledAt) })} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">生成计划与工单</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={completionDraft !== null} onOpenChange={dialogOpen => !dialogOpen && setCompletionDraft(null)}><DialogContent><DialogHeader><DialogTitle>完成保养工单</DialogTitle><DialogDescription>确认执行信息后，系统将完成当前工单并生成下一周期待执行记录。</DialogDescription></DialogHeader>{completionDraft && <div className="space-y-3"><FormInput label="执行人" value={completionDraft.executor} onChange={executor => setCompletionDraft(current => current ? { ...current, executor } : current)} /><div className="space-y-1.5"><label className="text-sm font-medium">保养内容</label><Textarea value={completionDraft.maintenanceContent} onChange={event => setCompletionDraft(current => current ? { ...current, maintenanceContent: event.target.value } : current)} /></div><div className="space-y-1.5"><label className="text-sm font-medium">备注（可选）</label><Textarea value={completionDraft.notes} onChange={event => setCompletionDraft(current => current ? { ...current, notes: event.target.value } : current)} /></div></div>}<DialogFooter><Button disabled={!canSubmitMaintenanceCompletion(completionDraft) || complete.isPending} onClick={() => completionDraft && complete.mutate({ workOrderId: completionDraft.workOrderId, executor: completionDraft.executor.trim(), maintenanceContent: completionDraft.maintenanceContent.trim(), notes: completionDraft.notes.trim() || undefined })} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">完成并生成下期工单</Button></DialogFooter></DialogContent></Dialog>
  </>;
}

function RepairsView() {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false); const [equipmentId, setEquipmentId] = useState(""); const [description, setDescription] = useState(""); const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium"); const [discoveredAt, setDiscoveredAt] = useState(""); const inputRef = useRef<HTMLInputElement>(null); const utils = trpc.useUtils(); const finishPrompt = useFormPrompt();
  const equipment = trpc.equipment.export.useQuery(); const faults = trpc.repairs.faults.useQuery(); const repairs = trpc.repairs.list.useQuery();
  const fault = trpc.repairs.createFault.useMutation({ onSuccess: () => { toast.success("故障已登记"); setOpen(false); utils.repairs.faults.invalidate(); utils.dashboard.metrics.invalidate(); } }); const createRepair = trpc.repairs.create.useMutation({ onSuccess: () => { toast.success("维修工单已创建"); utils.repairs.faults.invalidate(); utils.repairs.list.invalidate(); } }); const finishRepair = trpc.repairs.complete.useMutation({ onSuccess: () => { toast.success("维修工单已完成"); utils.repairs.faults.invalidate(); utils.repairs.list.invalidate(); utils.dashboard.metrics.invalidate(); } }); const batchImport = trpc.repairs.batchImport.useMutation({ onSuccess: data => { const message = importResultMessage("repair", data.processed, language); toast.success(message, { id: "repair-import-result", duration: Infinity }); publishImportResult(message); utils.repairs.list.invalidate(); utils.dashboard.metrics.invalidate(); } });
  const equipmentById = new Map((equipment.data ?? []).map(item => [item.id, item])); const faultById = new Map((faults.data ?? []).map(item => [item.id, item]));
  const exportExcel = () => downloadWorkbook("维修记录.xlsx", "维修记录", (repairs.data ?? []).filter(item => item.status === "completed").map(item => ({ "设备编号": equipmentById.get(item.equipmentId)?.code ?? "", "维修人员": item.technician ?? "", "维修内容": item.repairContent ?? "", "费用": item.repairCost, "完成时间": item.completedAt ?? "" })));
  return <><PageHeader eyebrow="故障闭环" title="故障报修与维修记录" description="从故障登记到维修完成，记录严重程度、维修人员、维修内容、费用与完成时间。" action={<div className="flex gap-2"><input ref={inputRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={async event => { try { const file = event.target.files?.[0]; if (file) await batchImport.mutateAsync(await parseRepairWorkbook(file)); } catch (error) { toast.error(error instanceof Error ? error.message : "维修记录导入失败"); } }} /><Button variant="outline" onClick={() => inputRef.current?.click()} className="border-[#9bbb9b] text-[#476e50]"><ArrowUpFromLine className="mr-2 h-4 w-4" />导入 Excel</Button><Button variant="outline" onClick={exportExcel} disabled={!repairs.data?.some(item => item.status === "completed")} className="border-[#9bbb9b] text-[#476e50]"><ArrowDownToLine className="mr-2 h-4 w-4" />导出 Excel</Button><Button onClick={() => setOpen(true)} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"><Plus className="mr-2 h-4 w-4" />故障登记</Button></div>} /><div className="grid gap-5 xl:grid-cols-[1fr_1.35fr]"><article className="industrial-card overflow-hidden"><div className="border-b border-[#e5eee2] px-5 py-4"><h2 className="font-semibold text-[#26392a]">故障登记</h2></div>{faults.data?.length ? <div className="divide-y divide-[#edf2eb]">{faults.data.map(item => <div key={item.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-[#314a36]">{equipmentById.get(item.equipmentId)?.name ?? `设备 #${item.equipmentId}`}</p><p className="mt-1 text-sm text-[#627562]">{item.description}</p></div><Badge variant="outline" className={item.severity === "critical" || item.severity === "high" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{({ low: "低", medium: "中", high: "高", critical: "严重" } as const)[item.severity]}</Badge></div><div className="mt-3 flex items-center justify-between"><span className="text-xs text-[#829081]">发现于 {dateText(item.discoveredAt)}</span>{item.status === "open" && <Button size="sm" variant="outline" onClick={() => createRepair.mutate({ faultId: item.id, equipmentId: item.equipmentId })} className="border-[#9bbb9b] text-[#476e50]">创建维修工单</Button>}</div></div>)}</div> : <div className="p-5"><EmptyState title="暂无故障登记" description="可在发现设备异常时登记故障，并创建对应维修工单。" /></div>}</article><article className="industrial-card overflow-hidden"><div className="border-b border-[#e5eee2] px-5 py-4"><h2 className="font-semibold text-[#26392a]">维修工单跟踪</h2></div>{repairs.data?.length ? <div className="divide-y divide-[#edf2eb]">{repairs.data.map(item => <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-medium text-[#314a36]">{equipmentById.get(item.equipmentId)?.name ?? `设备 #${item.equipmentId}`}</p><p className="mt-1 text-xs text-[#829081]">{item.faultId ? faultById.get(item.faultId)?.description ?? "关联故障" : "Excel 导入历史记录"}</p></div><div className="flex items-center gap-3"><Badge variant="outline" className="border-[#d7e6d5] bg-[#f8fbf6] text-[#58705a]">{repairStatus[item.status]}</Badge>{item.status !== "completed" ? <Button size="sm" variant="outline" onClick={() => finishPrompt.open({ title: "完成维修工单", description: equipmentById.get(item.equipmentId)?.name ?? `设备 #${item.equipmentId}`, fields: [{ key: "technician", label: "维修人员", initial: item.technician ?? "" }, { key: "repairContent", label: "维修内容", initial: item.repairContent ?? "" }, { key: "repairCost", label: "维修费用（元）", initial: item.repairCost ?? "" }], submitLabel: "确认完成" }).then(values => { if (values?.technician && values.repairContent && values.repairCost) finishRepair.mutate({ workOrderId: item.id, technician: values.technician, repairContent: values.repairContent, repairCost: values.repairCost }); })} className="border-[#9bbb9b] text-[#476e50]">完成维修</Button> : <span className="text-xs text-[#829081]">{dateText(item.completedAt)}</span>}</div></div>)}</div> : <div className="p-5"><EmptyState title="暂无维修工单" description="创建故障对应的维修工单，完成后将形成可导出的维修记录。" /></div>}</article></div><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>故障登记</DialogTitle><DialogDescription>登记故障描述、发现时间与严重程度；随后可创建维修工单持续跟踪。</DialogDescription></DialogHeader><div className="space-y-3"><div className="space-y-1.5"><label className="text-sm font-medium">设备</label><Select value={equipmentId} onValueChange={setEquipmentId}><SelectTrigger><SelectValue placeholder="选择设备" /></SelectTrigger><SelectContent>{(equipment.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.name}</SelectItem>)}</SelectContent></Select></div><FormInput label="发现时间" type="datetime-local" value={discoveredAt} onChange={setDiscoveredAt} /><div className="space-y-1.5"><label className="text-sm font-medium">严重程度</label><Select value={severity} onValueChange={value => setSeverity(value as typeof severity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">低</SelectItem><SelectItem value="medium">中</SelectItem><SelectItem value="high">高</SelectItem><SelectItem value="critical">严重</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><label className="text-sm font-medium">故障描述</label><Textarea value={description} onChange={event => setDescription(event.target.value)} /></div></div><DialogFooter><Button disabled={!equipmentId || !discoveredAt || !description || fault.isPending} onClick={() => fault.mutate({ equipmentId: Number(equipmentId), description, discoveredAt: new Date(discoveredAt), severity })} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">保存故障登记</Button></DialogFooter></DialogContent></Dialog>{finishPrompt.host}</>;
}

function PartsView({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(""); const [specification, setSpecification] = useState(""); const [stockQuantity, setStockQuantity] = useState("0"); const [safetyStock, setSafetyStock] = useState("0"); const utils = trpc.useUtils(); const rows = trpc.parts.list.useQuery(); const create = trpc.parts.create.useMutation({ onSuccess: () => { toast.success("备件已新增"); setOpen(false); utils.parts.list.invalidate(); utils.dashboard.metrics.invalidate(); } }); const transaction = trpc.parts.recordTransaction.useMutation({ onSuccess: () => { toast.success("库存流水已记录"); utils.parts.list.invalidate(); utils.dashboard.metrics.invalidate(); } }); const stockPrompt = useFormPrompt();
  return <><PageHeader eyebrow="库存保障" title="备件 / 耗材管理" description="维护备件名称、规格、库存数量与安全库存，并对每次入库、领用进行留痕。" action={isAdmin ? <Button onClick={() => setOpen(true)} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"><Plus className="mr-2 h-4 w-4" />新增备件</Button> : undefined} /><div className="industrial-card overflow-hidden">{rows.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-sm"><thead className="bg-[#eff7eb] text-left text-xs text-[#6a7d6a]"><tr>{["名称", "规格", "库存数量", "安全库存", "库存状态", "操作"].map(head => <th key={head} className="px-4 py-3.5 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#edf2eb]">{rows.data.map(item => { const atRisk = item.stockQuantity <= item.safetyStock; return <tr key={item.id}><td className="px-4 py-4 font-medium text-[#38543d]">{item.name}</td><td className="px-4 py-4 text-[#627562]">{item.specification}</td><td className="px-4 py-4 font-semibold text-[#314a36]">{item.stockQuantity}</td><td className="px-4 py-4 text-[#627562]">{item.safetyStock}</td><td className="px-4 py-4"><Badge variant="outline" className={atRisk ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{atRisk ? "低于安全库存" : "库存充足"}</Badge></td><td className="px-4 py-4"><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => stockPrompt.open({ title: "备件入库", description: item.name, fields: [{ key: "quantity", label: "入库数量", type: "number" }], submitLabel: "确认入库" }).then(values => { if (values?.quantity) transaction.mutate({ partId: item.id, transactionType: "inbound", quantity: Number(values.quantity) }); })} className="border-[#9bbb9b] text-[#476e50]"><ArrowDownToLine className="mr-1 h-3.5 w-3.5" />入库</Button><Button size="sm" variant="outline" onClick={() => stockPrompt.open({ title: "备件领用", description: item.name, fields: [{ key: "quantity", label: "领用数量", type: "number" }], submitLabel: "确认领用" }).then(values => { if (values?.quantity) transaction.mutate({ partId: item.id, transactionType: "outbound", quantity: Number(values.quantity) }); })} className="border-[#d9c99b] text-[#876a26]"><ArrowUpFromLine className="mr-1 h-3.5 w-3.5" />领用</Button></div></td></tr>})}</tbody></table></div> : <div className="p-6"><EmptyState title="暂无备件或耗材台账" description="管理员可新增备件；后续每次入库与领用都将形成库存流水和操作日志。" /></div>}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>新增备件 / 耗材</DialogTitle><DialogDescription>请维护备件台账的名称、规格、库存数量与安全库存。</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><FormInput label="名称" value={name} onChange={setName} /><FormInput label="规格" value={specification} onChange={setSpecification} /><FormInput label="库存数量" type="number" value={stockQuantity} onChange={setStockQuantity} /><FormInput label="安全库存" type="number" value={safetyStock} onChange={setSafetyStock} /></div><DialogFooter><Button disabled={!name || !specification || create.isPending} onClick={() => create.mutate({ name, specification, stockQuantity: Number(stockQuantity), safetyStock: Number(safetyStock) })} className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">保存备件</Button></DialogFooter></DialogContent></Dialog>{stockPrompt.host}</>;
}

function ProductDrawer({ open, onOpenChange, onLocate }: { open: boolean; onOpenChange: (open: boolean) => void; onLocate: (equipmentId: number) => void }) {
  const masterData = trpc.equipment.masterData.useQuery(undefined, { enabled: open });
  const equipmentList = trpc.equipment.list.useQuery({ page: 1, pageSize: 100 }, { enabled: open });
  const [buFilter, setBuFilter] = useState<string>("all");
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const products: ProductOption[] = masterData.data?.products ?? [];
  const equipmentItems: any[] = equipmentList.data?.items ?? [];
  const businessUnits: any[] = masterData.data?.businessUnits ?? [];
  const matchesBu = (item: any) => buFilter === "all" || item.businessUnitId === Number(buFilter);
  const visibleProducts = buFilter === "all" ? products : products.filter((item: ProductOption) => equipmentItems.some((e: any) => e.productId === item.id && matchesBu(e)));
  const statusText: Record<string, string> = { running: "运行中", standby: "待机", stopped: "停机", maintenance: "保养中", fault: "故障", scrapped: "报废" };
  return <Sheet open={open} onOpenChange={onOpenChange}>
<SheetContent side="right" className="w-full overflow-y-auto p-6 sm:max-w-md">
<SheetHeader>
<SheetTitle>产品图册</SheetTitle>
<SheetDescription>按 BU 筛选产品，点击产品图片展开其设备族，点击设备可定位到设备列表。</SheetDescription>
</SheetHeader>
<div className="mt-4 flex flex-wrap gap-2">
<button type="button" onClick={() => setBuFilter("all")} className={`rounded-full border px-3 py-1 text-xs font-medium ${buFilter === "all" ? "border-[#4a7c59] bg-[#4a7c59] text-white" : "border-[#d9e5d6] bg-white text-[#476e50]"}`}>All</button>
{businessUnits.map((unit: any) => <button key={unit.id} type="button" onClick={() => setBuFilter(String(unit.id))} className={`rounded-full border px-3 py-1 text-xs font-medium ${buFilter === String(unit.id) ? "border-[#4a7c59] bg-[#4a7c59] text-white" : "border-[#d9e5d6] bg-white text-[#476e50]"}`}>{unit.code}</button>)}
</div>
<div className="mt-4 space-y-3">
{visibleProducts.map((item: ProductOption) => { const count = equipmentItems.filter((e: any) => e.productId === item.id && matchesBu(e)).length; const family = activeProductId === item.id ? equipmentItems.filter((e: any) => e.productId === item.id && matchesBu(e)) : []; return <div key={item.id} className="rounded-2xl border border-[#d9e5d6] bg-white p-3 shadow-sm">
<button type="button" onClick={() => setActiveProductId(activeProductId === item.id ? null : item.id)} className="block w-full text-left">
{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-40 w-full rounded-xl object-cover" /> : <div className="flex h-40 w-full items-center justify-center rounded-xl bg-[#f0f4ee] text-sm text-[#829081]">暂无图片</div>}
<div className="mt-2 flex items-center justify-between gap-2"><span className="text-sm font-semibold text-[#2f3e2f]">{item.name}</span><span className="shrink-0 text-xs text-[#829081]">{item.code} · {count} 台设备</span></div>
</button>
{activeProductId === item.id && <div className="mt-2 divide-y divide-[#e5ede2] rounded-xl border border-[#e5ede2]">
{family.length === 0 ? <p className="p-3 text-xs text-[#829081]">该产品暂无关联设备。</p> : family.map((e: any) => <button key={e.id} type="button" onClick={() => onLocate(e.id)} className="flex w-full items-center justify-between gap-2 p-2.5 text-left text-xs hover:bg-[#f0f4ee]"><span className="font-medium text-[#2f3e2f]">{e.code} · {e.name}</span><span className="shrink-0 text-[#829081]">{statusText[e.status] ?? e.status}</span></button>)}
</div>}
</div>; })}
{visibleProducts.length === 0 && <p className="text-sm text-[#829081]">当前筛选下暂无产品，可在后台基础数据管理中新增产品并上传图片。</p>}
</div>
</SheetContent>
</Sheet>;
}

function MasterDataPanel() {
  const utils = trpc.useUtils();
  const promptDialog = useFormPrompt();
  const businessUnits = trpc.operations.businessUnits.useQuery();
  const factories = trpc.operations.factories.useQuery();
  const suppliers = trpc.operations.suppliers.useQuery();
  const products = trpc.products.list.useQuery();
  const createProduct = trpc.products.create.useMutation({ onSuccess: () => { toast.success("产品已创建"); utils.products.list.invalidate(); utils.equipment.masterData.invalidate(); }, onError: error => toast.error(error.message || "产品创建失败") });
  const updateProduct = trpc.products.update.useMutation({ onSuccess: () => { toast.success("产品已更新"); utils.products.list.invalidate(); utils.equipment.masterData.invalidate(); }, onError: error => toast.error(error.message || "产品更新失败") });
  const deleteProduct = trpc.products.delete.useMutation({ onSuccess: () => { toast.success("产品已删除"); utils.products.list.invalidate(); utils.equipment.masterData.invalidate(); }, onError: error => toast.error(error.message || "产品删除失败") });
  const addProduct = async () => { const result = await promptDialog.open({ title: "新增产品", fields: [{ key: "code", label: "产品编码", placeholder: "例如 FRH" }, { key: "name", label: "产品名称", placeholder: "例如 Fast Release Holder" }] }); if (!result) return; const code = result.code.trim(); const name = result.name.trim(); if (code && name) createProduct.mutate({ code, name }); };
  const editProduct = async (item: ProductOption) => { const result = await promptDialog.open({ title: "编辑产品", fields: [{ key: "code", label: `产品编码（当前 ${item.code}，留空保留）` }, { key: "name", label: `产品名称（当前 ${item.name}，留空保留）` }, { key: "imageUrl", label: "图片链接（留空保留）" }] }); if (!result) return; await updateProduct.mutateAsync({ id: item.id, values: { code: result.code.trim() || item.code, name: result.name.trim() || item.name, imageUrl: result.imageUrl.trim() || item.imageUrl } }); };
  const uploadProductImage = async (item: ProductOption, file: File) => { try { const url = await uploadImageFile(file); await updateProduct.mutateAsync({ id: item.id, values: { imageUrl: url } }); } catch (error) { toast.error(error instanceof Error ? error.message : "图片上传失败"); } };
  const removeProduct = (item: ProductOption) => { if (confirm(`确定删除产品“${item.name}”吗？设备的产品关联将解除。`)) deleteProduct.mutate({ id: item.id }); };
  const createBusinessUnit = trpc.operations.createBusinessUnit.useMutation({ onSuccess: () => { toast.success("BU 已创建"); utils.operations.businessUnits.invalidate(); } });
  const createFactory = trpc.operations.createFactory.useMutation({ onSuccess: () => { toast.success("工厂已创建"); utils.operations.factories.invalidate(); } });
  const createSupplier = trpc.operations.createSupplier.useMutation({ onSuccess: () => { toast.success("供应商已创建"); utils.operations.suppliers.invalidate(); utils.equipment.masterData.invalidate(); } });
  const updateSupplier = trpc.operations.updateSupplier.useMutation({ onSuccess: () => { toast.success("供应商已更新"); utils.operations.suppliers.invalidate(); utils.equipment.masterData.invalidate(); } });
  const deleteSupplier = trpc.operations.deleteSupplier.useMutation({ onSuccess: () => { toast.success("供应商已删除，设备历史名称已保留"); utils.operations.suppliers.invalidate(); utils.equipment.masterData.invalidate(); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); } });
  const updateBusinessUnit = trpc.operations.updateBusinessUnit.useMutation({ onSuccess: () => { toast.success("BU 已更新"); utils.operations.businessUnits.invalidate(); utils.equipment.masterData.invalidate(); } });
  const deleteBusinessUnitMutation = trpc.operations.deleteBusinessUnit.useMutation({ onSuccess: () => { toast.success("BU 已删除，工厂与设备的归属已置空"); utils.operations.businessUnits.invalidate(); utils.operations.factories.invalidate(); utils.equipment.masterData.invalidate(); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); } });
  const updateFactory = trpc.operations.updateFactory.useMutation({ onSuccess: () => { toast.success("工厂已更新"); utils.operations.factories.invalidate(); utils.equipment.masterData.invalidate(); } });
  const deleteFactoryMutation = trpc.operations.deleteFactory.useMutation({ onSuccess: () => { toast.success("工厂已删除，设备工厂归属已置空"); utils.operations.factories.invalidate(); utils.equipment.masterData.invalidate(); utils.equipment.list.invalidate(); utils.equipment.export.invalidate(); } });
  const addBu = async () => { const result = await promptDialog.open({ title: "新增 BU", fields: [{ key: "code", label: "BU 编码", placeholder: "例如 BU1" }, { key: "name", label: "BU 名称", placeholder: "例如 Injection and Pharma Delivery" }] }); if (!result) return; const code = result.code; const name = result.name; if (code && name) createBusinessUnit.mutate({ code, name }); };
  const addFactory = async () => { const result = await promptDialog.open({ title: "新增工厂", fields: [{ key: "code", label: "工厂编码", placeholder: "例如 F01" }, { key: "name", label: "工厂名称", placeholder: "例如 稳健平安" }] }); if (!result) return; const code = result.code; const name = result.name; if (code && name) createFactory.mutate({ code, name, businessUnitId: null }); };
  const addSupplier = async () => { const result = await promptDialog.open({ title: "新增供应商", fields: [{ key: "code", label: "供应商编码", placeholder: "例如 SUP-001" }, { key: "name", label: "供应商名称" }, { key: "contactName", label: "联系人", optional: true }, { key: "phone", label: "联系电话", optional: true }] }); if (!result) return; const code = result.code; const name = result.name; if (code && name) createSupplier.mutate({ code, name, contactName: result.contactName || undefined, phone: result.phone || undefined }); };
  const editSupplier = async (supplier: { id: number; code: string; name: string; contactName: string | null; phone: string | null }) => { const result = await promptDialog.open({ title: "编辑供应商", fields: [{ key: "code", label: "供应商编码", initial: supplier.code }, { key: "name", label: "供应商名称", initial: supplier.name }] }); if (!result) return; const code = result.code; const name = result.name; if (code && name) updateSupplier.mutate({ id: supplier.id, values: { code, name, contactName: supplier.contactName, phone: supplier.phone } }); };
  const editBusinessUnit = async (unit: { id: number; code: string; name: string }) => { const result = await promptDialog.open({ title: "编辑 BU", fields: [{ key: "code", label: "BU 编码", initial: unit.code }, { key: "name", label: "BU 名称", initial: unit.name }] }); if (!result) return; const code = result.code; const name = result.name; if (code && name) updateBusinessUnit.mutate({ id: unit.id, values: { code, name } }); };
  const removeBusinessUnit = (unit: { id: number; name: string }) => { if (confirm(`确定删除 BU“${unit.name}”吗？其下工厂与设备的归属将置空。`)) deleteBusinessUnitMutation.mutate({ id: unit.id }); };
  const editFactoryItem = async (factory: { id: number; code: string; name: string; businessUnitId: number | null }) => { const result = await promptDialog.open({ title: "编辑工厂", fields: [{ key: "code", label: "工厂编码", initial: factory.code }, { key: "name", label: "工厂名称", initial: factory.name }] }); if (!result) return; const code = result.code; const name = result.name; if (code && name) updateFactory.mutate({ id: factory.id, values: { code, name } }); };
  const removeFactory = (factory: { id: number; name: string }) => { if (confirm(`确定删除工厂“${factory.name}”吗？设备的工厂归属将置空。`)) deleteFactoryMutation.mutate({ id: factory.id }); };
  return <article className="industrial-card overflow-hidden xl:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5eee2] px-5 py-4"><div><h2 className="font-semibold text-[#26392a]">后台基础数据管理</h2><p className="mt-1 text-xs text-[#829081]">维护设备详情可选的 BU、工厂与供应商信息；创建工厂时可指定其所属 BU。</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={addBu}>新增 BU</Button><Button size="sm" variant="outline" onClick={addFactory}>新增工厂</Button><Button size="sm" className="bg-[#4a7c59] text-white" onClick={addSupplier}>新增供应商</Button></div></div><div className="grid gap-4 p-5 lg:grid-cols-3"><div><p className="mb-2 text-sm font-medium text-[#415843]">BU 列表</p>{businessUnits.data?.length ? <div className="space-y-2">{businessUnits.data.map(item => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f4f8f1] px-3 py-2 text-sm"><div className="min-w-0"><b>{item.code}</b><span className="ml-2 text-[#687b69]">{item.name}</span></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={() => editBusinessUnit(item)} className="h-7 px-2 text-[#56745b]">编辑</Button><Button size="sm" variant="ghost" onClick={() => removeBusinessUnit(item)} className="h-7 px-2 text-rose-600">删除</Button></div></div>)}</div> : <p className="text-sm text-[#829081]">暂无 BU，请新增。</p>}</div><div><p className="mb-2 text-sm font-medium text-[#415843]">工厂列表</p>{factories.data?.length ? <div className="space-y-2">{factories.data.map(item => { return <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f4f8f1] px-3 py-2 text-sm"><div className="min-w-0"><b>{item.code}</b><span className="ml-2 text-[#687b69]">{item.name}</span></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={() => editFactoryItem(item)} className="h-7 px-2 text-[#56745b]">编辑</Button><Button size="sm" variant="ghost" onClick={() => removeFactory(item)} className="h-7 px-2 text-rose-600">删除</Button></div></div>; })}</div> : <p className="text-sm text-[#829081]">暂无工厂，请新增。</p>}</div><div><p className="mb-2 text-sm font-medium text-[#415843]">供应商列表</p>{suppliers.data?.length ? <div className="space-y-2">{suppliers.data.map(item => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-[#f4f8f1] px-3 py-2 text-sm"><div className="min-w-0"><b>{item.code}</b><span className="ml-2 text-[#687b69]">{item.name}</span>{item.contactName && <span className="ml-2 text-xs text-[#829081]">· {item.contactName}</span>}</div><div className="flex shrink-0 gap-1"><Button size="sm" variant="ghost" onClick={() => editSupplier(item)} className="h-7 px-2 text-[#56745b]">编辑</Button><Button size="sm" variant="ghost" onClick={() => { if (confirm(`确定删除供应商“${item.name}”吗？设备将保留现有供应商名称。`)) deleteSupplier.mutate({ id: item.id }); }} className="h-7 px-2 text-rose-600">删除</Button></div></div>)}</div> : <p className="text-sm text-[#829081]">暂无供应商，请新增。</p>}</div>
<div>
<p className="mb-2 text-sm font-medium text-[#415843]">产品图册（编码 / 名称 / 图片）</p>{products.data?.length ? <div className="grid gap-2 lg:grid-cols-2">{products.data.map((item: ProductOption) => <div key={item.id} className="flex items-center gap-2 rounded-xl bg-[#f4f8f1] px-3 py-2 text-sm">
{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e3ecdf] text-[#829081]"><ImagePlus className="h-4 w-4" /></div>}
<div className="min-w-0"><b>{item.code}</b><span className="ml-2 text-[#687b69]">{item.name}</span></div>
<div className="ml-auto flex shrink-0 gap-1">
<label className="cursor-pointer"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) { void uploadProductImage(item, file); } event.target.value = ""; }} /><Button size="sm" variant="ghost" className="h-7 px-2 text-[#56745b]">上传图片</Button></label>
<Button size="sm" variant="ghost" onClick={() => editProduct(item)} className="h-7 px-2 text-[#56745b]">编辑</Button>
<Button size="sm" variant="ghost" onClick={() => removeProduct(item)} className="h-7 px-2 text-rose-600">删除</Button>
</div>
</div>)}</div> : <p className="text-sm text-[#829081]">暂无产品，请新增。</p>}
<div className="mt-2"><Button size="sm" variant="outline" onClick={addProduct} className="border-[#9bbb9b] text-[#476e50]"><Plus className="mr-1 h-4 w-4" />新增产品</Button></div>
</div></div>{promptDialog.host}</article>;
}

function UsersView() {
  const [, navigate] = useLocation();
  const isAdmin = true; // 与 Home 同源：本地无 OAuth 时为公共管理员工作站
  const utils = trpc.useUtils(); const users = trpc.operations.users.useQuery(); const logs = trpc.operations.list.useQuery(); const changeRole = trpc.operations.updateUserRole.useMutation({ onSuccess: () => { toast.success("角色权限已更新并记入日志"); utils.operations.users.invalidate(); utils.operations.list.invalidate(); }, onError: error => toast.error(error.message || "角色权限更新失败") });
  return <><PageHeader eyebrow="权限与审计" title="用户权限与操作日志" description="系统以管理员与普通用户两类角色控制访问；所有关键业务操作均可在审计日志中追溯。" />{isAdmin && <article className="industrial-card overflow-hidden"><div className="flex flex-col gap-1 border-b border-[#e5eee2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold text-[#26392a]">管理功能入口</h2><p className="text-xs text-[#829081]">保养、维修与备件管理入口，仅管理员账户可见</p></div><div className="grid gap-3 p-5 sm:grid-cols-3"><button type="button" onClick={() => navigate("/maintenance")} className="rounded-xl border border-[#d9e5d6] bg-[#fbfdf9] p-4 text-left transition-colors hover:border-[#4a7c59] hover:bg-[#eff7eb]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4a7c59]/10 text-[#4a7c59]"><Settings2 className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold text-[#26392a]">保养计划与工单</p><p className="mt-1 text-xs text-[#718372]">保养计划制定、工单执行与完成登记</p></button><button type="button" onClick={() => navigate("/repairs")} className="rounded-xl border border-[#d9e5d6] bg-[#fbfdf9] p-4 text-left transition-colors hover:border-[#4a7c59] hover:bg-[#eff7eb]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4a7c59]/10 text-[#4a7c59]"><Wrench className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold text-[#26392a]">故障与维修</p><p className="mt-1 text-xs text-[#718372]">设备故障记录与维修工单处理</p></button><button type="button" onClick={() => navigate("/parts")} className="rounded-xl border border-[#d9e5d6] bg-[#fbfdf9] p-4 text-left transition-colors hover:border-[#4a7c59] hover:bg-[#eff7eb]"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4a7c59]/10 text-[#4a7c59]"><Boxes className="h-4 w-4" /></span><p className="mt-3 text-sm font-semibold text-[#26392a]">备件 / 耗材</p><p className="mt-1 text-xs text-[#718372]">备件耗材库存、入库出库与盘点</p></button></div></article>}<div className="grid gap-5"><article className="industrial-card overflow-hidden"><div className="border-b border-[#e5eee2] px-5 py-4"><h2 className="font-semibold text-[#26392a]">用户角色</h2></div>{users.data?.length ? <div className="divide-y divide-[#edf2eb]">{users.data.map(item => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-medium text-[#314a36]">{item.name ?? "未命名用户"}</p><p className="mt-1 text-xs text-[#829081]">{item.email ?? item.openId}</p></div><Select value={item.role} onValueChange={role => changeRole.mutate({ id: item.id, role: role as "admin" | "user" })}><SelectTrigger className="w-28 border-[#d9e5d6]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">管理员</SelectItem><SelectItem value="user">普通用户</SelectItem></SelectContent></Select></div>)}</div> : <div className="p-5"><EmptyState title="暂无已登录用户" description="用户完成登录后将显示在这里，管理员可以调整其角色。" /></div>}</article><MasterDataPanel /><article className="industrial-card overflow-hidden"><div className="border-b border-[#e5eee2] px-5 py-4"><h2 className="font-semibold text-[#26392a]">操作日志</h2></div>{logs.data?.length ? <div className="max-h-[430px] divide-y divide-[#edf2eb] overflow-y-auto">{logs.data.map(item => <div key={item.id} className="p-4"><div className="flex items-center justify-between gap-3"><p className="font-medium text-[#415843]">{item.module} · {item.action}</p><span className="text-xs text-[#829081]">{dateText(item.createdAt)}</span></div><p className="mt-1 text-xs text-[#829081]">{item.targetType}{item.targetId ? ` #${item.targetId}` : ""}{item.detail ? ` · ${item.detail}` : ""}</p></div>)}</div> : <div className="p-5"><EmptyState title="暂无操作日志" description="对设备、保养、维修、备件和角色的关键操作会自动写入此处。" /></div>}</article></div></>;
}

function InventoryHistory() {
  const parts = trpc.parts.list.useQuery();
  const transactions = trpc.parts.transactions.useQuery();
  const namesById = new Map((parts.data ?? []).map(item => [item.id, item.name]));
  return <section className="mt-5 industrial-card overflow-hidden"><div className="flex items-center justify-between border-b border-[#e5eee2] px-5 py-4"><div><h2 className="font-semibold text-[#26392a]">备件出入库流水</h2><p className="mt-1 text-xs text-[#829081]">最近 100 条已记录操作</p></div><History className="h-5 w-5 text-[#4a7c59]" /></div>{transactions.data?.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-[#f5f9f2] text-left text-xs text-[#6a7d6a]"><tr>{["时间", "备件", "类型", "数量", "操作人"].map(head => <th key={head} className="px-4 py-3 font-medium">{head}</th>)}</tr></thead><tbody className="divide-y divide-[#edf2eb]">{transactions.data.map(item => <tr key={item.id}><td className="px-4 py-3.5 text-[#627562]">{dateText(item.operatedAt)}</td><td className="px-4 py-3.5 font-medium text-[#38543d]">{namesById.get(item.partId) ?? `备件 #${item.partId}`}</td><td className="px-4 py-3.5"><Badge variant="outline" className={item.transactionType === "inbound" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{item.transactionType === "inbound" ? "入库" : "领用"}</Badge></td><td className="px-4 py-3.5 font-semibold text-[#314a36]">{item.quantity}</td><td className="px-4 py-3.5 text-[#627562]">{item.operatorId ? `用户 #${item.operatorId}` : "系统记录"}</td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="暂无出入库流水" description="完成入库或领用后，将在此处保留数量、操作人和操作时间。" /></div>}</section>;
}

function UnauthorizedView() {
  const { language } = useLanguage();
  const copy = languageCopy.accessDenied[language];
  return <div className="industrial-card mx-auto mt-16 max-w-xl p-8 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><ShieldCheck className="h-6 w-6" /></span><h1 className="mt-4 text-xl font-semibold text-[#26392a]">{copy.title}</h1><p className="mt-2 text-sm leading-6 text-[#728373]">{copy.description}</p></div>;
}

export default function Home() {
  const [location] = useLocation(); const isAdmin = true;
  const content = location === "/dashboard" ? <DashboardView /> : location === "/maintenance" ? <MaintenanceView isAdmin={isAdmin} /> : location === "/repairs" ? <RepairsView /> : location === "/parts" ? <><PartsView isAdmin={isAdmin} /><InventoryHistory /></> : location === "/users" ? (isAdmin ? <UsersView /> : <UnauthorizedView />) : <EquipmentView isAdmin={isAdmin} />;
  return <div className="min-h-full px-1 py-2 lg:px-3">{content}</div>;
}
