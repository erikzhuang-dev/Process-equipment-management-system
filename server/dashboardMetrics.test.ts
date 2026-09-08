import { describe, expect, it } from "vitest";
import { computeDashboardMetrics } from "./db";
import type { DashboardMetricsInput } from "./db";

type Row = Record<string, unknown>;

const row = (overrides: Row): Row => ({
  id: 0,
  code: "X",
  name: "设备",
  status: "running",
  oee: null,
  quantity: null,
  unitPrice: null,
  criticality: null,
  businessUnitId: null,
  commissionedAt: null,
  warrantyExpiresAt: null,
  ...overrides,
});

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day);

const equipmentRows = [
  row({ id: 1, code: "E01", oee: 0.96, quantity: 3, unitPrice: "21.50", criticality: "B", businessUnitId: 1, commissionedAt: d(2024, 6, 21), warrantyExpiresAt: d(2027, 6, 20) }),
  row({ id: 2, code: "E02", oee: 0.9, quantity: 1, unitPrice: "58.40", criticality: "A", businessUnitId: 1, commissionedAt: d(2024, 5, 16), warrantyExpiresAt: d(2027, 1, 28) }),
  row({ id: 3, code: "E03", oee: 0.9, quantity: 1, unitPrice: "68.00", criticality: "A", businessUnitId: 2, commissionedAt: d(2023, 8, 31), warrantyExpiresAt: d(2026, 8, 30) }),
  row({ id: 4, code: "E04", oee: 0.87, quantity: 1, unitPrice: "42.50", criticality: "B", businessUnitId: 2, commissionedAt: d(2023, 10, 17), warrantyExpiresAt: d(2026, 10, 16) }),
  row({ id: 5, code: "E05", oee: 0.92, quantity: 4, unitPrice: "18.60", criticality: "B", businessUnitId: 3, commissionedAt: d(2024, 4, 15), warrantyExpiresAt: d(2027, 4, 6) }),
  row({ id: 6, code: "E06", oee: 0.89, quantity: 1, unitPrice: "49.80", criticality: "A", businessUnitId: 3, commissionedAt: d(2024, 7, 5), warrantyExpiresAt: d(2027, 5, 14) }),
  row({ id: 7, code: "E07", oee: 0.93, quantity: 2, unitPrice: "96.00", criticality: "A", businessUnitId: 1, commissionedAt: d(2023, 11, 9), warrantyExpiresAt: d(2026, 12, 8) }),
  row({ id: 8, code: "E08", oee: 0.91, quantity: 2, unitPrice: "86.50", criticality: "A", businessUnitId: 4, commissionedAt: d(2024, 3, 15), warrantyExpiresAt: d(2026, 11, 8) }),
  row({ id: 9, code: "E09", oee: 0.88, quantity: 1, unitPrice: "74.20", criticality: "A", businessUnitId: 4, commissionedAt: d(2024, 6, 21), warrantyExpiresAt: d(2027, 2, 18) }),
  row({ id: 10, code: "E10", oee: 0.94, quantity: 2, unitPrice: "35.00", criticality: "B", businessUnitId: 4, commissionedAt: d(2024, 2, 15), warrantyExpiresAt: d(2026, 3, 10) }),
  row({ id: 11, code: "QA-PEM-001", oee: 0.9, quantity: 1, unitPrice: "35.00", criticality: null, businessUnitId: 4, commissionedAt: null, warrantyExpiresAt: null }),
] as DashboardMetricsInput["equipmentRows"];

const businessUnitRows = [
  { id: 1, code: "BU4", name: "BU4" },
  { id: 2, code: "BU2", name: "BU2" },
  { id: 3, code: "BU3", name: "BU3" },
  { id: 4, code: "BU1", name: "BU1" },
] as DashboardMetricsInput["businessUnitRows"];

const baseInput: DashboardMetricsInput = {
  equipmentRows,
  faultRows: [] as DashboardMetricsInput["faultRows"],
  maintenanceRows: [] as DashboardMetricsInput["maintenanceRows"],
  repairRows: [] as DashboardMetricsInput["repairRows"],
  partRows: [] as DashboardMetricsInput["partRows"],
  businessUnitRows,
  now: d(2026, 9, 8),
};

describe("运营仪表盘指标扩展", () => {
  it("存量字段语义不变（在线率分母剔除报废）", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.totalEquipment).toBe(11);
    expect(metrics.onlineRate).toBe(100);
    expect(metrics.faultRate).toBe(0);
    expect(metrics.openFaults).toBe(0);
    expect(metrics.completedRepairs).toBe(0);
    expect(metrics.lowStockParts).toBe(0);
    expect(metrics.maintenanceCompletionRate).toBe(0);
  });

  it("在线率分母剔除报废设备", () => {
    const metrics = computeDashboardMetrics({
      ...baseInput,
      equipmentRows: [...equipmentRows, row({ id: 12, code: "E12", status: "scrapped" })] as DashboardMetricsInput["equipmentRows"],
    });
    expect(metrics.totalEquipment).toBe(12);
    expect(metrics.onlineRate).toBe(11 / 11 * 100);
  });

  it("新增标量：资产原值 901.80 万、OEE 达标率 72.7%、保修临期 2 台", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.totalAssetValue).toBe(901.8);
    expect(metrics.oeeComplianceRate).toBe(72.7);
    expect(metrics.warrantyDueSoonCount).toBe(2);
  });

  it("保修概览：2 台已过保 + 2 台临期 + 6 台在保 + 1 台未录入（90 天窗口）", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.warrantyOverview).toMatchObject({ expired: 2, dueSoon: 2, inWarranty: 6, notEntered: 1, dueSoonWindowDays: 90 });
  });

  it("OEE 恰好 0.90 计入达标；未录入为 0", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.oeeOverview).toMatchObject({ threshold: 0.9, compliant: 8, nonCompliant: 3, notEntered: 0, rate: 72.7 });
  });

  it("BU 分布按数据库 ID 关联编码（buId=1 是 BU4），数量与资产价值正确", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.buDistribution).toHaveLength(4);
    expect(metrics.buDistribution[0]).toMatchObject({ buId: 1, buCode: "BU4", count: 3, assetValue: 314.9 });
    const bu1 = metrics.buDistribution.find(item => item.buCode === "BU1");
    expect(bu1).toMatchObject({ buId: 4, count: 4, assetValue: 352.2 });
  });

  it("关键等级分布：A6 / B4 / C0 / 未录入 1", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.criticalityBreakdown).toEqual([
      { label: "A", count: 6 },
      { label: "B", count: 4 },
      { label: "C", count: 0 },
      { label: "未录入", count: 1 },
    ]);
  });

  it("启用年份分布：2023 年 3 台、2024 年 7 台、未录入 1 台", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.ageDistribution).toEqual([
      { label: "2023", count: 3 },
      { label: "2024", count: 7 },
      { label: "未录入", count: 1 },
    ]);
  });

  it("资产价值 TOP 设备：E07 192 万居首", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.topValueEquipment[0]).toMatchObject({ id: 7, assetValue: 192 });
    expect(metrics.topValueEquipment).toHaveLength(5);
  });

  it("状态分布含全枚举", () => {
    const metrics = computeDashboardMetrics(baseInput);
    expect(metrics.statusBreakdown).toEqual([
      { status: "running", label: "运行中", count: 11 },
      { status: "stopped", label: "停机", count: 0 },
      { status: "maintenance", label: "保养中", count: 0 },
      { status: "scrapped", label: "报废", count: 0 },
    ]);
  });
});
