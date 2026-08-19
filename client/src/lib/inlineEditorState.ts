export type InlineSaveState = "idle" | "saving" | "saved" | "error";

export type InlineEditorSnapshot<T> = {
  equipmentId: number;
  values: T;
  saveState: InlineSaveState;
};

export function reconcileInlineEditorSnapshot<T>(current: InlineEditorSnapshot<T>, nextEquipmentId: number, nextValues: T): InlineEditorSnapshot<T> {
  if (current.equipmentId === nextEquipmentId) return current;
  return { equipmentId: nextEquipmentId, values: nextValues, saveState: "idle" };
}
