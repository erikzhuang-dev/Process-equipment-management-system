export function isValidMaintenanceCycle(value: string) {
  const cycleDays = Number(value);
  return Number.isInteger(cycleDays) && cycleDays > 0;
}
