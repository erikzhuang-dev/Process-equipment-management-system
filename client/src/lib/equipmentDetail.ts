export function calculateEquipmentAmounts(input: { quantity: number | null; unitPrice: number | null; lossFactor: number | null; investmentIncluded: boolean | null }) {
  if (input.quantity === null || input.unitPrice === null) return { totalAmount: null, investmentAmount: null };
  const totalAmount = input.quantity * input.unitPrice;
  return { totalAmount, investmentAmount: input.investmentIncluded ? totalAmount : 0 };
}

export function displayOee(value: string | number | null) {
  if (value === null || value === undefined || value === "") return "未录入";
  return `${(Number(value) * 100).toFixed(1)}%`;
}
