// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EquipmentTableRow, InlineEquipmentDetailEditor } from "./Home";

const item = {
  id: 1, code: "QA-PEM-001", name: "工艺设备核验机", model: "QA-MODEL-01", specification: "1200×800×1600 mm", process: "装配工序", location: "A区-装配线-02", status: "running" as const,
  supplier: "", supplierId: null, businessUnitId: 1, factoryId: null, hourlyCapacity: null, oee: null, lowOeeReason: null, energyConsumption: null, quantity: null, unitPrice: null, depreciationYears: null, lossFactor: null, investmentIncluded: false, notes: "",
};

describe("行内设备详情交互", () => {
  it("点击设备行展开 React 详情行", () => {
    const onToggle = vi.fn();
    render(<table><tbody><EquipmentTableRow item={item} expanded={false} isAdmin={false} businessUnits={[]} factories={[]} suppliers={[]} onToggle={onToggle} onDetail={vi.fn()} onHistory={vi.fn()} onStatus={vi.fn()} onInlineSave={vi.fn()} onUpdate={vi.fn()} onDelete={vi.fn()} /></tbody></table>);
    fireEvent.click(screen.getByText("QA-PEM-001"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("自动保存后同设备列表刷新仍保留草稿与已保存状态", async () => {
    const user = userEvent.setup(); const onSave = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<InlineEquipmentDetailEditor item={item} businessUnits={[{ id: 1, code: "BU1", name: "BU1" }]} factories={[]} suppliers={[]} isAdmin onSave={onSave} />);
    const capacity = screen.getByLabelText("每小时产能（pcs）") as HTMLInputElement;
    await user.type(capacity, "120"); await user.tab();
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ hourlyCapacity: "120" })));
    await waitFor(() => expect(screen.getByText("已自动保存")).toBeTruthy());
    rerender(<InlineEquipmentDetailEditor item={{ ...item, hourlyCapacity: null }} businessUnits={[{ id: 1, code: "BU1", name: "BU1" }]} factories={[]} suppliers={[]} isAdmin onSave={onSave} />);
    expect((screen.getByLabelText("每小时产能（pcs）") as HTMLInputElement).value).toBe("120");
    expect(screen.getByText("已自动保存")).toBeTruthy();
  });

  it("输入备注后立即失焦时仍保存最新草稿", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<InlineEquipmentDetailEditor item={item} businessUnits={[{ id: 1, code: "BU1", name: "BU1" }]} factories={[]} suppliers={[]} isAdmin onSave={onSave} />);
    const notes = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: "即时失焦自动保存验证" } });
    fireEvent.blur(notes);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ notes: "即时失焦自动保存验证" })));
    await waitFor(() => expect(container.textContent).toContain("已自动保存"));
  });
});
