import { describe, expect, it } from "vitest";
import { calculateEquipmentAmounts, displayOee } from "../client/src/lib/equipmentDetail";

describe("设备详情投资计算", () => {
  it("按数量与单价计算合计金额和计入投资金额", () => {
    expect(calculateEquipmentAmounts({ quantity: 2, unitPrice: 10, lossFactor: 0.05, investmentIncluded: true })).toEqual({ totalAmount: 20, investmentAmount: 20 });
  });
  it("未录入数量或单价时不生成虚构金额", () => {
    expect(calculateEquipmentAmounts({ quantity: null, unitPrice: 10, lossFactor: 0, investmentIncluded: true })).toEqual({ totalAmount: null, investmentAmount: null });
  });
  it("OEE 以百分比格式展示", () => {
    expect(displayOee("0.875")).toBe("87.5%");
  });
});
