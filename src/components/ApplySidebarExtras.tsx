"use client";

/**
 * 侧栏申请域扩展组件：身份切换器。
 * 独立成文件避免 DashboardLayout 膨胀；适配侧栏折叠态。
 */
import { useState } from "react";
import { ChevronsUpDown, UserRoundCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentity } from "@/contexts/IdentityContext";
import { APPLY_ROLE_KEYS, APPLY_ROLE_META, type ApplyRoleKey } from "@shared/apply";

function initials(name: string): string {
  const clean = name.replace(/[^A-Za-z\u4e00-\u9fa5]/g, "");
  return clean.slice(0, 2) || "??";
}

export function IdentitySwitcher() {
  const { language } = useLanguage();
  const { current, users, setCurrent, isLoading } = useIdentity();
  const [open, setOpen] = useState(false);

  const grouped = APPLY_ROLE_KEYS.map(roleKey => ({
    roleKey,
    label: language === "zh" ? APPLY_ROLE_META[roleKey].nameZh : APPLY_ROLE_META[roleKey].nameEn,
    members: users.filter(user => user.roleKey === roleKey),
  })).filter(group => group.members.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-3 rounded-xl p-1 hover:bg-[#dcebd8] group-data-[collapsible=icon]:p-1">
          <Avatar className="h-9 w-9 border border-[#cfe0ca]">
            <AvatarFallback className="bg-[#dcebd8] text-xs font-semibold text-[#456f4e]">{current ? initials(current.name) : "—"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-[#3b573f]">{current?.name || (language === "zh" ? "选择身份" : "Select identity")}</p>
            <p className="mt-0.5 truncate text-xs text-[#789079]">{current ? (language === "zh" ? APPLY_ROLE_META[current.roleKey].nameZh : APPLY_ROLE_META[current.roleKey].nameEn) : ""}</p>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-[#8aa28b] group-data-[collapsible=icon]:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <div className="px-3 py-2.5">
          <p className="text-sm font-semibold text-[#314a36]">{language === "zh" ? "申请域身份" : "Workspace Identity"}</p>
          <p className="mt-0.5 text-xs text-[#789079]">{language === "zh" ? "切换后立即以该角色发起/审批申请" : "Switch to initiate or approve requests"}</p>
        </div>
        <Separator />
        <ScrollArea className="max-h-72">
          <div className="p-2">
            {isLoading && <p className="px-2 py-3 text-xs text-[#8aa28b]">…</p>}
            {grouped.map(group => (
              <div key={group.roleKey} className="mb-1">
                <p className="px-2 pb-1 pt-2 text-[10px] font-semibold tracking-[0.14em] text-[#94a394]">{group.label.toUpperCase()}</p>
                {group.members.map(member => (
                  <button
                    key={member.id}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[#edf5e9] ${current?.id === member.id ? "bg-[#dfeeda] font-semibold text-[#315b3b]" : "text-[#4c6350]"}`}
                    onClick={() => {
                      setCurrent({ id: member.id, name: member.name, roleKey: member.roleKey as ApplyRoleKey });
                      setOpen(false);
                    }}
                  >
                    <UserRoundCheck className={`h-3.5 w-3.5 shrink-0 ${current?.id === member.id ? "text-[#3e6a4b]" : "text-transparent"}`} />
                    <span className="truncate">{member.name}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
