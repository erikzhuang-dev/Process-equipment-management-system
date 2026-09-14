import { describe, expect, it } from "vitest";
import { canSubmitMaintenanceCompletion, createMaintenanceCompletionDraft } from "./maintenanceCompletion";

describe("maintenance completion draft", () => {
  it("initializes a dialog-ready draft with the original work order content", () => {
    expect(createMaintenanceCompletionDraft(210001, "润滑检查")).toEqual({ workOrderId: 210001, executor: "", maintenanceContent: "润滑检查", notes: "" });
  });

  it("requires both executor and maintenance content before submission", () => {
    const draft = createMaintenanceCompletionDraft(210001, "润滑检查");
    expect(canSubmitMaintenanceCompletion(draft)).toBe(false);
    expect(canSubmitMaintenanceCompletion({ ...draft, executor: "公开管理员" })).toBe(true);
    expect(canSubmitMaintenanceCompletion({ ...draft, executor: " ", maintenanceContent: "润滑检查" })).toBe(false);
  });
});
