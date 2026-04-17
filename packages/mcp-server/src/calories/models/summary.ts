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
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }[],
) {
  return {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    proteinG: meals.reduce((s, m) => s + (m.proteinG ?? 0), 0),
    carbsG: meals.reduce((s, m) => s + (m.carbsG ?? 0), 0),
    fatG: meals.reduce((s, m) => s + (m.fatG ?? 0), 0),
  };
}
