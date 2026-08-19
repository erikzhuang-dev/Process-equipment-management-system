import * as XLSX from "xlsx";

const equipmentStatusMap = {
  "运行中": "running",
  "停机": "stopped",
  "维修中": "maintenance",
  "报废": "scrapped",
} as const;

function getText(row: Record<string, unknown>, field: string) {
  const value = row[field];
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`缺少必填字段：${field}`);
  }
  return String(value).trim();
}

function optionalText(row: Record<string, unknown>, field: string) {
  const value = String(row[field] ?? "").trim();
  return value || undefined;
}

function optionalNumber(row: Record<string, unknown>, field: string) {
  const value = optionalText(row, field);
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field}必须是有效数字`);
  return number;
}

function optionalBoolean(row: Record<string, unknown>, field: string) {
  const value = optionalText(row, field);
  if (value === undefined) return undefined;
  if (["是", "yes", "true", "1"].includes(value.toLowerCase())) return true;
  if (["否", "no", "false", "0"].includes(value.toLowerCase())) return false;
  throw new Error(`${field}仅支持：是/否`);
}

function optionalDate(row: Record<string, unknown>, field: string) {
  const value = row[field];
  if (value === null || value === undefined || String(value).trim() === "") return undefined;
  return getDate(value, field);
}

function optionalCriticality(row: Record<string, unknown>) {
  const value = optionalText(row, "关键等级");
  if (value === undefined) return undefined;
  const normalized = value.toUpperCase();
  if (["A", "B", "C"].includes(normalized)) return normalized as "A" | "B" | "C";
  throw new Error("关键等级仅支持：A/B/C");
}

function getDate(value: unknown, field: string) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S));
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`${field}不是有效日期`);
  return parsed;
}

async function rowsFromFile(file: File) {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!firstSheet) throw new Error("未检测到可读取的工作表");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  if (rows.length === 0) throw new Error("导入文件没有数据行");
  return rows;
}

export async function parseEquipmentWorkbook(file: File) {
  return (await rowsFromFile(file)).map(row => {
    const statusLabel = getText(row, "状态") as keyof typeof equipmentStatusMap;
    const status = equipmentStatusMap[statusLabel];
    if (!status) throw new Error("状态仅支持：运行中、停机、维修中、报废");
    return {
      code: getText(row, "编号"),
      name: getText(row, "名称"),
      model: getText(row, "型号"),
      specification: getText(row, "规格"),
      process: getText(row, "所属工序"),
      location: getText(row, "位置"),
      status,
      supplier: optionalText(row, "供应商"),
      businessUnitCode: optionalText(row, "BU编码"),
      factoryCode: optionalText(row, "工厂编码"),
      supplierCode: optionalText(row, "供应商编码"),
      assetCategory: optionalText(row, "资产类别"),
      criticality: optionalCriticality(row),
      responsibleOwner: optionalText(row, "责任人"),
      commissionedAt: optionalDate(row, "启用日期"),
      warrantyExpiresAt: optionalDate(row, "保修到期日"),
      hourlyCapacity: optionalNumber(row, "每小时产能（pcs）"),
      oee: optionalNumber(row, "OEE"),
      lowOeeReason: optionalText(row, "OEE偏低原因"),
      energyConsumption: optionalNumber(row, "能耗（kW）"),
      quantity: optionalNumber(row, "数量（台）"),
      unitPrice: optionalNumber(row, "单价（万元）"),
      depreciationYears: optionalNumber(row, "折旧年数"),
      lossFactor: optionalNumber(row, "损耗系数"),
      investmentIncluded: optionalBoolean(row, "计入投资"),
      notes: optionalText(row, "备注"),
    };
  });
}

export async function parseMaintenanceWorkbook(file: File) {
  return (await rowsFromFile(file)).map(row => ({
    equipmentCode: getText(row, "设备编号"),
    executor: getText(row, "执行人"),
    completedAt: getDate(row["完成时间"], "完成时间"),
    maintenanceContent: getText(row, "保养内容"),
    notes: String(row["备注"] ?? "").trim() || undefined,
  }));
}

export async function parseRepairWorkbook(file: File) {
  return (await rowsFromFile(file)).map(row => ({
    equipmentCode: getText(row, "设备编号"),
    technician: getText(row, "维修人员"),
    repairContent: getText(row, "维修内容"),
    repairCost: getText(row, "费用"),
    completedAt: getDate(row["完成时间"], "完成时间"),
  }));
}

export function downloadWorkbook(filename: string, sheetName: string, rows: Record<string, string | number | Date | null | undefined>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename, { compression: true });
}
