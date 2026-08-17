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
