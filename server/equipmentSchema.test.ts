import { describe, expect, it } from "vitest";
import { equipmentSchema } from "./routers";

const baseEquipment = { code: "EQ-VALIDATE-01", name: "验证设备", model: "Model-A", specification: "Spec-A", process: "装配", location: "A-01", status: "running" as const };

describe("设备详情字段接口校验", () => {
  it("接受边界内的详情字段、零值和可空投资标记", () => {
    const result = equipmentSchema.safeParse({ ...baseEquipment, hourlyCapacity: 0, oee: 1, energyConsumption: 0, quantity: 0, unitPrice: 0, depreciationYears: 0, lossFactor: 0, investmentIncluded: null, supplier: "供应商", notes: "备注" });
    expect(result.success).toBe(true);
  });

  it("接受行内自动保存提交的 BU、工厂、运营与投资字段组合", () => {
    const result = equipmentSchema.partial().safeParse({ businessUnitId: "2", factoryId: "7", supplier: "工艺装备供应商", hourlyCapacity: "180", oee: "0.88", energyConsumption: "12.5", quantity: "3", unitPrice: "25.6", depreciationYears: "8", lossFactor: "0.05", investmentIncluded: true, lowOeeReason: "换型频繁", notes: "行内更新" });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ businessUnitId: 2, factoryId: 7, quantity: 3, investmentIncluded: true });
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
