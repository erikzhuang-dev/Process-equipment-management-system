export type MaintenanceCompletionDraft = {
  workOrderId: number;
  executor: string;
  maintenanceContent: string;
  notes: string;
};

export function createMaintenanceCompletionDraft(workOrderId: number, maintenanceContent: string): MaintenanceCompletionDraft {
  return { workOrderId, executor: "", maintenanceContent, notes: "" };
}

export function canSubmitMaintenanceCompletion(draft: MaintenanceCompletionDraft | null) {
  return Boolean(draft?.executor.trim() && draft.maintenanceContent.trim());
}
