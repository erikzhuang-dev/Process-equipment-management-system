import { describe, expect, it } from "vitest";
import { applyStockTransaction, assertStatusTransition, calculateNextMaintenanceDate, calculateRate } from "./domainRules";

describe("设备状态流转", () => {
  it("允许运行中设备进入维修并最终恢复运行", () => {
    expect(() => assertStatusTransition("running", "maintenance")).not.toThrow();
    expect(() => assertStatusTransition("maintenance", "running")).not.toThrow();
  });

  it("禁止报废设备重新流转", () => {
    expect(() => assertStatusTransition("scrapped", "running")).toThrow("不允许");
  });
});

describe("备件库存流水", () => {
  it("分别正确记录入库与领用后的库存", () => {
    expect(applyStockTransaction(10, 5, "inbound")).toBe(15);
    expect(applyStockTransaction(10, 4, "outbound")).toBe(6);
  });

  it("阻止超出可用库存的领用", () => {
    expect(() => applyStockTransaction(3, 4, "outbound")).toThrow("库存不足");
  });
});

describe("保养周期与 KPI", () => {
  it("按 UTC 天数生成下一次保养时间", () => {
    const source = new Date("2026-08-01T00:00:00.000Z");
    expect(calculateNextMaintenanceDate(source, 30).toISOString()).toBe("2026-08-31T00:00:00.000Z");
  });

  it("拒绝零、负数和非整数保养周期", () => {
    const source = new Date("2026-08-01T00:00:00.000Z");
    expect(() => calculateNextMaintenanceDate(source, 0)).toThrow("正整数");
    expect(() => calculateNextMaintenanceDate(source, -7)).toThrow("正整数");
    expect(() => calculateNextMaintenanceDate(source, 1.5)).toThrow("正整数");
  });

  it("以一位小数输出分子分母型指标", () => {
    expect(calculateRate(7, 8)).toBe(87.5);
    expect(calculateRate(0, 0)).toBe(0);
  });
});
