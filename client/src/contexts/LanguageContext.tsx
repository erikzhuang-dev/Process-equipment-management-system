import { createContext, useContext, useEffect, useState } from "react";

export type Language = "zh" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; toggleLanguage: () => void };
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = "equipment-management-language";
const translations: Record<string, string> = { "搜索编号、名称或所属工序": "Search code, name or process", "编号": "Code", "名称": "Name", "型号": "Model", "规格": "Specification", "所属工序": "Process", "位置": "Location", "状态": "Status", "操作": "Actions", "详情": "Details", "历史": "History", "编辑": "Edit", "删除": "Delete", "运行中": "Running", "停机": "Stopped", "维修中": "Maintenance", "报废": "Scrapped", "共": "Total", "条记录": "records", "新增设备": "Add Equipment", "导入 Excel": "Import Excel", "导出 Excel": "Export Excel", "设备总数": "Equipment Total", "已纳入设备台账": "Registered equipment", "在线率": "Online Rate", "运行中设备占比": "Share of running equipment", "故障率": "Fault Rate", "当前待处理故障 0 项": "Open faults: 0", "保养完成率": "Maintenance Completion", "已完成维修 1 项": "Completed repairs: 1", "已完成维修 0 项": "Completed repairs: 0", "维修频次趋势": "Repair Frequency Trend", "以已完成维修工单为统计口径": "Based on completed repair work orders", "暂无维修趋势数据": "No repair trend data", "完成维修工单后，系统将根据完成时间自动汇总趋势。": "After a repair is completed, the system summarizes its trend by completion time.", "设备状态分布": "Equipment Status Distribution", "当前台账状态实时汇总": "Live summary of current register statuses", "库存风险提示：0 项备件库存低于或等于安全库存。": "Inventory risk: 0 parts are at or below safety stock.", "近期保养工单": "Recent Maintenance Orders", "暂无保养工单": "No maintenance orders", "新增周期性保养计划后，系统会立即生成首张待执行工单。": "Creating a recurring maintenance plan immediately generates the first pending order.", "关键运营说明": "Key Operating Notes", "设备状态的每一次变更均保留变更前后状态及操作者。": "Every status change retains before-and-after values and its operator.", "完成周期保养会自动将计划推进至下一周期并生成下一张工单。": "Completing recurring maintenance advances the plan and creates the next work order.", "备件出入库会写入不可缺失的库存流水和操作审计记录。": "Every parts receipt or issue creates immutable inventory and audit records." };
const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([zh, en]) => [en, zh]));

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh");
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language); document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    const map = language === "en" ? translations : reverseTranslations;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = []; let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
    nodes.forEach(textNode => { const raw = textNode.nodeValue ?? ""; const leading = raw.match(/^\s*/)?.[0] ?? ""; const trailing = raw.match(/\s*$/)?.[0] ?? ""; const core = raw.trim(); if (map[core]) textNode.nodeValue = `${leading}${map[core]}${trailing}`; });
    document.querySelectorAll<HTMLInputElement>("input[placeholder]").forEach(input => { if (input.placeholder && map[input.placeholder]) input.placeholder = map[input.placeholder]; });
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage: () => setLanguage(current => current === "zh" ? "en" : "zh") }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
