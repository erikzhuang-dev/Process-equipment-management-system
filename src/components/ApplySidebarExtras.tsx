"use client";

/**
 * 侧栏申请域扩展组件：双账户登录切换器。
 * 普通账户默认登录；管理员账户点击后输入密码（服务端 verifyAdmin 校验）进入。
 * 独立成文件避免 DashboardLayout 膨胀；适配侧栏折叠态。
 */
import { useState } from "react";
import { ChevronsUpDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentity } from "@/contexts/IdentityContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { ApplyRoleKey } from "@shared/apply";

function initials(name: string): string {
  const clean = name.replace(/[^A-Za-z\u4e00-\u9fa5]/g, "");
  return clean.slice(0, 2) || "??";
}

export function IdentitySwitcher() {
  const { language } = useLanguage();
  const { current, users, setCurrent, isLoading } = useIdentity();
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [password, setPassword] = useState("");

  const normalAccount = users.find(user => user.roleKey === "user");
  const adminAccount = users.find(user => user.roleKey === "admin");
  const isAdminActive = current?.roleKey === "admin";

  const verifyAdmin = trpc.applications.verifyAdmin.useMutation({
    onSuccess: result => {
      if (result.ok && adminAccount) {
        setCurrent({ id: adminAccount.id, name: adminAccount.name, roleKey: adminAccount.roleKey as ApplyRoleKey });
        setPwdOpen(false);
        setPassword("");
        setOpen(false);
        toast.success(language === "zh" ? "管理员已登录" : "Admin signed in");
      } else {
        toast.error(language === "zh" ? "密码错误" : "Incorrect password");
      }
    },
    onError: () => toast.error(language === "zh" ? "密码校验失败" : "Verification failed"),
  });

  const switchToNormal = () => {
    if (!normalAccount) return;
    if (current?.id === normalAccount.id) {
      setOpen(false);
      return;
    }
    setCurrent({ id: normalAccount.id, name: normalAccount.name, roleKey: normalAccount.roleKey as ApplyRoleKey });
    setOpen(false);
    toast.success(language === "zh" ? "已切换为普通账户" : "Signed in as regular user");
  };

  const openAdminLogin = () => {
    if (!adminAccount) return;
    if (isAdminActive) {
      setOpen(false);
      return;
    }
    setPassword("");
    setPwdOpen(true);
  };

  const logoutAdmin = () => {
    switchToNormal();
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-xl p-1 hover:bg-[#dcebd8] group-data-[collapsible=icon]:p-1">
            <Avatar className="h-9 w-9 border border-[#cfe0ca]">
              <AvatarFallback className={cn("text-xs font-semibold", isAdminActive ? "bg-[#31473a] text-[#e8f3e3]" : "bg-[#dcebd8] text-[#456f4e]")}>{current ? initials(current.name) : "—"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium text-[#3b573f]">{current?.name || (isLoading ? "…" : language === "zh" ? "普通账户" : "Regular user")}</p>
              <p className="mt-0.5 truncate text-xs text-[#789079]">{isAdminActive ? (language === "zh" ? "管理人员 · 可审批" : "Admin · can approve") : language === "zh" ? "普通人员" : "Regular user"}</p>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#8aa28b] group-data-[collapsible=icon]:hidden" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-0">
          <div className="px-3 py-2.5">
            <p className="text-sm font-semibold text-[#314a36]">{language === "zh" ? "账户" : "Account"}</p>
            <p className="mt-0.5 text-xs text-[#789079]">{language === "zh" ? "普通账户默认登录；管理员账户需输入密码" : "Regular user by default; admin requires a password"}</p>
          </div>
          <Separator />
          <div className="p-2">
            <button
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[#edf5e9]",
                !isAdminActive && current ? "bg-[#dfeeda] font-semibold text-[#315b3b]" : "text-[#4c6350]"
              )}
              onClick={switchToNormal}
            >
              <UserRound className={cn("h-4 w-4 shrink-0", !isAdminActive && current ? "text-[#3e6a4b]" : "text-[#8aa28b]")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{normalAccount?.name ?? (language === "zh" ? "普通账户" : "Regular user")}</span>
                <span className="mt-0.5 block text-[11px] font-normal text-[#8aa28b]">{language === "zh" ? "默认登录 · 发起申请" : "Default · submit requests"}</span>
              </span>
              {!isAdminActive && current && <span className="text-[10px] text-[#4d8154]">{language === "zh" ? "当前" : "Active"}</span>}
            </button>
            <button
              className={cn(
                "mt-1 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-[#edf5e9]",
                isAdminActive ? "bg-[#dfeeda] font-semibold text-[#315b3b]" : "text-[#4c6350]"
              )}
              onClick={openAdminLogin}
            >
              <ShieldCheck className={cn("h-4 w-4 shrink-0", isAdminActive ? "text-[#3e6a4b]" : "text-[#8aa28b]")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{adminAccount?.name ?? (language === "zh" ? "管理员" : "Admin")}</span>
                <span className="mt-0.5 block text-[11px] font-normal text-[#8aa28b]">{language === "zh" ? "输入密码登录 · 审批" : "Password sign-in · approve"}</span>
              </span>
              {isAdminActive && <span className="text-[10px] text-[#4d8154]">{language === "zh" ? "当前" : "Active"}</span>}
            </button>
            {isAdminActive && (
              <>
                <Separator className="my-1.5" />
                <button
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-[#8a4b3a] transition-colors hover:bg-[#f7ece7]"
                  onClick={logoutAdmin}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>{language === "zh" ? "退出管理员，返回普通账户" : "Exit admin, back to regular user"}</span>
                </button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#314a36]">
              <ShieldCheck className="h-4 w-4 text-[#4d8154]" />
              {language === "zh" ? "管理员登录" : "Admin Sign-in"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#789079]">{language === "zh" ? "请输入管理员密码以进入审批身份。" : "Enter the admin password to sign in."}</p>
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder={language === "zh" ? "管理员密码" : "Admin password"}
            onKeyDown={event => {
              if (event.key === "Enter" && password && !verifyAdmin.isPending) verifyAdmin.mutate({ password });
            }}
            className="border-[#d9e5d6] bg-[#fbfdf9]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)} className="border-[#d9e5d6] text-[#607560]">
              {language === "zh" ? "取消" : "Cancel"}
            </Button>
            <Button
              disabled={!password || verifyAdmin.isPending}
              onClick={() => verifyAdmin.mutate({ password })}
              className="bg-[#4a7c59] text-white hover:bg-[#3e6a4b]"
            >
              {verifyAdmin.isPending ? "…" : language === "zh" ? "登录" : "Sign in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
