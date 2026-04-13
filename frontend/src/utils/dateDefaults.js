/** Format a Date as YYYY-MM-DD for <input type="date"> (local calendar). */
export function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD to local Date at midnight (no UTC shift). */
export function parseDateInput(str) {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** e.g. "Fri, 10 Apr" */
export function formatShortWeekdayDayMonth(isoStr) {
  const d = parseDateInput(isoStr);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** e.g. "Fri, 10 Apr — Sat, 11 Apr" */
export function formatDateRangeLabel(checkIn, checkOut) {
  if (!checkIn) return 'Select dates';
  const a = formatShortWeekdayDayMonth(checkIn);
  if (!checkOut) return `${a} — Select checkout`;
  return `${a} — ${formatShortWeekdayDayMonth(checkOut)}`;
}

/** Start of today in local time (for minDate). */
export function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

/** Today and the following day as date-input strings. */
export function defaultCheckInOut() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    checkIn: toDateInputValue(today),
    checkOut: toDateInputValue(tomorrow),
  };
}
