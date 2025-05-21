export function formatMacro(label: string, value: number | null | undefined): string {
  // Add debugging for protein formatting
  if (label.toLowerCase() === 'protein') {
    console.log(`[PROTEIN_SCALE_DEBUG] formatMacro called for Protein with value: ${value}`);
  }
  
  if (!value || value === 0) return '—';
  if (label.toLowerCase() === 'calories') {
    return `${value.toFixed(1)} kcal`;
  }
  
  const formatted = `${value.toFixed(1)} g`;
  
  // More debugging for protein
  if (label.toLowerCase() === 'protein') {
    console.log(`[PROTEIN_SCALE_DEBUG] formatMacro protein formatted as: ${formatted}`);
  }
  
  return formatted;
} 