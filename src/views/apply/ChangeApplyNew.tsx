"use client";

/** P1 设备修改申请发起页：三步向导（选设备 → 填申请 → 确认提交）。 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Camera, FileText, Loader2, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useIdentity } from "@/contexts/IdentityContext";
import { uploadImageFile } from "@/lib/uploadImage";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { buildChangeChain, CHANGE_TYPE_META, CHANGE_TYPES, DEFAULT_THRESHOLDS, THRESHOLD_META, APPROVAL_NODES, type ChangeType, type Urgency } from "@shared/apply";
import { NodeChainProgress, EQUIPMENT_STATUS_ZH, formatFee } from "./applyUi";

const STEP_TITLES = ["选择设备", "填写申请", "确认提交"];

export default function ChangeApplyNew() {
  const [, navigate] = useLocation();
  const { current } = useIdentity();
  const trpcUtils = trpc.useUtils();
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const presetEquipmentId = Number(search.get("equipmentId")) || null;

  const [step, setStep] = useState(presetEquipmentId ? 1 : 0);
  const [equipmentId, setEquipmentId] = useState<number | null>(presetEquipmentId);
  const [keyword, setKeyword] = useState("");
  const [values, setValues] = useState({
    changeType: "repair" as ChangeType,
    title: "",
    reason: "",
    planDetail: "",
    estimatedFee: "",
    urgency: "normal" as Urgency,
    targetBuId: "" as string,
    targetLocation: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const equipmentList = trpc.equipment.list.useQuery({ page: 1, pageSize: 200 });
  const businessUnits = trpc.equipment.masterData.useQuery();
  const create = trpc.applications.change.create.useMutation({
    onSuccess: result => {
      trpcUtils.equipment.list.invalidate();
      trpcUtils.equipment.detail.invalidate();
      toast.success("申请已提交", { description: `单号 ${result.applyNo}，已进入「${APPROVAL_NODES[result.chain[0]].nameZh}」` });
      navigate("/apply/mine");
    },
    onError: error => toast.error("提交失败", { description: error.message }),
  });

  const filtered = useMemo(() => {
    const rows = equipmentList.data?.items ?? [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows.slice(0, 30);
    return rows.filter(row => [row.code, row.name, row.location].some(value => String(value ?? "").toLowerCase().includes(kw))).slice(0, 30);
  }, [equipmentList.data, keyword]);

  const selected = useMemo(() => (equipmentList.data?.items ?? []).find(row => row.id === equipmentId) ?? null, [equipmentList.data, equipmentId]);
  const fee = Number(values.estimatedFee) || 0;
  const chain = useMemo(() => buildChangeChain({ changeType: values.changeType, estimatedFee: fee, thresholds: DEFAULT_THRESHOLDS }), [values.changeType, fee]);

  useEffect(() => {
    if (!values.title.trim() && selected) {
      setValues(v => ({ ...v, title: `${selected.name} · ${CHANGE_TYPE_META[v.changeType].nameZh.replace("申请", "")}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.changeType]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) urls.push(await uploadImageFile(file));
      setPhotos(list => [...list, ...urls].slice(0, 6));
    } catch (error) {
      toast.error("照片上传失败", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const validateStep2 = (): string | null => {
    if (values.title.trim().length < 4) return "标题至少 4 个字";
    if (values.reason.trim().length < 10) return "申请原因至少 10 个字";
    if (values.changeType !== "transfer" && values.planDetail.trim().length < 10) return "实施方案至少 10 个字";
    if (values.changeType !== "transfer" && fee <= 0) return "请填写预估费用";
    if (photos.length === 0) return "现场照片至少 1 张";
    if (values.changeType === "transfer" && !values.targetBuId) return "移装申请需选择目标 BU";
    if (values.changeType === "transfer" && !values.targetLocation.trim()) return "移装申请需填写目标位置";
    return null;
  };

  const submit = () => {
    if (!equipmentId) return;
    create.mutate({
      equipmentId,
      changeType: values.changeType,
      title: values.title.trim(),
      reason: values.reason.trim(),
      planDetail: values.planDetail.trim() || `移装申请：移装至 BU #${values.targetBuId} · ${values.targetLocation.trim()}`,
      photos,
      estimatedFee: fee,
      urgency: values.urgency,
      targetBuId: values.targetBuId ? Number(values.targetBuId) : null,
      targetLocation: values.targetLocation.trim() || null,
    });
  };

  const typeInvalid = values.changeType === "transfer" && (!values.targetBuId || !values.targetLocation.trim());
  const nextDisabled = step === 1 && (typeInvalid || validateStep2() !== null);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-[#2c4433]">发起修改申请</h1>
          <p className="text-xs text-[#789079]">设备停机 / 参数变更 / 移装 / 报废等均需走此流程，提交后设备状态即时预锁定</p>
        </div>
      </div>

      {/* 步骤条 */}
      <div className="mb-5 flex items-center gap-2">
        {STEP_TITLES.map((label, index) => (
          <div key={label} className="flex items-center gap-2">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold", index < step && "bg-[#4a7c59] text-white", index === step && "bg-amber-400 text-amber-950", index > step && "bg-[#e5ede2] text-[#8aa28b]")}>{index + 1}</span>
            <span className={cn("text-xs", index === step ? "font-semibold text-[#2c4433]" : "text-[#8aa28b]")}>{label}</span>
            {index < STEP_TITLES.length - 1 && <span className="mx-1 h-px w-10 bg-[#d9e5d6]" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card className="border-[#d9e5d6]">
          <CardContent className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#a3b2a2]" />
              <Input className="pl-8" placeholder="搜索设备编码 / 名称 / 位置" value={keyword} onChange={event => setKeyword(event.target.value)} />
            </div>
            <div className="grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {filtered.map(row => (
                <button key={row.id} type="button" onClick={() => { setEquipmentId(row.id); setStep(1); }}
                  className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors", equipmentId === row.id ? "border-[#4a7c59] bg-[#f0f7ec]" : "border-[#d9e5d6] bg-white hover:border-[#b5c4b2]")}>
                  <p className="font-mono text-xs text-[#789079]">{row.code}</p>
                  <p className="text-sm font-medium text-[#314a36]">{row.name}</p>
                  <p className="text-xs text-[#8aa28b]">{row.location} · {EQUIPMENT_STATUS_ZH[row.status] ?? row.status}</p>
                </button>
              ))}
              {filtered.length === 0 && <p className="col-span-2 py-8 text-center text-sm text-[#a3b2a2]">未找到设备</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {selected && (
            <div className="flex items-center gap-2 rounded-xl border border-[#d9e5d6] bg-[#f9fcf7] px-3 py-2">
              <span className="font-mono text-xs text-[#789079]">{selected.code}</span>
              <span className="text-sm font-medium text-[#314a36]">{selected.name}</span>
              <span className="text-xs text-[#8aa28b]">{selected.location}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setStep(0)}>更换设备</Button>
            </div>
          )}

          {/* 类型五选一 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CHANGE_TYPES.map(type => (
              <button key={type} type="button" onClick={() => setValues(v => ({ ...v, changeType: type }))}
                className={cn("rounded-xl border px-2 py-3 text-center text-sm transition-colors", values.changeType === type ? "border-[#4a7c59] bg-[#f0f7ec] font-semibold text-[#2c4433]" : "border-[#d9e5d6] bg-white text-[#4c6350] hover:border-[#b5c4b2]")}>
                {CHANGE_TYPE_META[type].nameZh}
                {type === "scrap" && <span className="mt-0.5 block text-[10px] text-rose-500">需总经理加签</span>}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label className="text-xs">申请标题 *</Label><Input value={values.title} onChange={event => setValues(v => ({ ...v, title: event.target.value }))} placeholder="如：PEM-VAL-001 主阀内漏维修" /></div>
            <div className="sm:col-span-2"><Label className="text-xs">申请原因 / 故障描述 *（至少 10 字）</Label><Textarea rows={3} value={values.reason} onChange={event => setValues(v => ({ ...v, reason: event.target.value }))} placeholder="描述故障现象、发生时间、影响范围…" /></div>
            <div className="sm:col-span-2"><Label className="text-xs">实施方案 *（至少 10 字；报废/移装可不填）</Label><Textarea rows={3} value={values.planDetail} onChange={event => setValues(v => ({ ...v, planDetail: event.target.value }))} placeholder="检修方案、所需配件、预计工时与停机时间…" /></div>
            <div><Label className="text-xs">预估费用（元）* {values.changeType !== "transfer" && fee > 0 && <span className="text-[#789079]">¥{formatFee(fee)}</span>}</Label><Input type="number" min="0" value={values.estimatedFee} onChange={event => setValues(v => ({ ...v, estimatedFee: event.target.value }))} /></div>
            <div><Label className="text-xs">紧急程度 *</Label>
              <Select value={values.urgency} onValueChange={value => setValues(v => ({ ...v, urgency: value as Urgency }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">常规</SelectItem>
                  <SelectItem value="production">影响产能</SelectItem>
                  <SelectItem value="shutdown">已停线（2 小时内响应）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {values.changeType === "transfer" && (
              <>
                <div><Label className="text-xs">目标 BU *</Label>
                  <Select value={values.targetBuId} onValueChange={value => setValues(v => ({ ...v, targetBuId: value }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="选择目标 BU" /></SelectTrigger>
                    <SelectContent>
                      {(businessUnits.data?.businessUnits ?? []).map(bu => (
                        <SelectItem key={bu.id} value={String(bu.id)}>{bu.code} · {bu.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">目标位置 *</Label><Input value={values.targetLocation} onChange={event => setValues(v => ({ ...v, targetLocation: event.target.value }))} placeholder="如：2# 车间东侧工位" /></div>
              </>
            )}
          </div>

          {/* 照片 */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label className="text-xs">现场照片 *（至少 1 张，最多 6 张）</Label>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={event => handleUpload(event.target.files)} />
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Camera className="mr-1 h-3 w-3" />} 上传照片
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {photos.map(url => (
                <div key={url} className="group relative">
                  <img src={url} alt="现场照片" className="h-20 w-20 rounded-lg border border-[#d9e5d6] object-cover" />
                  <button type="button" className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-600 p-0.5 text-white" onClick={() => setPhotos(list => list.filter(item => item !== url))}><X className="h-3 w-3" /></button>
                </div>
              ))}
              {photos.length === 0 && <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[#c9dbc4] text-[10px] text-[#a3b2a2]">暂无照片</div>}
            </div>
          </div>
        </div>
      )}

      {step === 2 && selected && (
        <div className="space-y-4">
          <Card className="border-[#d9e5d6]"><CardContent className="space-y-2 p-4 text-sm">
            <p className="text-base font-semibold text-[#2c4433]">{values.title}</p>
            <p className="text-[#789079]">{selected.code} · {selected.name} · {selected.location}</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[#4c6350]">
              <span>类型：{CHANGE_TYPE_META[values.changeType].nameZh}</span>
              <span>紧急度：{values.urgency === "shutdown" ? "已停线" : values.urgency === "production" ? "影响产能" : "常规"}</span>
              <span>预估费用：¥{formatFee(fee)}</span>
              <span>照片：{photos.length} 张</span>
              {values.changeType === "transfer" && <span className="col-span-2">移装至：BU #{values.targetBuId} · {values.targetLocation}</span>}
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-[#f3f8f0] px-3 py-2 text-xs text-[#4c6350]">{values.reason}</p>
          </CardContent></Card>
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-[#789079]"><FileText className="h-3.5 w-3.5" /> 提交后审批链（按费用 ¥{formatFee(fee)} 与类型自动生成）</p>
            <NodeChainProgress chain={chain} currentNode={chain[0]} status="approving" />
            <p className="mt-1.5 text-xs text-[#8aa28b]">
              阈值：{THRESHOLD_META.CHG_L1.labelZh} ¥{formatFee(THRESHOLD_META.CHG_L1.default)} · {THRESHOLD_META.CHG_L2.labelZh} ¥{formatFee(THRESHOLD_META.CHG_L2.default)} · {THRESHOLD_META.CHG_GM.labelZh} ¥{formatFee(THRESHOLD_META.CHG_GM.default)}
            </p>
          </div>
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            提交后设备状态将预锁定为「{values.changeType === "repair" || values.changeType === "calib" ? "维修/保养中" : "停机"}」，验收通过后自动恢复；审批期间该设备不能再发起新申请。
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0 || create.isPending} onClick={() => setStep(value => value - 1)}><ArrowLeft className="mr-1 h-4 w-4" /> 上一步</Button>
        {step < 2 ? (
          <Button className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={nextDisabled} onClick={() => {
            if (step === 1) {
              const error = validateStep2();
              if (error) { toast.error(error); return; }
            }
            setStep(value => value + 1);
          }}>下一步 <ArrowRight className="ml-1 h-4 w-4" /></Button>
        ) : (
          <Button className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} 提交申请
          </Button>
        )}
      </div>
      {current && <p className="mt-3 text-right text-[10px] text-[#a3b2a2]">当前身份：{current.name}</p>}
    </div>
  );
}
