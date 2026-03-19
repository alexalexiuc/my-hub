export function today(): string {
  return new Date().toISOString().split('T')[0]!;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0]!;
}
