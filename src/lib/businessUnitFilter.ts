export type BusinessUnitOption = { id: number; code: string };
export type BusinessUnitEquipment = { businessUnitId: number | null };

export function toggleBusinessUnitSelection(currentCode: string | null, nextCode: string) {
  return currentCode === nextCode ? null : nextCode;
}

export function getSelectedBusinessUnit(units: BusinessUnitOption[], code: string | null) {
  return code ? units.find(unit => unit.code === code) ?? null : null;
}

export function filterEquipmentByBusinessUnit<T extends BusinessUnitEquipment>(equipment: T[], businessUnitId: number | null) {
  return businessUnitId === null ? equipment : equipment.filter(item => item.businessUnitId === businessUnitId);
}
