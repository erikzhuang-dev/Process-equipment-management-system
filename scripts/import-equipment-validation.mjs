import XLSX from "xlsx";
import { importEquipment } from "../server/db.ts";

const file = "/home/ubuntu/exports/process-equipment-management/设备台账-十台系统验证设备导入.xlsx";
const workbook = XLSX.readFile(file, { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const statusMap = { "运行中": "running", "停机": "stopped", "维修中": "maintenance", "报废": "scrapped" };
const parseDate = value => value ? new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`) : undefined;
const parsed = rows.map(row => ({
  code: String(row["编号"]), name: String(row["名称"]), model: String(row["型号"]), specification: String(row["规格"]), process: String(row["所属工序"]), location: String(row["位置"]), status: statusMap[row["状态"]],
  businessUnitCode: String(row["BU编码"] || "") || undefined, factoryCode: String(row["工厂编码"] || "") || undefined, supplierCode: String(row["供应商编码"] || "") || undefined,
  supplier: String(row["供应商"] || "") || undefined, assetCategory: String(row["资产类别"] || "") || undefined, criticality: String(row["关键等级"] || "") || undefined, responsibleOwner: String(row["责任人"] || "") || undefined,
  commissionedAt: parseDate(row["启用日期"]), warrantyExpiresAt: parseDate(row["保修到期日"]), hourlyCapacity: Number(row["每小时产能（pcs)"] ?? row["每小时产能（pcs）"]), oee: Number(row["OEE"]), lowOeeReason: String(row["OEE偏低原因"] || "") || undefined,
  energyConsumption: Number(row["能耗（kW）"]), quantity: Number(row["数量（台）"]), unitPrice: Number(row["单价（万元）"]), depreciationYears: Number(row["折旧年数"]), lossFactor: Number(row["损耗系数"]), investmentIncluded: String(row["计入投资"]) === "是", notes: String(row["备注"] || "") || undefined,
}));
const result = await importEquipment(parsed, 1);
console.log(JSON.stringify({ ...result, codes: parsed.map(row => row.code) }, null, 2));
process.exit(0);
