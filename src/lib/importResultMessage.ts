export type ImportResultKind = "equipment" | "maintenance" | "repair";

const labels = {
  zh: {
    equipment: "设备台账",
    maintenance: "保养记录",
    repair: "维修记录",
  },
  en: {
    equipment: "equipment records",
    maintenance: "maintenance records",
    repair: "repair records",
  },
} as const;

export function importResultMessage(kind: ImportResultKind, processed: number, language: "zh" | "en"): string {
  if (language === "en") {
    return `Imported ${processed} ${labels.en[kind]}`;
  }
  return `已导入 ${processed} 条${labels.zh[kind]}`;
}
