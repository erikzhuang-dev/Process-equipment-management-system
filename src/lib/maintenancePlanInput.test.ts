import { describe, expect, it } from "vitest";
import { isValidMaintenanceCycle } from "./maintenancePlanInput";

describe("maintenance plan cycle input", () => {
  it("accepts positive integer cycle days", () => {
    expect(isValidMaintenanceCycle("1")).toBe(true);
    expect(isValidMaintenanceCycle("30")).toBe(true);
  });

  it("rejects zero, negative, decimal and blank cycle values", () => {
    expect(isValidMaintenanceCycle("0")).toBe(false);
    expect(isValidMaintenanceCycle("-7")).toBe(false);
    expect(isValidMaintenanceCycle("1.5")).toBe(false);
    expect(isValidMaintenanceCycle("")).toBe(false);
  });
});
