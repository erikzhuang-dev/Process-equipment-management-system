"use client";

/**
 * 申请详情弹窗：单据信息 + 审批链进度 + 审批记录时间线 + 报价（PUR）+ 验收记录，
 * 并按"当前身份 × 单据状态"动态渲染操作区（撤回/重新提交/审批/推进度/提交验收/验收/催办/比价录入）。
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, CheckCircle2, CircleX, Loader2, SendHorizonal, ThumbsUp, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIdentity } from "@/contexts/IdentityContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import {
  APPROVAL_NODES,
  QUOTATION_MIN_COUNT,
  URGENCY_META,
  type ApprovalNodeKey,
} from "@shared/apply";
import { ApplyStatusBadge, ChangeTypeBadge, FeeText, NodeChainProgress, OverdueBadge, PurchaseTypeBadge, UrgencyBadge, formatFee } from "./applyUi";

type ApplyType = "change" | "purchase";

function parsePhotos(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-24 shrink-0 text-[#789079]">{label}</span>
      <span className="min-w-0 flex-1 text-[#314a36]">{children}</span>
    </div>
  );
}

export function ApplyDetailDialog({ applyType, applyId, open, onOpenChange, onChanged }: {
  applyType: ApplyType;
  applyId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const { current } = useIdentity();
  const queryClient = useQueryClient();
  const changeDetail = trpc.applications.change.detail.useQuery({ id: applyId ?? 0 }, { enabled: open && applyType === "change" && applyId != null });
  const purchaseDetail = trpc.applications.purchase.detail.useQuery({ id: applyId ?? 0 }, { enabled: open && applyType === "purchase" && applyId != null });
  const changeData = changeDetail.data;
  const purchaseData = purchaseDetail.data;
  const apply = applyType === "change" ? changeData?.apply ?? null : purchaseData?.apply ?? null;
  const chain = useMemo(() => changeData?.chain ?? purchaseData?.chain ?? [], [changeData, purchaseData]);
  const records = changeData?.records ?? purchaseData?.records ?? [];

  const refresh = () => {
    queryClient.invalidateQueries();
    onChanged?.();
  };

  /* ---------- mutations ---------- */
  const act = trpc.applications.approval.act.useMutation({
    onSuccess: () => { toast.success("操作成功", { description: "审批动作已记录" }); refresh(); },
    onError: error => toast.error("操作失败", { description: error.message }),
  });
  const changeWithdraw = trpc.applications.change.withdraw.useMutation({
    onSuccess: () => { toast.success("已撤回", { description: "设备状态已恢复" }); refresh(); },
    onError: error => toast.error("撤回失败", { description: error.message }),
  });
  const purchaseWithdraw = trpc.applications.purchase.withdraw.useMutation({
    onSuccess: () => { toast.success("已撤回", { description: "单据已作废" }); refresh(); },
    onError: error => toast.error("撤回失败", { description: error.message }),
  });
  const withdraw = applyType === "change" ? changeWithdraw : purchaseWithdraw;
  const urge = trpc.applications.approval.urge.useMutation({
    onSuccess: () => toast.success("已催办", { description: "已通知当前节点审批人" }),
    onError: error => toast.error("催办失败", { description: error.message }),
  });
  const pushProgress = trpc.applications.execution.pushProgress.useMutation({
    onSuccess: () => { toast.success("进度已记录"); setProgressNote(""); refresh(); },
    onError: error => toast.error("记录失败", { description: error.message }),
  });
  const submitForAcceptance = trpc.applications.execution.submitForAcceptance.useMutation({
    onSuccess: () => { toast.success("已提交验收", { description: "等待验收人确认" }); refresh(); },
    onError: error => toast.error("提交失败", { description: error.message }),
  });
  const submitAcceptance = trpc.applications.acceptance.submit.useMutation({
    onSuccess: result => {
      toast.success(result.closed ? "验收完成，单据已关闭" : "验收意见已记录", { description: result.message ?? undefined });
      refresh();
    },
    onError: error => toast.error("验收失败", { description: error.message }),
  });
  const addQuotation = trpc.applications.purchase.addQuotation.useMutation({
    onSuccess: () => { toast.success("报价已添加"); setQuoteFormOpen(false); refresh(); },
    onError: error => toast.error("添加失败", { description: error.message }),
  });
  const selectQuotation = trpc.applications.purchase.selectQuotation.useMutation({
    onSuccess: () => { toast.success("已设置中标供应商"); refresh(); },
    onError: error => toast.error("操作失败", { description: error.message }),
  });

  /* ---------- 本地表单状态 ---------- */
  const [comment, setComment] = useState("");
  const [rejectToNode, setRejectToNode] = useState<ApprovalNodeKey | "applicant">("applicant");
  const [progressNote, setProgressNote] = useState("");
  const [acceptRemark, setAcceptRemark] = useState("");
  const [coSignerName, setCoSignerName] = useState("");
  const [calibDueDate, setCalibDueDate] = useState("");
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ supplierName: "", amount: "", leadTimeDays: "", paymentTerm: "", attachmentNote: "" });

  if (!apply) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg"><p className="py-10 text-center text-sm text-[#8aa28b]">加载中…</p></DialogContent>
      </Dialog>
    );
  }

  const identityId = current?.id ?? -1;
  const roleKey = current?.roleKey ?? "applicant";
  const isSubmitter = apply.submitterId === identityId;
  const currentNode = apply.currentNode as ApprovalNodeKey | null;
  const isCurrentNodeActor = Boolean(currentNode && APPROVAL_NODES[currentNode]?.roleKey === roleKey);
  const canExecute = ["equipment_admin", "engineer", "manager", "system_admin"].includes(roleKey);
  const canAccept = ["equipment_admin", "engineer", "manager", "system_admin"].includes(roleKey);
  const canManageQuotes = ["purchaser", "equipment_admin", "engineer", "system_admin"].includes(roleKey);
  const nodeEnteredAt = new Date(apply.nodeEnteredAt);
  const overdueHours = Math.max(0, Math.floor((Date.now() - nodeEnteredAt.getTime()) / 3600_000));

  const approve = () => {
    if (!currentNode) return;
    act.mutate({ applyType, id: apply.id, action: "approve", comment: comment.trim() || null });
    setComment("");
  };
  const reject = () => {
    if (comment.trim().length < 4) {
      toast.error("请填写驳回意见（至少 4 个字）");
      return;
    }
    act.mutate({ applyType, id: apply.id, action: "reject", comment: comment.trim(), rejectToNode: rejectToNode === "applicant" ? null : rejectToNode });
    setComment("");
  };

  const title = applyType === "change" ? "修改申请详情" : "购买申请详情";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            {title}
            <span className="font-mono text-xs font-normal text-[#789079]">{apply.applyNo}</span>
            <ApplyStatusBadge status={apply.status} />
            {apply.status === "approving" && <OverdueBadge overdue={overdueHours >= 12 && apply.urgency === "shutdown"} />}
          </DialogTitle>
          <DialogDescription className="text-xs">{apply.title}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[62vh] pr-2">
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="rounded-xl border border-[#d9e5d6] bg-[#f9fcf7] p-3">
              <div className="grid gap-2">
                <InfoRow label="类型">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {applyType === "change" ? <ChangeTypeBadge type={changeData?.apply.changeType ?? "repair"} /> : <PurchaseTypeBadge type={purchaseData?.apply.buyType ?? "new_purchase"} />}
                    <UrgencyBadge urgency={apply.urgency} />
                    <span className="text-xs text-[#789079]">SLA {URGENCY_META[apply.urgency].nameZh}</span>
                  </span>
                </InfoRow>
                {applyType === "change" && changeData?.equipment && (
                  <InfoRow label="设备">
                    {changeData.equipment.code} · {changeData.equipment.name}（{changeData.equipment.location}）
                  </InfoRow>
                )}
                {applyType === "purchase" && purchaseData && (
                  <InfoRow label="采购内容">{purchaseData.apply.equipmentName}{purchaseData.apply.quantity > 1 ? ` × ${purchaseData.apply.quantity}` : ""}{purchaseData.apply.modelSpec ? ` · ${purchaseData.apply.modelSpec}` : ""}</InfoRow>
                )}
                <InfoRow label={applyType === "change" ? "预估费用" : "预算"}>
                  <FeeText value={applyType === "change" ? changeData?.apply.estimatedFee ?? 0 : purchaseData?.apply.budget ?? 0} />
                  {applyType === "purchase" && purchaseData?.apply.selectedAmount != null && <span className="ml-2 text-xs text-[#789079]">中标价 ¥{formatFee(purchaseData.apply.selectedAmount)}</span>}
                </InfoRow>
                {applyType === "change" && changeData && (changeData.apply.changeType === "transfer" || changeData.apply.changeType === "retrofit") && (
                  <InfoRow label="目标位置">
                    {changeData.apply.targetBuId ? `BU #${changeData.apply.targetBuId} ` : ""}{changeData.apply.targetLocation ?? "—"}
                  </InfoRow>
                )}
                <InfoRow label="申请说明"><span className="whitespace-pre-wrap">{apply.reason}</span></InfoRow>
                {applyType === "change" && <InfoRow label="实施方案"><span className="whitespace-pre-wrap">{changeData?.apply.planDetail ?? ""}</span></InfoRow>}
                <InfoRow label="提交人">{apply.submitterName ?? `#${apply.submitterId}`} · {new Date(apply.createdAt).toLocaleString()}</InfoRow>
              </div>
              {applyType === "change" && parsePhotos(changeData?.apply.photos ?? null).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsePhotos(changeData?.apply.photos ?? null).map(url => (
                    <img key={url} src={url} alt="申请照片" className="h-16 w-16 rounded-lg border border-[#d9e5d6] object-cover" />
                  ))}
                </div>
              )}
            </div>

            {/* 审批链进度 */}
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-[#789079]">审批链</p>
              <NodeChainProgress chain={chain} currentNode={apply.currentNode} status={apply.status} />
              {apply.status === "approving" && currentNode && (
                <p className="mt-1.5 text-xs text-[#789079]">
                  当前节点：<span className="font-medium text-amber-700">{APPROVAL_NODES[currentNode].nameZh}</span> · 已停留 {overdueHours} 小时
                </p>
              )}
            </div>

            {/* PUR 报价区 */}
            {applyType === "purchase" && purchaseDetail.data && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold tracking-wide text-[#789079]">
                    比价记录（需 ≥ {QUOTATION_MIN_COUNT} 家，当前 {purchaseDetail.data.quotations.length} 家）
                  </p>
                  {canManageQuotes && (apply.status === "executing" || (apply.status === "approving" && currentNode === "purchaser")) && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setQuoteFormOpen(value => !value)}>+ 添加报价</Button>
                  )}
                </div>
                {quoteFormOpen && (
                  <div className="mb-2 grid grid-cols-2 gap-2 rounded-xl border border-[#d9e5d6] bg-[#f9fcf7] p-3">
                    <div className="col-span-2"><Label className="text-xs">供应商名称 *</Label><Input className="h-8" value={quoteForm.supplierName} onChange={event => setQuoteForm(form => ({ ...form, supplierName: event.target.value }))} /></div>
                    <div><Label className="text-xs">报价金额 *</Label><Input className="h-8" type="number" value={quoteForm.amount} onChange={event => setQuoteForm(form => ({ ...form, amount: event.target.value }))} /></div>
                    <div><Label className="text-xs">货期（天）</Label><Input className="h-8" type="number" value={quoteForm.leadTimeDays} onChange={event => setQuoteForm(form => ({ ...form, leadTimeDays: event.target.value }))} /></div>
                    <div><Label className="text-xs">付款条件</Label><Input className="h-8" value={quoteForm.paymentTerm} onChange={event => setQuoteForm(form => ({ ...form, paymentTerm: event.target.value }))} /></div>
                    <div><Label className="text-xs">附件说明</Label><Input className="h-8" value={quoteForm.attachmentNote} onChange={event => setQuoteForm(form => ({ ...form, attachmentNote: event.target.value }))} /></div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setQuoteFormOpen(false)}>取消</Button>
                      <Button size="sm" className="h-7 bg-[#4a7c59] text-xs text-white hover:bg-[#3e6a4b]" disabled={!quoteForm.supplierName.trim() || !quoteForm.amount || addQuotation.isPending}
                        onClick={() => addQuotation.mutate({ applyId: apply.id, supplierName: quoteForm.supplierName.trim(), amount: Number(quoteForm.amount), leadTimeDays: quoteForm.leadTimeDays ? Number(quoteForm.leadTimeDays) : null, paymentTerm: quoteForm.paymentTerm.trim() || null, attachmentNote: quoteForm.attachmentNote.trim() || null })}>
                        {addQuotation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "保存报价"}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  {purchaseDetail.data.quotations.length === 0 && <p className="rounded-lg border border-dashed border-[#d9e5d6] px-3 py-3 text-center text-xs text-[#a3b2a2]">暂无报价记录</p>}
                  {purchaseDetail.data.quotations.map(quotation => (
                    <div key={quotation.id} className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", quotation.isSelected ? "border-emerald-300 bg-emerald-50" : "border-[#d9e5d6] bg-white")}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[#314a36]">
                          {quotation.supplierName}
                          {quotation.isSelected && <span className="ml-2 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">中标</span>}
                        </p>
                        <p className="text-xs text-[#789079]">货期 {quotation.leadTimeDays ?? "—"} 天{quotation.paymentTerm ? ` · ${quotation.paymentTerm}` : ""}</p>
                      </div>
                      <FeeText value={quotation.amount} />
                      {canManageQuotes && !quotation.isSelected && apply.status !== "closed" && (
                        <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs text-[#4d8154]" onClick={() => selectQuotation.mutate({ applyId: apply.id, quotationId: quotation.id })}>设为中标</Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 审批记录时间线 */}
            <div>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-[#789079]">审批留痕</p>
              <div className="space-y-2 border-l-2 border-[#d9e5d6] pl-4">
                {records.length === 0 && <p className="text-xs text-[#a3b2a2]">暂无记录</p>}
                {records.map(record => (
                  <div key={record.id} className="relative">
                    <span className={cn("absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white",
                      record.action === "approve" && "bg-emerald-500",
                      record.action === "reject" && "bg-rose-500",
                      record.action === "urge" && "bg-amber-500",
                      record.action === "execute" && "bg-indigo-500",
                      record.action === "accept" && "bg-violet-500",
                      ["submit", "resubmit", "withdraw", "close"].includes(record.action) && "bg-slate-400")}/>
                    <p className="text-sm text-[#314a36]">
                      <span className="font-medium">{record.nodeName}</span>
                      <span className="ml-1.5 text-xs text-[#789079]">
                        {record.action === "approve" && "同意"}
                        {record.action === "reject" && "驳回"}
                        {record.action === "submit" && "提交"}
                        {record.action === "resubmit" && "重新提交"}
                        {record.action === "withdraw" && "撤回"}
                        {record.action === "urge" && "催办"}
                        {record.action === "execute" && "执行进度"}
                        {record.action === "accept" && "验收"}
                        {record.action === "close" && "关闭"}
                        {" · "}{record.actorName ?? `#${record.actorId}`}
                        {" · "}{new Date(record.actedAt).toLocaleString()}
                      </span>
                    </p>
                    {record.comment && <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-[#f3f8f0] px-2.5 py-1.5 text-xs text-[#4c6350]">{record.comment}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* 验收记录 */}
            {(changeData?.acceptances ?? purchaseData?.acceptances ?? []).length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-[#789079]">验收记录</p>
                <div className="space-y-1.5">
                  {(changeData?.acceptances ?? purchaseData?.acceptances ?? []).map((record: { id: number; result: string; signerName: string | null; coSignerName: string | null; remark: string | null; acceptedAt: string | Date }) => (
                    <div key={record.id} className="rounded-lg border border-[#d9e5d6] px-3 py-2 text-sm">
                      <p className="font-medium text-[#314a36]">
                        {record.result === "pass" ? <ThumbsUp className="mr-1 inline h-3.5 w-3.5 text-emerald-600" /> : <CircleX className="mr-1 inline h-3.5 w-3.5 text-rose-600" />}
                        {record.result === "pass" ? "验收通过" : "验收不通过"} · {record.signerName ?? "验收人"}{record.coSignerName ? ` / ${record.coSignerName}` : ""}
                      </p>
                      {record.remark && <p className="mt-0.5 text-xs text-[#789079]">{record.remark}</p>}
                      <p className="mt-0.5 text-[10px] text-[#a3b2a2]">{new Date(record.acceptedAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <Separator />

        {/* 操作区 */}
        <div className="space-y-3">
          {/* 审批操作 */}
          {apply.status === "approving" && isCurrentNodeActor && currentNode && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-xs font-semibold text-amber-800">
                待我审批：{APPROVAL_NODES[currentNode].nameZh}
                {currentNode === "purchaser" && purchaseDetail.data && purchaseDetail.data.quotations.length < QUOTATION_MIN_COUNT && (
                  <span className="ml-2 inline-flex items-center text-rose-600"><AlertTriangle className="mr-1 h-3 w-3" />比价不足 {QUOTATION_MIN_COUNT} 家，通过将被拦截</span>
                )}
              </p>
              <Textarea rows={2} placeholder="审批意见（驳回时必填）" value={comment} onChange={event => setComment(event.target.value)} className="min-h-0 bg-white" />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={act.isPending} onClick={approve}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> 同意并流转
                </Button>
                <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" disabled={act.isPending} onClick={reject}>
                  <CircleX className="mr-1 h-4 w-4" /> 驳回
                </Button>
                <Select value={rejectToNode} onValueChange={value => setRejectToNode(value as ApprovalNodeKey | "applicant")}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="applicant">驳回至：申请人</SelectItem>
                    {chain.slice(0, Math.max(0, chain.indexOf(currentNode))).map(node => (
                      <SelectItem key={node} value={node}>驳回至：{APPROVAL_NODES[node].nameZh}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 执行操作 */}
          {apply.status === "executing" && canExecute && (
            <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <p className="text-xs font-semibold text-indigo-800">执行跟踪</p>
              <Textarea rows={2} placeholder="进度记录（如：已联系供应商 / 校准进行中 / 拆解完成 60%）" value={progressNote} onChange={event => setProgressNote(event.target.value)} className="min-h-0 bg-white" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-100" disabled={!progressNote.trim() || pushProgress.isPending} onClick={() => pushProgress.mutate({ applyType, id: apply.id, note: progressNote.trim() })}>
                  <SendHorizonal className="mr-1 h-4 w-4" /> 记录进度
                </Button>
                {applyType === "purchase" && !(purchaseData?.apply.selectedQuotationId ?? null) && (
                  <p className="inline-flex items-center text-xs text-amber-700"><AlertTriangle className="mr-1 h-3 w-3" />提交验收前需先选定中标供应商</p>
                )}
                <Button size="sm" className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={submitForAcceptance.isPending || (applyType === "purchase" && !(purchaseData?.apply.selectedQuotationId ?? null))} onClick={() => submitForAcceptance.mutate({ applyType, id: apply.id })}>
                  <Camera className="mr-1 h-4 w-4" /> 完成执行，提交验收
                </Button>
              </div>
            </div>
          )}

          {/* 验收操作 */}
          {apply.status === "pending_acceptance" && canAccept && (
            <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
              <p className="text-xs font-semibold text-violet-800">验收确认（双签制：验收人 + 共同验收人）</p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">共同验收人</Label><Input className="h-8" placeholder="姓名" value={coSignerName} onChange={event => setCoSignerName(event.target.value)} /></div>
                {applyType === "change" && changeData?.apply.changeType === "calib" && (
                  <div><Label className="text-xs">下次校准日期 *</Label><Input className="h-8" type="date" value={calibDueDate} onChange={event => setCalibDueDate(event.target.value)} /></div>
                )}
                <div className="col-span-2"><Label className="text-xs">验收备注</Label><Textarea rows={2} className="min-h-0 bg-white" value={acceptRemark} onChange={event => setAcceptRemark(event.target.value)} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={submitAcceptance.isPending || (applyType === "change" && changeData?.apply.changeType === "calib" && !calibDueDate)}
                  onClick={() => submitAcceptance.mutate({ applyType, id: apply.id, result: "pass", remark: acceptRemark.trim() || null, coSignerName: coSignerName.trim() || null, calibDueDate: calibDueDate || null })}>
                  <ThumbsUp className="mr-1 h-4 w-4" /> 验收通过并关闭
                </Button>
                <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" disabled={submitAcceptance.isPending || !acceptRemark.trim()}
                  onClick={() => submitAcceptance.mutate({ applyType, id: apply.id, result: "fail", remark: acceptRemark.trim(), coSignerName: coSignerName.trim() || null })}>
                  验收不通过
                </Button>
              </div>
            </div>
          )}

          {/* 提交人操作 */}
          <div className="flex flex-wrap items-center gap-2">
            {isSubmitter && (apply.status === "approving" || apply.status === "rejected") && apply.status === "approving" && (
              <Button size="sm" variant="outline" disabled={withdraw.isPending} onClick={() => withdraw.mutate({ id: apply.id })}>
                <Undo2 className="mr-1 h-4 w-4" /> 撤回申请
              </Button>
            )}
            {(isSubmitter || roleKey === "equipment_admin" || roleKey === "system_admin") && apply.status === "approving" && !isCurrentNodeActor && (
              <Button size="sm" variant="ghost" className="text-amber-700 hover:bg-amber-50" disabled={urge.isPending} onClick={() => urge.mutate({ applyType, id: apply.id })}>
                催办当前节点
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 重新提交（驳回后）内联表单，供 P3 我的申请页使用 */
export function ResubmitForm({ applyType, applyId, onDone }: { applyType: ApplyType; applyId: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [estimatedFee, setEstimatedFee] = useState("");
  const changeResubmit = trpc.applications.change.resubmit.useMutation({
    onSuccess: () => { toast.success("已重新提交", { description: "审批链已按新金额重算" }); queryClient.invalidateQueries(); onDone(); },
    onError: error => toast.error("提交失败", { description: error.message }),
  });
  const purchaseResubmit = trpc.applications.purchase.resubmit.useMutation({
    onSuccess: () => { toast.success("已重新提交", { description: "审批链已按新预算重算" }); queryClient.invalidateQueries(); onDone(); },
    onError: error => toast.error("提交失败", { description: error.message }),
  });

  const submit = () => {
    if (title.trim().length < 4) { toast.error("请填写调整后标题"); return; }
    if (applyType === "change") {
      changeResubmit.mutate({ id: applyId, title: title.trim(), reason: reason.trim() || undefined, estimatedFee: estimatedFee ? Number(estimatedFee) : undefined });
    } else {
      purchaseResubmit.mutate({ id: applyId, title: title.trim(), reason: reason.trim() || undefined, budget: estimatedFee ? Number(estimatedFee) : undefined });
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3">
      <p className="text-xs font-semibold text-rose-700">单据已被驳回，修改后重新提交（审批链将按新金额重算）</p>
      <Input className="h-8" placeholder="调整后的标题 *" value={title} onChange={event => setTitle(event.target.value)} />
      <Textarea rows={2} className="min-h-0 bg-white" placeholder="补充说明 / 修改原因" value={reason} onChange={event => setReason(event.target.value)} />
      <div className="flex items-center gap-2">
        <Input className="h-8 w-40" type="number" placeholder={applyType === "change" ? "调整预估费用" : "调整预算"} value={estimatedFee} onChange={event => setEstimatedFee(event.target.value)} />
        <Button size="sm" className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]" disabled={changeResubmit.isPending || purchaseResubmit.isPending} onClick={submit}>重新提交</Button>
      </div>
    </div>
  );
}
