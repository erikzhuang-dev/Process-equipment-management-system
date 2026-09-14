import { describe, expect, it } from "vitest";
import { filterEquipmentByBusinessUnit, getSelectedBusinessUnit, toggleBusinessUnitSelection } from "./businessUnitFilter";

const businessUnits = ["BU1", "BU2", "BU3", "BU4"].map((code, index) => ({ id: index + 1, code }));
const equipment = [{ businessUnitId: 1, code: "QA-PEM-001" }, { businessUnitId: 2, code: "QA-PEM-002" }];

describe("BU 卡片筛选", () => {
  it("支持 BU1–BU4 选择与再次点击清除", () => {
    for (const code of ["BU1", "BU2", "BU3", "BU4"]) {
      expect(toggleBusinessUnitSelection(null, code)).toBe(code);
      expect(toggleBusinessUnitSelection(code, code)).toBeNull();
    }
  });

  it("按 BU 返回关联设备并对无匹配 BU 返回空列表", () => {
    const bu1 = getSelectedBusinessUnit(businessUnits, "BU1");
    const bu3 = getSelectedBusinessUnit(businessUnits, "BU3");
    expect(filterEquipmentByBusinessUnit(equipment, bu1?.id ?? null).map(item => item.code)).toEqual(["QA-PEM-001"]);
    expect(filterEquipmentByBusinessUnit(equipment, bu3?.id ?? null)).toEqual([]);
    expect(filterEquipmentByBusinessUnit(equipment, null)).toHaveLength(2);
  });
});
