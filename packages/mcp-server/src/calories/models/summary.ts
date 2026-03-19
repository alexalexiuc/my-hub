export function getWeekBounds(dateStr: string): { start: string; end: string } {
  const date = new Date(dateStr + 'T00:00:00Z');
  const day = date.getUTCDay(); // 0=Sun
  const monday = new Date(date);
  // Offset days to previous Monday: (day + 6) % 7 maps Sun→6, Mon→0, Tue→1, …, Sat→5
  monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().split('T')[0]!,
    end: sunday.toISOString().split('T')[0]!,
  };
}

export function sumMeals(
  meals: {
    calories: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  }[],
) {
  return {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein_g: meals.reduce((s, m) => s + (m.protein_g ?? 0), 0),
    carbs_g: meals.reduce((s, m) => s + (m.carbs_g ?? 0), 0),
    fat_g: meals.reduce((s, m) => s + (m.fat_g ?? 0), 0),
  };
}
