export function localDateValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return localDateValue(date) === value ? date : null;
}

export function withinDateBounds(value: Date, mode: 'date' | 'datetime', minimum?: Date, maximum?: Date): boolean {
  if (!Number.isFinite(value.getTime())) return false;
  const comparable = (date: Date) => mode === 'date'
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    : date.getTime();
  return (!minimum || comparable(value) >= comparable(minimum)) && (!maximum || comparable(value) <= comparable(maximum));
}
