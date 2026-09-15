import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useIdentity } from "@/contexts/IdentityContext";
import { useApplyT } from "./useApplyT";

function timeText(value: string | Date | null): string {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "--";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NotificationsPage() {
  const t = useApplyT();
  const [, navigate] = useLocation();
  const { current } = useIdentity();
  const list = trpc.applications.notify.myNotifications.useQuery();
  const markRead = trpc.applications.notify.markRead.useMutation({
    onSuccess: () => {
      void list.refetch();
      window.dispatchEvent(new CustomEvent("pems:notify-refresh"));
    },
  });
  const markAllRead = trpc.applications.notify.markAllRead.useMutation({
    onSuccess: () => {
      toast.success(t("已全部标记为已读", "All marked as read"));
      void list.refetch();
      window.dispatchEvent(new CustomEvent("pems:notify-refresh"));
    },
  });

  const unread = (list.data ?? []).filter(n => !n.isRead);

  if (!current) {
    return (
      <div className="p-6">
        <div className="industrial-card flex items-center gap-3 p-6 text-sm text-slate-500">
          <BellOff className="h-5 w-5 text-slate-400" />
          {t("请先在左下角选择操作身份，再查看站内信通知。", "Pick an identity at the sidebar footer first.")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("站内信通知", "Notifications")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("当前身份", "Current identity")}：{current.name}
            {unread.length > 0 && <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-600">{unread.length} {t("条未读", "unread")}</span>}
          </p>
        </div>
        <button
          type="button"
          disabled={unread.length === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9e5d6] bg-white px-3 py-1.5 text-xs font-medium text-[#4a7c59] transition-colors hover:bg-[#eff7eb] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          {t("全部标记已读", "Mark all as read")}
        </button>
      </div>

      <div className="industrial-card overflow-hidden">
        {(list.data ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Bell className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">{t("暂无通知", "No notifications")}</p>
            <p className="text-xs text-slate-400">{t("审批流转、催办与验收结果会自动推送到这里。", "Approval flows, urges and acceptance results will appear here.")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#edf2eb]">
            {(list.data ?? []).map(n => (
              <button
                key={n.id}
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[#f6faf3]"
                onClick={() => {
                  if (!n.isRead) markRead.mutate({ id: n.id });
                  if (n.link) navigate(n.link);
                }}
              >
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${n.isRead ? "bg-slate-100 text-slate-400" : "bg-[#4a7c59]/10 text-[#4a7c59]"}`}>
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm ${n.isRead ? "text-slate-500" : "font-semibold text-[#26392a]"}`}>{n.title}</span>
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                  </span>
                  {n.content && <span className="mt-1 block text-xs leading-relaxed text-slate-500">{n.content}</span>}
                  <span className="mt-1 block text-xs text-slate-400">{timeText(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
