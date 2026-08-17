import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Boxes, ClipboardList, Gauge, HardHat, History, LogOut, PanelLeft, Settings2, ShieldCheck, Wrench } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: Gauge, label: "运营仪表盘", path: "/" },
  { icon: ClipboardList, label: "设备台账", path: "/equipment" },
  { icon: Settings2, label: "保养计划与工单", path: "/maintenance" },
  { icon: Wrench, label: "故障与维修", path: "/repairs" },
  { icon: Boxes, label: "备件 / 耗材", path: "/parts" },
  { icon: ShieldCheck, label: "用户权限与日志", path: "/users", adminOnly: true },
];
const SIDEBAR_WIDTH_KEY = "equipment-sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 220;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)); }, [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return <div className="equipment-login min-h-screen"><div className="industrial-card mx-auto flex max-w-md flex-col items-center gap-6 p-9 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcebd8] text-[#3e704b]"><HardHat className="h-7 w-7" /></span><div><p className="mb-2 text-xs font-semibold tracking-[0.18em] text-[#4a7c59]">PROCESS EQUIPMENT</p><h1 className="text-2xl font-semibold text-[#233428]">生产工艺设备管理信息系统</h1><p className="mt-3 text-sm leading-6 text-[#708171]">登录后可使用设备全生命周期管理、工单流转、库存追溯和数据仪表盘。</p></div><Button onClick={() => startLogin()} size="lg" className="w-full bg-[#4a7c59] text-white hover:bg-[#3e6a4b]">登录系统</Button></div></div>;
  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth(); const [location, setLocation] = useLocation(); const { state, toggleSidebar } = useSidebar(); const [isResizing, setIsResizing] = useState(false); const sidebarRef = useRef<HTMLDivElement>(null); const isMobile = useIsMobile(); const isCollapsed = state === "collapsed"; const visibleMenuItems = menuItems.filter(item => !item.adminOnly || user?.role === "admin"); const active = visibleMenuItems.find(item => item.path === location);
  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);
  useEffect(() => { const move = (event: MouseEvent) => { if (!isResizing) return; const left = sidebarRef.current?.getBoundingClientRect().left ?? 0; const width = event.clientX - left; if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width); }; const up = () => setIsResizing(false); if (isResizing) { document.addEventListener("mousemove", move); document.addEventListener("mouseup", up); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; } return () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); document.body.style.cursor = ""; document.body.style.userSelect = ""; }; }, [isResizing, setSidebarWidth]);
  return <><div className="relative" ref={sidebarRef}><Sidebar collapsible="icon" className="border-r-0 bg-[#f6faf3]" disableTransition={isResizing}><SidebarHeader className="h-[96px] justify-center px-3"><div className="flex items-center gap-3"><button onClick={toggleSidebar} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#59725b] transition-colors hover:bg-[#e7f0e3]" aria-label="收起或展开导航"><PanelLeft className="h-4 w-4" /></button>{!isCollapsed && <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-[#dca448] shadow-[0_0_0_3px_rgba(220,164,72,.17)]" /><p className="text-[10px] font-bold tracking-[0.18em] text-[#4d8154]">MACHINE CONTROL</p></div><p className="mt-1 truncate text-sm font-semibold text-[#293b2d]">工艺设备管理</p><p className="mt-0.5 text-[10px] tracking-[0.1em] text-[#8aa28b]">OPS · TRACE · PREVENT</p></div>}</div></SidebarHeader><SidebarContent className="px-3"><p className="px-2 pb-2 text-[10px] font-semibold tracking-[0.16em] text-[#94a394] group-data-[collapsible=icon]:hidden">系统导航</p><SidebarMenu className="gap-1">{visibleMenuItems.map(item => <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={location === item.path} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl text-[#607560] data-[active=true]:bg-[#dfeeda] data-[active=true]:font-semibold data-[active=true]:text-[#315b3b] hover:bg-[#edf5e9]"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent><SidebarFooter className="p-3"><div className="rounded-2xl bg-[#edf5e9] p-2 group-data-[collapsible=icon]:bg-transparent"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-1 text-left"><Avatar className="h-9 w-9 border border-[#cfe0ca]"><AvatarFallback className="bg-[#dcebd8] text-xs font-semibold text-[#456f4e]">{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium text-[#3b573f]">{user?.name || "已登录用户"}</p><p className="mt-0.5 text-xs text-[#789079]">{user?.role === "admin" ? "管理员" : "普通用户"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="text-rose-700 focus:text-rose-700"><LogOut className="mr-2 h-4 w-4" />退出登录</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></SidebarFooter></Sidebar><div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#84aa84]/40 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} /></div><SidebarInset className="bg-[#e7f0e0]"><div className="control-surface min-h-screen">{isMobile && <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[#d9e5d6] bg-[#f9fcf7]/90 px-3 backdrop-blur"><SidebarTrigger className="h-9 w-9 rounded-xl bg-white" /><span className="text-sm font-semibold text-[#314a36]">{active?.label ?? "运营仪表盘"}</span></header>}<main className="mx-auto w-full max-w-[1540px] p-4 lg:p-7">{children}</main></div></SidebarInset></>;
}
