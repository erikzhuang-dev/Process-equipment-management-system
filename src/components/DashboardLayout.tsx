import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIdentity } from "@/contexts/IdentityContext";
import { IdentitySwitcher } from "@/components/ApplySidebarExtras";
import { useIsMobile } from "@/hooks/useMobile";
import { getSidebarPresentation, SIDEBAR_DEFAULT_OPEN } from "@/lib/sidebarPresentation";
import { ClipboardList, FileSignature, Gauge, Languages, ListChecks, PanelLeft, Settings2, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: ClipboardList, label: "设备台账", labelEn: "Equipment Register", path: "/equipment", match: (loc: string) => loc === "/equipment" },
  { icon: FileSignature, label: "申请中心", labelEn: "Application Center", path: "/apply/mine", match: (loc: string) => loc.startsWith("/apply/mine") || loc === "/apply/change/new" || loc === "/apply/purchase/new" },
  { icon: ListChecks, label: "审批中心", labelEn: "Approval Center", path: "/approvals", match: (loc: string) => loc === "/approvals" },
  { icon: ShieldCheck, label: "用户权限与日志", labelEn: "Users & Audit Log", path: "/users", match: (loc: string) => loc === "/users" },
  { icon: Gauge, label: "运营仪表盘", labelEn: "Operations Dashboard", path: "/dashboard", match: (loc: string) => loc === "/dashboard" },
  { icon: Settings2, label: "审批配置", labelEn: "Approval Settings", path: "/apply/settings", match: (loc: string) => loc === "/apply/settings", adminOnly: true },
];
const SIDEBAR_WIDTH_KEY = "equipment-sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); }, [sidebarWidth]);
  return <div data-sidebar-default={SIDEBAR_DEFAULT_OPEN ? "expanded" : "collapsed"}><SidebarProvider defaultOpen={SIDEBAR_DEFAULT_OPEN} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider></div>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { language, toggleLanguage } = useLanguage();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { isCollapsed } = getSidebarPresentation(state);
  const { current } = useIdentity();
  const visibleMenuItems = menuItems.filter(item => !("adminOnly" in item && item.adminOnly) || current?.roleKey === "admin");
  const active = menuItems.find(item => item.match(location));
  const labelOf = (item: typeof menuItems[number]) => language === "en" ? item.labelEn : item.label;
  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);
  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const up = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);
  return <><div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r-0 bg-[#f6faf3]" disableTransition={isResizing}><SidebarHeader className="h-[96px] justify-center px-3"><div className="flex items-center gap-3"><button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#59725b] transition-colors hover:bg-[#e7f0e3]" aria-label={language === "zh" ? "收起或展开导航" : "Toggle navigation"}><PanelLeft className="h-4 w-4" /></button>{!isCollapsed && <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#dca448] shadow-[0_0_0_3px_rgba(220,164,72,.17)]" /><p className="text-[10px] font-bold tracking-[0.18em] text-[#4d8154]">MACHINE CONTROL</p></div><p className="mt-1 truncate text-sm font-semibold text-[#293b2d]">{language === "zh" ? "设备管理" : "Equipment"}</p><p className="mt-0.5 text-[10px] tracking-[0.1em] text-[#8aa28b]">OPS · TRACE · PREVENT</p></div>}</div></SidebarHeader><SidebarContent className="px-3"><p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.16em] text-[#94a394] group-data-[collapsible=icon]:hidden">{language === "zh" ? "系统导航" : "NAVIGATION"}</p><SidebarMenu className="gap-1">{visibleMenuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={item.match(location)} onClick={() => setLocation(item.path)} tooltip={labelOf(item)} className="h-11 rounded-xl text-[#607560] data-[active=true]:bg-[#dfeeda] data-[active=true]:font-semibold data-[active=true]:text-[#315b3b] hover:bg-[#edf5e9]"><item.icon className="h-4 w-4" /><span>{labelOf(item)}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><Button variant="outline" size="sm" onClick={toggleLanguage} className="mb-2 w-full border-[#b8d0b6] text-[#426d4a] group-data-[collapsible=icon]:px-0"><Languages className="h-4 w-4" /><span className="ml-2 group-data-[collapsible=icon]:hidden">{language === "zh" ? "English" : "中文"}</span></Button><div className="rounded-2xl bg-[#edf5e9] p-2 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"><IdentitySwitcher /></div></SidebarFooter></Sidebar><div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#84aa84]/40 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} /></div><SidebarInset className="bg-[#e7f0e0]"><div className="control-surface min-h-screen">{isMobile && <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[#d9e5d6] bg-[#f9fcf7]/90 px-3 backdrop-blur"><SidebarTrigger className="h-9 w-9 rounded-xl bg-white" /><span className="text-sm font-semibold text-[#314a36]">{active ? labelOf(active) : (language === "zh" ? "运营仪表盘" : "Operations Dashboard")}</span></header>}<main className="mx-auto w-full max-w-[1540px] p-4 lg:p-7">{children}</main></div></SidebarInset></>;
}
