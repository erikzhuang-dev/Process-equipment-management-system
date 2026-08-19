import { describe, expect, it } from "vitest";
import { reconcileInlineEditorSnapshot } from "./inlineEditorState";

describe("行内编辑器刷新协调", () => {
  it("同一设备列表刷新时保留展开行草稿与已保存状态", () => {
    const draft = { notes: "正在编辑的草稿", investmentIncluded: true };
    const current = { equipmentId: 1, values: draft, saveState: "saved" as const };
    expect(reconcileInlineEditorSnapshot(current, 1, { notes: "服务端旧值", investmentIncluded: false })).toBe(current);
  });

  it("切换到另一台设备时重置草稿与保存状态", () => {
    const current = { equipmentId: 1, values: { notes: "设备一草稿" }, saveState: "saving" as const };
    expect(reconcileInlineEditorSnapshot(current, 2, { notes: "设备二原始值" })).toEqual({ equipmentId: 2, values: { notes: "设备二原始值" }, saveState: "idle" });
  });
});
