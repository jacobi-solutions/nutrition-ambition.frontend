export function formatMacro(label: string, value: number | null | undefined): string {
  if (!value || value === 0) return '—';
  if (label.toLowerCase() === 'calories') {
    return `${value.toFixed(1)} kcal`;
  }
  return `${value.toFixed(1)} g`;
} 