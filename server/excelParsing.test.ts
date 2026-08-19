import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseEquipmentWorkbook, parseMaintenanceWorkbook, parseRepairWorkbook } from "../client/src/lib/excel";

function workbookFile(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "数据");
  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { arrayBuffer: async () => output } as File;
}

describe("Excel 批量导入解析", () => {
  it("按指定中文字段解析设备台账和状态", async () => {
    const rows = await parseEquipmentWorkbook(workbookFile([{
      "编号": "EQ-001", "名称": "装配设备", "型号": "M-01", "规格": "S-01", "所属工序": "装配", "位置": "A-01", "状态": "运行中",
    }]));
    expect(rows).toEqual([{ code: "EQ-001", name: "装配设备", model: "M-01", specification: "S-01", process: "装配", location: "A-01", status: "running" }]);
  });

  it("解析设备详情扩展字段并校验投资布尔值", async () => {
    const rows = await parseEquipmentWorkbook(workbookFile([{
      "编号": "EQ-002", "名称": "加工设备", "型号": "M-02", "规格": "S-02", "所属工序": "加工", "位置": "B-01", "状态": "运行中", "供应商": "供应商A", "每小时产能（pcs）": "120", "OEE": "0.88", "OEE偏低原因": "换型频繁", "能耗（kW）": "8.5", "数量（台）": "2", "单价（万元）": "15", "折旧年数": "8", "损耗系数": "0.03", "计入投资": "是", "备注": "按月复核",
    }]));
    expect(rows[0]).toMatchObject({ supplier: "供应商A", hourlyCapacity: 120, oee: 0.88, lowOeeReason: "换型频繁", energyConsumption: 8.5, quantity: 2, unitPrice: 15, depreciationYears: 8, lossFactor: 0.03, investmentIncluded: true, notes: "按月复核" });
  });

  it("解析 BU、工厂、供应商编码及设备生命周期字段", async () => {
    const rows = await parseEquipmentWorkbook(workbookFile([{
      "编号": "EQ-003", "名称": "验证设备", "型号": "M-03", "规格": "S-03", "所属工序": "注塑", "位置": "C-01", "状态": "运行中", "BU编码": "BU1", "工厂编码": "MD", "供应商编码": "SUP-01", "资产类别": "注塑成型设备", "关键等级": "A", "责任人": "王工", "启用日期": "2024-01-15", "保修到期日": "2027-01-14",
    }]));
    expect(rows[0]).toMatchObject({ businessUnitCode: "BU1", factoryCode: "MD", supplierCode: "SUP-01", assetCategory: "注塑成型设备", criticality: "A", responsibleOwner: "王工" });
    expect(rows[0]?.commissionedAt?.toISOString()).toBe("2024-01-15T00:00:00.000Z");
    expect(rows[0]?.warrantyExpiresAt?.toISOString()).toBe("2027-01-14T00:00:00.000Z");
  });

  it("解析保养与维修记录的指定字段、费用和完成时间", async () => {
    const maintenance = await parseMaintenanceWorkbook(workbookFile([{
      "设备编号": "EQ-001", "执行人": "张工", "完成时间": "2026-08-17T08:00:00.000Z", "保养内容": "润滑检查", "备注": "正常",
    }]));
    const repairs = await parseRepairWorkbook(workbookFile([{
      "设备编号": "EQ-001", "维修人员": "李工", "维修内容": "更换传感器", "费用": "128.50", "完成时间": "2026-08-17T09:00:00.000Z",
    }]));
    expect(maintenance[0]).toMatchObject({ equipmentCode: "EQ-001", executor: "张工", maintenanceContent: "润滑检查", notes: "正常" });
    expect(maintenance[0]?.completedAt.toISOString()).toBe("2026-08-17T08:00:00.000Z");
    expect(repairs[0]).toMatchObject({ equipmentCode: "EQ-001", technician: "李工", repairContent: "更换传感器", repairCost: "128.50" });
    expect(repairs[0]?.completedAt.toISOString()).toBe("2026-08-17T09:00:00.000Z");
  });
});
