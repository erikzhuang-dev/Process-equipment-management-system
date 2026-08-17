import { describe, expect, it } from "vitest";
import { equipmentSchema } from "./routers";

const baseEquipment = { code: "EQ-VALIDATE-01", name: "验证设备", model: "Model-A", specification: "Spec-A", process: "装配", location: "A-01", status: "running" as const };

describe("设备详情字段接口校验", () => {
  it("接受边界内的详情字段、零值和可空投资标记", () => {
    const result = equipmentSchema.safeParse({ ...baseEquipment, hourlyCapacity: 0, oee: 1, energyConsumption: 0, quantity: 0, unitPrice: 0, depreciationYears: 0, lossFactor: 0, investmentIncluded: null, supplier: "供应商", notes: "备注" });
    expect(result.success).toBe(true);
  });

  it("拒绝 OEE 超出 0 到 1 的范围以及负数运营与投资数值", () => {
    expect(equipmentSchema.safeParse({ ...baseEquipment, oee: 1.01 }).success).toBe(false);
    expect(equipmentSchema.safeParse({ ...baseEquipment, quantity: -1 }).success).toBe(false);
    expect(equipmentSchema.safeParse({ ...baseEquipment, unitPrice: -0.01 }).success).toBe(false);
  });

  it("拒绝超过供应商和备注字段长度的文本", () => {
    expect(equipmentSchema.safeParse({ ...baseEquipment, supplier: "A".repeat(161) }).success).toBe(false);
    expect(equipmentSchema.safeParse({ ...baseEquipment, notes: "A".repeat(4001) }).success).toBe(false);
  });
});
