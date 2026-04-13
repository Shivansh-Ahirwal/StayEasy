/**
 * URL helpers for search + hotel detail stay params (dates, rooms, guests).
 */

/**
 * @param {number} totalGuests
 * @param {number} roomCount
 * @returns {number[]}
 */
export function roomCountsFromUrl(totalGuests, roomCount) {
  let g = Number.isFinite(totalGuests) ? Math.floor(totalGuests) : 1;
  let r = Number.isFinite(roomCount) ? Math.floor(roomCount) : 1;
  r = Math.max(1, Math.min(8, r));
  g = Math.max(r, Math.min(128, g));
  const base = Math.floor(g / r);
  let rem = g % r;
  return Array.from({ length: r }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * @param {URLSearchParams} searchParams
 */
export function parseStaySearchParams(searchParams) {
  const q = searchParams.get('q') || '';
  const checkIn = searchParams.get('in') || '';
  const checkOut = searchParams.get('out') || '';
  const g = parseInt(searchParams.get('g') || '1', 10);
  const r = parseInt(searchParams.get('r') || '1', 10);
  const roomGuestCounts = roomCountsFromUrl(g, r);
  return { q, checkIn, checkOut, roomGuestCounts };
}

/**
 * @param {{ q: string, checkIn: string, checkOut: string, roomGuestCounts: number[] }} p
 * @returns {URLSearchParams}
 */
export function buildStaySearchParams({
  q,
  checkIn,
  checkOut,
  roomGuestCounts,
}) {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set('q', q.trim());
  if (checkIn) params.set('in', checkIn);
  if (checkOut) params.set('out', checkOut);
  const total = roomGuestCounts.reduce((a, b) => a + b, 0);
  if (total > 0) params.set('g', String(total));
  if (roomGuestCounts.length > 1) {
    params.set('r', String(roomGuestCounts.length));
  }
  return params;
}

/**
 * Query string for /hotels/:id links (no location q).
 * @param {string} checkIn
 * @param {string} checkOut
 * @param {number[]} roomGuestCounts
 * @returns {string}
 */
export function stayQueryStringForHotel(checkIn, checkOut, roomGuestCounts) {
  const params = new URLSearchParams();
  if (checkIn) params.set('in', checkIn);
  if (checkOut) params.set('out', checkOut);
  const total = roomGuestCounts.reduce((a, b) => a + b, 0);
  if (total > 0) params.set('g', String(total));
  if (roomGuestCounts.length > 1) {
    params.set('r', String(roomGuestCounts.length));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}
