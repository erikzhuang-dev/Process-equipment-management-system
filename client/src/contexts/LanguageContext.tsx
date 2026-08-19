import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "zh" | "en";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; toggleLanguage: () => void };
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = "equipment-management-language";
const translations: Record<string, string> = {
  "搜索编号、名称或所属工序": "Search code, name or process", "编号": "Code", "名称": "Name", "型号": "Model", "规格": "Specification", "所属工序": "Process", "位置": "Location", "状态": "Status", "操作": "Actions", "详情": "Details", "历史": "History", "编辑": "Edit", "删除": "Delete", "运行中": "Running", "停机": "Stopped", "维修中": "Maintenance", "报废": "Scrapped", "共": "Total", "条记录": "records", "新增设备": "Add Equipment", "导入 Excel": "Import Excel", "导出 Excel": "Export Excel",
  "设备总数": "Equipment Total", "已纳入设备台账": "Registered equipment", "在线率": "Online Rate", "运行中设备占比": "Share of running equipment", "故障率": "Fault Rate", "保养完成率": "Maintenance Completion", "维修频次趋势": "Repair Frequency Trend", "以已完成维修工单为统计口径": "Based on completed repair work orders", "暂无维修趋势数据": "No repair trend data", "完成维修工单后，系统将根据完成时间自动汇总趋势。": "After a repair is completed, the system summarizes its trend by completion time.", "设备状态分布": "Equipment Status Distribution", "当前台账状态实时汇总": "Live summary of current register statuses", "近期保养工单": "Recent Maintenance Orders", "暂无保养工单": "No maintenance orders", "新增周期性保养计划后，系统会立即生成首张待执行工单。": "Creating a recurring maintenance plan immediately generates the first pending order.", "关键运营说明": "Key Operating Notes", "设备状态的每一次变更均保留变更前后状态及操作者。": "Every status change retains before-and-after values and its operator.", "完成周期保养会自动将计划推进至下一周期并生成下一张工单。": "Completing recurring maintenance advances the plan and creates the next work order.", "备件出入库会写入不可缺失的库存流水和操作审计记录。": "Every parts receipt or issue creates immutable inventory and audit records.",
  "工单": "Work Order", "工单 #": "Work Order #", "设备": "Equipment", "计划时间": "Scheduled Time", "执行人": "Executor", "完成时间": "Completed At", "待执行": "Pending", "执行中": "In Progress", "已完成": "Completed", "完成工单": "Complete Order", "已留痕": "Audited", "故障登记": "Fault Log", "维修工单跟踪": "Repair Work Order Tracking", "低": "Low", "中": "Medium", "高": "High", "严重": "Critical", "发现于": "Discovered", "创建维修工单": "Create Repair Order", "关联故障": "Linked Fault", "Excel 导入历史记录": "Excel Import History",
  "备件 / 耗材管理": "Parts / Consumables Management", "库存数量": "Stock Quantity", "安全库存": "Safety Stock", "库存状态": "Stock Status", "库存充足": "In Stock", "低于安全库存": "Below safety stock", "库存不足": "Low Stock", "入库": "Receive", "领用": "Issue", "备件出入库流水": "Parts Inventory Transactions", "最近 100 条记录操作": "Latest 100 transaction records", "时间": "Time", "备件": "Part", "类型": "Type", "数量": "Quantity", "操作人": "Operator", "库存风险提示：": "Inventory risk:", "项备件库存低于或等于安全库存。": "parts are at or below safety stock.",
  "用户权限与操作日志": "User Permissions & Audit Log", "权限与审计": "Permissions & Audit", "用户角色": "User Roles", "操作日志": "Audit Log", "后台基础数据管理": "Master Data Management", "维护设备详情可选的 BU、工厂与供应商信息；创建工厂时可指定其所属 BU。": "Maintain the BU, factory, and supplier options used in equipment details; each factory may be assigned to a BU.", "新增 BU": "Add BU", "新增工厂": "Add Factory", "新增供应商": "Add Supplier", "BU 列表": "BU List", "工厂列表": "Factory List", "供应商列表": "Supplier List", "暂无 BU，请新增。": "No BU yet. Add one to begin.", "暂无工厂，请新增。": "No factories yet. Add one to begin.", "暂无供应商，请新增。": "No suppliers yet. Add one to begin.", "未归属 BU": "Unassigned BU", "管理员": "Administrator", "普通用户": "Standard User", "未命名用户": "Unnamed user", "暂无已登录用户": "No signed-in users", "用户完成登录后将显示在这里，管理员可以调整其角色。": "Users appear here after signing in; administrators can update their roles.", "暂无操作日志": "No audit log entries", "对设备、保养、维修、备件和角色的关键操作会自动写入此处。": "Key equipment, maintenance, repair, parts, and role changes are recorded here automatically.",
  "设备全生命周期": "Equipment Lifecycle", "设备台账管理": "Equipment Register", "维护生产设备基本信息，并对设备状态变更进行完整追溯。": "Maintain equipment master data and fully trace every status change.", "设备已新增": "Equipment added", "设备已删除": "Equipment deleted", "设备状态已变更并留痕": "Equipment status changed and audited", "设备状态变更历史": "Equipment Status History", "每次状态变更均记录变更前后状态、变更人及时间。": "Every status change records before-and-after status, operator, and time.", "初始状态": "Initial status", "暂无状态变更记录": "No status changes", "初始登记后的状态变更将在此处显示。": "Status changes after initial registration appear here.", "变更设备状态": "Change Equipment Status", "状态变更会自动写入设备状态历史和操作日志。": "Status changes are automatically recorded in status history and the audit log.", "暂无设备台账": "No equipment register", "管理员可新增设备，或按标准字段导入 Excel 台账；系统不会预置虚构设备数据。": "Administrators can add equipment or import a standard Excel register; the system does not preload fictional records.",
  "预防性维护": "Preventive Maintenance", "保养计划与工单": "Maintenance Plans & Work Orders", "制定设备周期性保养计划，完成工单后自动生成下一周期待执行记录。": "Schedule recurring maintenance; completing an order automatically creates the next pending cycle.", "正在读取已建立的保养计划与工单。": "Loading maintenance plans and work orders.", "正在加载保养计划与工单…": "Loading maintenance plans and work orders…", "制定计划": "Create Plan", "保养计划已建立，并生成首张工单": "Maintenance plan created and first work order generated", "保养工单已完成，下一周期工单已生成": "Maintenance order completed and next cycle generated", "暂无保养计划或工单": "No maintenance plans or work orders", "制定周期性保养计划后，系统会生成首张待执行工单。": "Creating a recurring maintenance plan creates the first pending work order.", "制定周期性保养计划": "Create Recurring Maintenance Plan", "系统根据周期生成首张保养工单；完成后将自动推进下一周期。": "The system generates the first maintenance order from the cycle and advances to the next cycle on completion.", "保养周期（天）": "Maintenance cycle (days)", "保养内容": "Maintenance content", "生成计划与工单": "Create plan and work order", "选择设备": "Select equipment", "请输入执行人": "Enter executor", "请输入保养内容": "Enter maintenance content", "请输入备注（可留空）": "Enter notes (optional)",
  "故障闭环": "Fault Resolution", "故障报修与维修记录": "Faults & Repair Records", "从故障登记到维修完成，记录严重程度、维修人员、维修内容、费用与完成时间。": "From fault registration through repair completion, record severity, technician, repair content, cost, and completion time.", "故障已登记": "Fault logged", "维修工单已创建": "Repair work order created", "维修工单已完成": "Repair work order completed", "暂无故障登记": "No fault logs", "可在发现设备异常时登记故障，并创建对应维修工单。": "Log a fault when an abnormality is found, then create its repair work order.", "暂无维修工单": "No repair work orders", "创建故障对应的维修工单，完成后将形成可导出的维修记录。": "Create a repair work order for a fault; completed repairs become exportable records.", "待接单": "Awaiting assignment", "完成维修": "Complete repair", "维修人员": "Technician", "维修内容": "Repair content", "费用": "Cost", "故障描述": "Fault description", "发现时间": "Discovered time", "严重程度": "Severity", "保存故障登记": "Save fault log", "登记故障描述、发现时间与严重程度；随后可创建维修工单持续跟踪。": "Record the fault description, discovery time, and severity, then create a repair work order for follow-up.", "请输入维修人员": "Enter technician", "请输入维修内容": "Enter repair content", "请输入维修费用": "Enter repair cost",
  "库存保障": "Inventory Assurance", "维护备件名称、规格、库存数量与安全库存，并对每次入库、领用进行留痕。": "Maintain part names, specifications, stock quantities, and safety stock, with an audit trail for every receipt and issue.", "新增备件": "Add Part", "备件已新增": "Part added", "库存流水已记录": "Inventory transaction recorded", "暂无备件或耗材台账": "No parts or consumables register", "管理员可新增备件；后续每次入库与领用都将形成库存流水和操作日志。": "Administrators can add parts; every later receipt or issue creates inventory and audit records.", "暂无出入库流水": "No inventory transactions", "完成入库或领用后，将在此处保留数量、操作人和操作时间。": "Each receipt or issue retains quantity, operator, and time here.", "新增备件 / 耗材": "Add Part / Consumable", "请维护备件台账的名称、规格、库存数量与安全库存。": "Maintain the part name, specification, stock quantity, and safety stock.", "保存备件": "Save part",
  "设备详情": "Equipment Detail", "编辑设备详情": "Edit Equipment Detail", "保存后会刷新台账、详情、仪表盘与导出数据。": "Saving refreshes the register, detail, dashboard, and export data.", "取消": "Cancel", "所属 BU": "Business Unit", "工厂": "Factory", "供应商": "Supplier", "资产类别": "Asset Category", "关键等级": "Criticality", "责任人": "Responsible Owner", "启用日期": "Commissioned Date", "保修到期日": "Warranty Expiry", "每小时产能（pcs）": "Hourly Capacity (pcs)", "能耗（kW）": "Energy Consumption (kW)", "数量（台）": "Quantity (units)", "单价（万元）": "Unit Price (10k CNY)", "折旧年数": "Depreciation Years", "损耗系数": "Loss Factor", "合计金额（万元）": "Total Amount (10k CNY)", "计入投资": "Include in Investment", "计入投资金额（万元）": "Investment Amount (10k CNY)", "OEE偏低原因": "Reason for Low OEE", "OEE 偏低原因": "Reason for Low OEE", "备注": "Notes", "保存详情": "Save detail", "保存中…": "Saving…", "设备详情已保存": "Equipment detail saved", "设备详情保存失败": "Failed to save equipment detail", "正在读取设备详情…": "Loading equipment detail…", "未找到该设备": "Equipment not found", "返回设备台账": "Back to Equipment Register", "查看详情": "View Detail", "编辑详情": "Edit Detail", "设备编号": "Equipment Code", "设备、生产与生命周期参数": "Equipment, Production & Lifecycle", "投资与折旧": "Investment & Depreciation", "治理信息": "Governance Information", "资产记录更新时间": "Asset record updated", "未选择 BU": "No BU selected", "未选择工厂": "No factory selected", "未选择供应商": "No supplier selected", "未分级": "Unclassified", "关键": "Critical", "重要": "Important", "一般": "Standard", "是": "Yes", "否": "No", "未录入": "Not recorded",
};
const paginationTokenTranslations: Record<string, string> = { "第": "Page", "页": "" };
const equipmentListDynamicTranslations: Record<string, string> = {
  "清除": "Clear",
  "筛选": "filter",
  "暂无设备": "No equipment",
  "当前 BU 暂无归属设备；可清除筛选查看全部设备。": "This business unit has no assigned equipment. Clear the filter to view all equipment.",
};
const reverseTranslations = Object.fromEntries(Object.entries(translations).map(([zh, en]) => [en, zh]));

export function translateDynamicText(core: string, language: Language) {
  if (language !== "en") return core;
  return core
    .replace(/^当前待处理故障\s+(\d+)\s+项$/, "Open faults: $1")
    .replace(/^已完成维修\s+(\d+)\s+项$/, "Completed repairs: $1")
    .replace(/^库存风险提示：\s*(\d+)\s*项备件库存低于或等于安全库存。$/, "Inventory risk: $1 parts are at or below safety stock.")
    .replace(/^工单\s*#?\s*(\d+)$/, "Work Order #$1")
    .replace(/^共\s*(\d+)\s*条记录$/, "Total $1 records")
    .replace(/^第\s*(\d+)\s*\/\s*(\d+)\s*页$/, "Page $1 / $2")
    .replace(/^(.+?)\s+暂无设备$/, "$1 has no equipment");
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh");
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language); document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    const map: Record<string, string> = language === "en" ? { ...translations, ...paginationTokenTranslations, ...equipmentListDynamicTranslations } : { ...reverseTranslations, Page: "第" };
    const applyTranslations = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = []; let node: Node | null;
      while ((node = walker.nextNode())) nodes.push(node as Text);
      nodes.forEach(textNode => { const raw = textNode.nodeValue ?? ""; const leading = raw.match(/^\s*/)?.[0] ?? ""; const trailing = raw.match(/\s*$/)?.[0] ?? ""; const core = raw.trim(); const dynamic = translateDynamicText(core, language); const hasMappedValue = Object.prototype.hasOwnProperty.call(map, core); if (hasMappedValue || dynamic !== core) textNode.nodeValue = `${leading}${hasMappedValue ? map[core] : dynamic}${trailing}`; });
      document.querySelectorAll<HTMLInputElement>("input[placeholder]").forEach(input => { if (input.placeholder && map[input.placeholder]) input.placeholder = map[input.placeholder]; });
    };
    applyTranslations();
    const retryTimers = [80, 350, 1000, 2500].map(delay => window.setTimeout(applyTranslations, delay));
    const syncTimer = window.setInterval(applyTranslations, 600);
    const observer = new MutationObserver(applyTranslations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { observer.disconnect(); retryTimers.forEach(timer => window.clearTimeout(timer)); window.clearInterval(syncTimer); };
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage: () => setLanguage(current => current === "zh" ? "en" : "zh") }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
