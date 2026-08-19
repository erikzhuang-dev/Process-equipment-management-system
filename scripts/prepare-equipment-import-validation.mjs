import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import * as XLSX from "xlsx";

const outputDir = "/home/ubuntu/exports/process-equipment-management";
const statuses = { running: "运行中", stopped: "停机", maintenance: "维修中", scrapped: "报废" };

const validationRows = [
  ["PEM-VAL-001", "系统验证·预灌封注塑机", "IM-220", "220T", "注塑成型", "BU1-A01", "BU1", "Maider", "SUP-VALID-01", "注塑成型设备", "A", "王工", "2024-01-15", "2027-01-14", 480, 0.91, "", 18.5, 2, 86.5, 8, 0.02, "是"],
  ["PEM-VAL-002", "系统验证·给药装配线", "ASM-120", "120工位", "自动装配", "BU1-A02", "BU1", "Maider", "SUP-VALID-03", "自动装配设备", "A", "王工", "2024-02-20", "2027-02-19", 360, 0.88, "换型与物料切换频繁", 12.8, 1, 74.2, 8, 0.03, "是"],
  ["PEM-VAL-003", "系统验证·视觉检测机", "VIS-300", "12相机", "视觉检测", "BU1-Q01", "BU1", "Maider", "SUP-VALID-04", "质量检测设备", "B", "李工", "2024-03-12", "2026-03-11", 600, 0.94, "", 4.5, 2, 35.0, 5, 0.01, "是"],
  ["PEM-VAL-004", "系统验证·诊断试剂灌装机", "FIL-180", "六头灌装", "试剂灌装", "BU2-B01", "BU2", "LD", "SUP-VALID-02", "灌装设备", "A", "陈工", "2023-09-01", "2026-08-31", 180, 0.9, "", 9.6, 1, 68.0, 8, 0.02, "是"],
  ["PEM-VAL-005", "系统验证·诊断包装机", "PKG-260", "双工位", "包装", "BU2-B02", "BU2", "LD", "SUP-VALID-03", "包装设备", "B", "陈工", "2023-10-18", "2026-10-17", 260, 0.87, "封装材料切换与停机待料", 7.2, 1, 42.5, 6, 0.02, "否"],
  ["PEM-VAL-006", "系统验证·生化分析装配台", "BCA-90", "90工位", "分析仪装配", "BU3-C01", "BU3", "DIAG-VALID", "SUP-VALID-02", "精密装配设备", "B", "赵工", "2024-04-08", "2027-04-07", 90, 0.92, "", 3.1, 4, 18.6, 5, 0.01, "是"],
  ["PEM-VAL-007", "系统验证·诊断卡封装机", "CAR-400", "400卡/小时", "卡片封装", "BU3-C02", "BU3", "DIAG-VALID", "SUP-VALID-03", "封装设备", "A", "赵工", "2024-05-16", "2027-05-15", 400, 0.89, "设备调试与物料补给间隔", 6.4, 1, 49.8, 7, 0.02, "是"],
  ["PEM-VAL-008", "系统验证·输液器组装线", "INF-500", "五模块", "输液器装配", "BU4-D01", "BU4", "VAI-VALID", "SUP-VALID-03", "自动装配设备", "A", "孙工", "2023-11-10", "2026-11-09", 500, 0.93, "", 14.2, 2, 96.0, 8, 0.02, "是"],
  ["PEM-VAL-009", "系统验证·导管成型机", "CAT-150", "精密挤出", "导管成型", "BU4-D02", "BU4", "VAI-VALID", "SUP-VALID-01", "挤出成型设备", "A", "孙工", "2024-01-30", "2027-01-29", 150, 0.9, "", 11.8, 1, 58.4, 8, 0.03, "是"],
  ["PEM-VAL-010", "系统验证·泄漏测试仪", "LKG-240", "四通道", "密封测试", "BU4-Q01", "BU4", "VAI-VALID", "SUP-VALID-04", "质量检测设备", "B", "周工", "2024-06-22", "2027-06-21", 240, 0.96, "", 2.7, 3, 21.5, 5, 0.01, "否"],
].map(([code, name, model, specification, process, location, businessUnitCode, factoryCode, supplierCode, assetCategory, criticality, responsibleOwner, commissionedAt, warrantyExpiresAt, hourlyCapacity, oee, lowOeeReason, energyConsumption, quantity, unitPrice, depreciationYears, lossFactor, investmentIncluded]) => ({
  "编号": code, "名称": name, "型号": model, "规格": specification, "所属工序": process, "位置": location, "状态": "运行中", "BU编码": businessUnitCode, "工厂编码": factoryCode, "供应商编码": supplierCode, "供应商": "", "资产类别": assetCategory, "关键等级": criticality, "责任人": responsibleOwner, "启用日期": commissionedAt, "保修到期日": warrantyExpiresAt, "每小时产能（pcs）": hourlyCapacity, "OEE": oee, "OEE偏低原因": lowOeeReason, "能耗（kW）": energyConsumption, "数量（台）": quantity, "单价（万元）": unitPrice, "折旧年数": depreciationYears, "损耗系数": lossFactor, "计入投资": investmentIncluded, "备注": "系统管理员 Excel 导入验证数据；上线生产前请替换为现场实际台账。",
}));

async function writeWorkbook(file, sheetName, rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  XLSX.writeFile(workbook, file, { compression: true });
}

await fs.mkdir(outputDir, { recursive: true });
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const [baseline] = await connection.query(`
  SELECT e.code AS "编号", e.name AS "名称", e.model AS "型号", e.specification AS "规格", e.process AS "所属工序", e.location AS "位置",
    CASE e.status WHEN 'running' THEN '运行中' WHEN 'stopped' THEN '停机' WHEN 'maintenance' THEN '维修中' ELSE '报废' END AS "状态",
    bu.code AS "BU编码", f.code AS "工厂编码", s.code AS "供应商编码", e.supplier AS "供应商", e.assetCategory AS "资产类别", e.criticality AS "关键等级", e.responsibleOwner AS "责任人",
    DATE_FORMAT(e.commissionedAt, '%Y-%m-%d') AS "启用日期", DATE_FORMAT(e.warrantyExpiresAt, '%Y-%m-%d') AS "保修到期日", e.hourlyCapacity AS "每小时产能（pcs）", e.oee AS "OEE", e.lowOeeReason AS "OEE偏低原因", e.energyConsumption AS "能耗（kW）", e.quantity AS "数量（台）", e.unitPrice AS "单价（万元）", e.depreciationYears AS "折旧年数", e.lossFactor AS "损耗系数", CASE e.investmentIncluded WHEN 1 THEN '是' WHEN 0 THEN '否' ELSE '' END AS "计入投资", e.notes AS "备注"
  FROM equipment e LEFT JOIN business_units bu ON bu.id = e.businessUnitId LEFT JOIN factories f ON f.id = e.factoryId LEFT JOIN suppliers s ON s.id = e.supplierId ORDER BY e.id
`);
await connection.end();

const baselineFile = path.join(outputDir, "设备台账-导出基准.xlsx");
const validationFile = path.join(outputDir, "设备台账-十台系统验证设备导入.xlsx");
await writeWorkbook(baselineFile, "设备台账", baseline);
await writeWorkbook(validationFile, "设备台账", validationRows);
console.log(JSON.stringify({ baselineFile, baselineRows: baseline.length, validationFile, validationRows: validationRows.length }, null, 2));
process.exit(0);
