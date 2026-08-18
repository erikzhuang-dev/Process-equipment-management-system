import { createContext, useContext, useEffect, useState } from "react";

export type Language = "zh" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; toggleLanguage: () => void };
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = "equipment-management-language";
const translations: Record<string, string> = { "搜索编号、名称或所属工序": "Search code, name or process", "编号": "Code", "名称": "Name", "型号": "Model", "规格": "Specification", "所属工序": "Process", "位置": "Location", "状态": "Status", "操作": "Actions", "详情": "Details", "历史": "History", "编辑": "Edit", "删除": "Delete", "运行中": "Running", "停机": "Stopped", "维修中": "Maintenance", "报废": "Scrapped", "共": "Total", "条记录": "records", "新增设备": "Add Equipment", "导入 Excel": "Import Excel", "导出 Excel": "Export Excel", "设备总数": "Equipment Total", "已纳入设备台账": "Registered equipment", "在线率": "Online Rate", "运行中设备占比": "Share of running equipment", "故障率": "Fault Rate", "保养完成率": "Maintenance Completion", "维修频次趋势": "Repair Frequency Trend", "以已完成维修工单为统计口径": "Based on completed repair work orders", "暂无维修趋势数据": "No repair trend data", "完成维修工单后，系统将根据完成时间自动汇总趋势。": "After a repair is completed, the system summarizes its trend by completion time.", "设备状态分布": "Equipment Status Distribution", "当前台账状态实时汇总": "Live summary of current register statuses", "近期保养工单": "Recent Maintenance Orders", "暂无保养工单": "No maintenance orders", "新增周期性保养计划后，系统会立即生成首张待执行工单。": "Creating a recurring maintenance plan immediately generates the first pending order.", "关键运营说明": "Key Operating Notes", "设备状态的每一次变更均保留变更前后状态及操作者。": "Every status change retains before-and-after values and its operator.", "完成周期保养会自动将计划推进至下一周期并生成下一张工单。": "Completing recurring maintenance advances the plan and creates the next work order.", "备件出入库会写入不可缺失的库存流水和操作审计记录。": "Every parts receipt or issue creates immutable inventory and audit records.", "工单": "Work Order", "设备": "Equipment", "计划时间": "Scheduled Time", "执行人": "Executor", "完成时间": "Completed At", "待执行": "Pending", "执行中": "In Progress", "已完成": "Completed", "完成工单": "Complete Order", "已留痕": "Audited", "故障登记": "Fault Log", "维修工单跟踪": "Repair Work Order Tracking", "低": "Low", "中": "Medium", "高": "High", "严重": "Critical", "发现于": "Discovered", "创建维修工单": "Create Repair Order", "关联故障": "Linked Fault", "Excel 导入历史记录": "Excel Import History", "备件 / 耗材管理": "Parts / Consumables Management", "库存数量": "Stock Quantity", "安全库存": "Safety Stock", "库存状态": "Stock Status", "库存充足": "In Stock", "库存不足": "Low Stock", "入库": "Receive", "领用": "Issue", "备件出入库流水": "Parts Inventory Transactions", "最近 100 条记录操作": "Latest 100 transaction records", "时间": "Time", "备件": "Part", "类型": "Type", "数量": "Quantity", "操作人": "Operator", "用户权限与操作日志": "User Permissions & Audit Log", "管理员": "Administrator", "普通用户": "Standard User", "暂无设备台账": "No equipment register", "暂无故障登记": "No fault logs", "暂无保养计划或工单": "No maintenance plans or work orders", "暂无备件": "No parts available" };
const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([zh, en]) => [en, zh]));

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh");
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language); document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    const map = language === "en" ? translations : reverseTranslations;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = []; let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
    nodes.forEach(textNode => { const raw = textNode.nodeValue ?? ""; const leading = raw.match(/^\s*/)?.[0] ?? ""; const trailing = raw.match(/\s*$/)?.[0] ?? ""; const core = raw.trim(); const dynamic = language === "en" ? core.replace(/^当前待处理故障\s+(\d+)\s+项$/, "Open faults: $1").replace(/^已完成维修\s+(\d+)\s+项$/, "Completed repairs: $1").replace(/^库存风险提示：\s*(\d+)\s*项备件库存低于或等于安全库存。$/, "Inventory risk: $1 parts are at or below safety stock.").replace(/^共\s*(\d+)\s*条记录$/, "Total $1 records").replace(/^第\s*(\d+)\s*\/\s*(\d+)\s*页$/, "Page $1 / $2") : core; if (map[core] || dynamic !== core) textNode.nodeValue = `${leading}${map[core] ?? dynamic}${trailing}`; });
    document.querySelectorAll<HTMLInputElement>("input[placeholder]").forEach(input => { if (input.placeholder && map[input.placeholder]) input.placeholder = map[input.placeholder]; });
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage: () => setLanguage(current => current === "zh" ? "en" : "zh") }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
