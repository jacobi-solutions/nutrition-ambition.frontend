export function formatNutrient(amount: number, name?: string): string {
  if (amount == null || isNaN(amount)) return '';
  
  const nutrient = (name || '').toLowerCase();

  const unit = (() => {
    if (['vitamin a', 'vitamin d', 'vitamin k', 'vitamin b12', 'folate'].includes(nutrient)) return 'mcg';
    if ([
      'calcium', 'iron', 'magnesium', 'phosphorus', 'potassium', 'sodium', 'zinc', 'copper',
      'manganese', 'thiamin', 'riboflavin', 'niacin', 'pantothenic acid', 'vitamin b6', 
      'vitamin c', 'vitamin e', 'selenium'
    ].includes(nutrient)) return 'mg';
    return 'mg';
  })();

  const value = unit === 'mcg' ? Math.round(amount * 1000) : Math.round(amount * 10) / 10;
  return `${value} ${unit}`;
} 