export function calculateEquipmentAmounts(input: { quantity: number | null; unitPrice: number | null }) {
  if (input.quantity === null || input.unitPrice === null) return { totalAmount: null };
  return { totalAmount: input.quantity * input.unitPrice };
}

export function displayOee(value: string | number | null) {
  if (value === null || value === undefined || value === "") return "未录入";
  return `${(Number(value) * 100).toFixed(1)}%`;
}
