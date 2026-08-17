import { createContext, useContext, useEffect, useState } from "react";

export type Language = "zh" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; toggleLanguage: () => void };
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = "equipment-management-language";
const translations: Record<string, string> = { "搜索编号、名称或所属工序": "Search code, name or process", "编号": "Code", "名称": "Name", "型号": "Model", "规格": "Specification", "所属工序": "Process", "位置": "Location", "状态": "Status", "操作": "Actions", "详情": "Details", "历史": "History", "编辑": "Edit", "删除": "Delete", "运行中": "Running", "停机": "Stopped", "维修中": "Maintenance", "报废": "Scrapped", "共": "Total", "条记录": "records", "新增设备": "Add Equipment", "导入 Excel": "Import Excel", "导出 Excel": "Export Excel" };
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
