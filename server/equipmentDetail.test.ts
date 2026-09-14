import { describe, expect, it } from "vitest";
import { calculateEquipmentAmounts, displayOee } from "../src/lib/equipmentDetail";

describe("设备详情金额计算", () => {
  it("按数量与单价计算合计金额", () => {
    expect(calculateEquipmentAmounts({ quantity: 2, unitPrice: 10 })).toEqual({ totalAmount: 20 });
  });
  it("未录入数量或单价时不生成虚构金额", () => {
    expect(calculateEquipmentAmounts({ quantity: null, unitPrice: 10 })).toEqual({ totalAmount: null });
  });
  it("OEE 以百分比格式展示", () => {
    expect(displayOee("0.875")).toBe("87.5%");
  });
});
