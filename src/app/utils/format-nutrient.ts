export function formatNutrient(valueMg: number | null | undefined): string {
  if (!valueMg || valueMg === 0) return '—';
  return valueMg >= 1000
    ? `${(valueMg / 1000).toFixed(1)} g`
    : `${valueMg.toFixed(1)} mg`;
} 