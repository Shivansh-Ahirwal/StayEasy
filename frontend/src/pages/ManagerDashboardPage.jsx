import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

/* ── helpers ── */
function asList(d) { return Array.isArray(d) ? d : d?.results ?? []; }

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatDt(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtPrice(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

const STATUS_META = {
  confirmed:  { label: 'Confirmed',  bg: '#e8f5e9', color: '#2e7d32' },
  pending:    { label: 'Pending',    bg: '#fff8e1', color: '#f57f17' },
  cancelled:  { label: 'Cancelled', bg: '#ffebee', color: '#c62828' },
  checked_in: { label: 'Checked in', bg: '#e3f2fd', color: '#1565c0' },
  completed:  { label: 'Completed', bg: '#f3e5f5', color: '#6a1b9a' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] ?? { label: status, bg: '#f5f5f5', color: '#555' };
  return (
    <span className="mgr-badge" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function FieldInput({ label, ...props }) {
  return (
    <label className="mgr-field">
      <span className="mgr-field__label">{label}</span>
      <input className="mgr-field__input" {...props} />
    </label>
  );
}

/* ── main component ── */
export default function ManagerDashboardPage() {
  /* hotel list (loaded once) */
  const [hotels, setHotels]           = useState([]);
  const [hotelId, setHotelId]         = useState(null);
  const [hotelsLoaded, setHotelsLoaded] = useState(false);

  /* bookings (reload on hotel or filter change) */
  const [bookings, setBookings]         = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  /* detail: rooms + images — lazy, loaded only when rooms/photos tab is opened */
  const [detail, setDetail]           = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailHotelRef                = useRef(null); // which hotel's detail we have

  /* per-tab form state */
  const [roomDrafts, setRoomDrafts]   = useState({});
  const [newRoomType, setNewRoomType] = useState('');
  const [newRoomPrice, setNewRoomPrice] = useState('');
  const [newRoomTotal, setNewRoomTotal] = useState('1');
  const [hotelImgUrl, setHotelImgUrl] = useState('');
  const [hotelImgCaption, setHotelImgCaption] = useState('');
  const [roomImgUrl, setRoomImgUrl]   = useState({});
  const [roomImgCaption, setRoomImgCaption] = useState({});

  const [tab, setTab]   = useState('bookings');
  const [err, setErr]   = useState('');
  const [busy, setBusy] = useState(null);

  /* ── 1. Load hotel list once ── */
  useEffect(() => {
    let cancelled = false;
    api.get('/manager/hotels/')
      .then(({ data }) => {
        if (cancelled) return;
        const list = asList(data);
        setHotels(list);
        setHotelId(list[0]?.id ?? null);
      })
      .catch((e) => { if (!cancelled) setErr(e.response?.data?.detail || e.message); })
      .finally(() => { if (!cancelled) setHotelsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  /* ── 2. Load bookings whenever hotel or filter changes ── */
  useEffect(() => {
    if (!hotelId) return;
    let cancelled = false;
    setBookingsLoading(true);
    const params = statusFilter ? { status: statusFilter } : {};
    api.get(`/manager/hotels/${hotelId}/bookings/`, { params })
      .then(({ data }) => { if (!cancelled) setBookings(asList(data)); })
      .catch((e) => { if (!cancelled) setErr(e.response?.data?.detail || e.message); })
      .finally(() => { if (!cancelled) setBookingsLoading(false); });
    return () => { cancelled = true; };
  }, [hotelId, statusFilter]);

  /* ── 3. When hotel changes clear stale detail ── */
  useEffect(() => {
    if (detailHotelRef.current !== hotelId) {
      setDetail(null);
      detailHotelRef.current = null;
      setRoomDrafts({});
    }
  }, [hotelId]);

  /* ── 4. Load detail lazily when rooms or photos tab is opened ── */
  const loadDetail = useCallback(async (id) => {
    if (!id || detailHotelRef.current === id) return; // already have it
    setDetailLoading(true);
    try {
      const { data } = await api.get(`/manager/hotels/${id}/`);
      const drafts = {};
      (data.rooms ?? []).forEach((r) => {
        drafts[r.id] = { type: r.type, price: String(r.price), total_rooms: String(r.total_rooms) };
      });
      setDetail(data);
      setRoomDrafts(drafts);
      detailHotelRef.current = id;
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((tab === 'rooms' || tab === 'photos') && hotelId) {
      loadDetail(hotelId);
    }
  }, [tab, hotelId, loadDetail]);

  /* ── actions ── */
  const refreshDetail = () => {
    detailHotelRef.current = null; // force reload
    loadDetail(hotelId);
  };

  const saveRoom = async (roomId) => {
    const d = roomDrafts[roomId]; if (!d) return;
    setBusy(`room-${roomId}`); setErr('');
    try {
      await api.patch(`/manager/rooms/${roomId}/`, {
        type: d.type, price: d.price, total_rooms: parseInt(d.total_rooms, 10),
      });
      refreshDetail();
    } catch (e) {
      const b = e.response?.data;
      setErr(b?.detail || (typeof b === 'object' ? JSON.stringify(b) : e.message));
    } finally { setBusy(null); }
  };

  const createRoom = async (e) => {
    e.preventDefault(); if (!hotelId) return;
    setBusy('new-room'); setErr('');
    try {
      await api.post('/rooms/', { hotel: hotelId, type: newRoomType.trim(), price: newRoomPrice, total_rooms: parseInt(newRoomTotal, 10) });
      setNewRoomType(''); setNewRoomPrice(''); setNewRoomTotal('1');
      refreshDetail();
    } catch (e) {
      const b = e.response?.data;
      setErr(b?.detail || (typeof b === 'object' ? JSON.stringify(b) : e.message));
    } finally { setBusy(null); }
  };

  const addHotelImage = async (e) => {
    e.preventDefault(); if (!hotelImgUrl.trim() || !hotelId) return;
    setBusy('hotel-img'); setErr('');
    try {
      await api.post(`/manager/hotels/${hotelId}/images/`, { url: hotelImgUrl.trim(), caption: hotelImgCaption.trim() || '', sort_order: 0 });
      setHotelImgUrl(''); setHotelImgCaption('');
      refreshDetail();
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  const removeHotelImage = async (imageId) => {
    setBusy(`hdel-${imageId}`); setErr('');
    try {
      await api.delete(`/manager/hotels/${hotelId}/images/${imageId}/`);
      refreshDetail();
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  const addRoomImage = async (e, roomId) => {
    e.preventDefault();
    const url = (roomImgUrl[roomId] || '').trim(); if (!url) return;
    setBusy(`rimg-${roomId}`); setErr('');
    try {
      await api.post(`/manager/rooms/${roomId}/images/`, { url, caption: (roomImgCaption[roomId] || '').trim() || '', sort_order: 0 });
      setRoomImgUrl((m) => ({ ...m, [roomId]: '' }));
      setRoomImgCaption((m) => ({ ...m, [roomId]: '' }));
      refreshDetail();
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  const removeRoomImage = async (roomId, imageId) => {
    setBusy(`rdel-${imageId}`); setErr('');
    try {
      await api.delete(`/manager/rooms/${roomId}/images/${imageId}/`);
      refreshDetail();
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  const checkIn = async (bookingId) => {
    setBusy(`in-${bookingId}`); setErr('');
    try {
      await api.post(`/manager/bookings/${bookingId}/check-in/`);
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get(`/manager/hotels/${hotelId}/bookings/`, { params });
      setBookings(asList(data));
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  const checkOut = async (bookingId) => {
    setBusy(`out-${bookingId}`); setErr('');
    try {
      await api.post(`/manager/bookings/${bookingId}/check-out/`);
      const params = statusFilter ? { status: statusFilter } : {};
      const { data } = await api.get(`/manager/hotels/${hotelId}/bookings/`, { params });
      setBookings(asList(data));
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setBusy(null); }
  };

  /* ── derived stats (bookings only, no full detail needed) ── */
  const stats = {
    total:     bookings.length,
    pending:   bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    revenue:   bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((s, b) => s + Number(b.total_price || 0), 0),
    roomTypes: detail?.rooms?.length ?? '—',
  };

  /* ── loading / empty states ── */
  if (!hotelsLoaded) {
    return (
      <div className="mgr-page">
        <div className="mgr-shimmer" style={{ height: 60, borderRadius: 12, marginBottom: '1rem' }} />
        <div className="mgr-shimmer" style={{ height: 120, borderRadius: 12, marginBottom: '1rem' }} />
        <div className="mgr-shimmer" style={{ height: 300, borderRadius: 12 }} />
      </div>
    );
  }

  if (hotels.length === 0) {
    return (
      <div className="mgr-page">
        <div className="mgr-empty">
          <div className="mgr-empty__icon">🏨</div>
          <h2 className="mgr-empty__title">No properties yet</h2>
          <p className="mgr-empty__sub">You are not assigned as manager to any hotel.</p>
          {err && <p className="error">{err}</p>}
          <Link to="/" className="mgr-btn mgr-btn--primary">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mgr-page">

      {/* ── Top bar ── */}
      <div className="mgr-topbar">
        <div className="mgr-topbar__left">
          <h1 className="mgr-topbar__title">Property Dashboard</h1>
          {detail && <p className="mgr-topbar__address">{detail.location}</p>}
        </div>
        <div className="mgr-topbar__right">
          <select
            className="mgr-property-select"
            value={hotelId ?? ''}
            onChange={(e) => { setHotelId(Number(e.target.value)); setErr(''); }}
          >
            {hotels.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}{h.city_name ? ` · ${h.city_name}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {err && <div className="mgr-alert">{err}</div>}

      {/* ── Stats strip ── */}
      <div className="mgr-stats">
        {[
          { val: stats.total,                           label: 'Total bookings' },
          { val: stats.pending,   color: '#f57f17',     label: 'Pending' },
          { val: stats.confirmed, color: '#2e7d32',     label: 'Confirmed' },
          { val: `₹${fmtPrice(stats.revenue)}`, color: 'var(--oyo-red)', label: 'Revenue' },
          { val: stats.roomTypes,                       label: 'Room types' },
        ].map(({ val, label, color }) => (
          <div key={label} className="mgr-stat">
            <span className="mgr-stat__val" style={color ? { color } : {}}>{val}</span>
            <span className="mgr-stat__label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="mgr-tabs">
        {[
          { id: 'bookings', label: '📋 Bookings' },
          { id: 'rooms',    label: '🛏 Rooms & Pricing' },
          { id: 'photos',   label: '🖼 Photos' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mgr-tab${tab === t.id ? ' mgr-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ BOOKINGS TAB ══════════ */}
      {tab === 'bookings' && (
        <div className="mgr-tab-body">
          <div className="mgr-filter-pills">
            {['', 'pending', 'confirmed', 'cancelled'].map((s) => (
              <button
                key={s}
                type="button"
                className={`mgr-pill${statusFilter === s ? ' mgr-pill--active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {bookingsLoading ? (
            <div className="mgr-shimmer" style={{ height: 220, borderRadius: 12 }} />
          ) : bookings.length === 0 ? (
            <div className="mgr-empty-state">No bookings match this filter.</div>
          ) : (
            <div className="mgr-booking-list">
              {bookings.map((b) => (
                <div key={b.id} className="mgr-booking-card">
                  <div className="mgr-booking-card__left">
                    <div className="mgr-booking-card__avatar">
                      {(b.guest_name?.[0] ?? 'G').toUpperCase()}
                    </div>
                    <div>
                      <div className="mgr-booking-card__guest">{b.guest_name}</div>
                      <div className="mgr-booking-card__email">{b.guest_email}</div>
                    </div>
                  </div>

                  <div className="mgr-booking-card__meta">
                    <div className="mgr-booking-card__room">{b.room_type}</div>
                    <div className="mgr-booking-card__dates">
                      {formatDate(b.check_in)} → {formatDate(b.check_out)}
                    </div>
                    {formatDt(b.checked_in_at) && (
                      <div className="mgr-booking-card__ts">Checked in: {formatDt(b.checked_in_at)}</div>
                    )}
                    {formatDt(b.checked_out_at) && (
                      <div className="mgr-booking-card__ts">Checked out: {formatDt(b.checked_out_at)}</div>
                    )}
                  </div>

                  <div className="mgr-booking-card__right">
                    <StatusBadge status={b.status} />
                    <div className="mgr-booking-card__price">₹{fmtPrice(b.total_price)}</div>
                    {b.status === 'confirmed' && (
                      <div className="mgr-booking-card__actions">
                        <button
                          type="button"
                          className="mgr-btn mgr-btn--sm mgr-btn--outline"
                          disabled={Boolean(b.checked_in_at) || busy === `in-${b.id}`}
                          onClick={() => checkIn(b.id)}
                        >
                          {busy === `in-${b.id}` ? '…' : 'Check in'}
                        </button>
                        <button
                          type="button"
                          className="mgr-btn mgr-btn--sm mgr-btn--primary"
                          disabled={!b.checked_in_at || Boolean(b.checked_out_at) || busy === `out-${b.id}`}
                          onClick={() => checkOut(b.id)}
                        >
                          {busy === `out-${b.id}` ? '…' : 'Check out'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ ROOMS TAB ══════════ */}
      {tab === 'rooms' && (
        <div className="mgr-tab-body">
          {detailLoading ? (
            <div className="mgr-shimmer" style={{ height: 260, borderRadius: 12 }} />
          ) : (
            <>
              <div className="mgr-card">
                <div className="mgr-card__head">
                  <span className="mgr-card__head-icon">➕</span>
                  Add room type
                </div>
                <form className="mgr-form-grid" onSubmit={createRoom}>
                  <FieldInput
                    label="Room label"
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value)}
                    placeholder="e.g. Deluxe Double"
                    required
                  />
                  <FieldInput
                    label="Price (₹ / night)"
                    type="number" min="0" step="0.01"
                    value={newRoomPrice}
                    onChange={(e) => setNewRoomPrice(e.target.value)}
                    required
                  />
                  <FieldInput
                    label="Total units"
                    type="number" min="1" step="1"
                    value={newRoomTotal}
                    onChange={(e) => setNewRoomTotal(e.target.value)}
                    required
                  />
                  <button type="submit" className="mgr-btn mgr-btn--primary mgr-btn--form" disabled={busy === 'new-room'}>
                    {busy === 'new-room' ? 'Adding…' : 'Add room'}
                  </button>
                </form>
              </div>

              {(detail?.rooms ?? []).length === 0 ? (
                <div className="mgr-empty-state">No room types added yet.</div>
              ) : (
                <div className="mgr-rooms-grid">
                  {(detail?.rooms ?? []).map((r) => {
                    const d = roomDrafts[r.id] ?? { type: r.type, price: String(r.price), total_rooms: String(r.total_rooms) };
                    return (
                      <div key={r.id} className="mgr-room-card">
                        <div className="mgr-room-card__thumb">
                          <img src={`https://picsum.photos/seed/yoyorm${hotelId}${r.id}/280/160`} alt={r.type} loading="lazy" />
                          <span className="mgr-room-card__id">#{r.id}</span>
                        </div>
                        <div className="mgr-room-card__body">
                          <div className="mgr-form-grid mgr-form-grid--3">
                            <FieldInput
                              label="Label"
                              value={d.type}
                              onChange={(e) => setRoomDrafts((m) => ({ ...m, [r.id]: { ...d, type: e.target.value } }))}
                            />
                            <FieldInput
                              label="Price (₹)"
                              type="number" min="0" step="0.01"
                              value={d.price}
                              onChange={(e) => setRoomDrafts((m) => ({ ...m, [r.id]: { ...d, price: e.target.value } }))}
                            />
                            <FieldInput
                              label="Units"
                              type="number" min="0" step="1"
                              value={d.total_rooms}
                              onChange={(e) => setRoomDrafts((m) => ({ ...m, [r.id]: { ...d, total_rooms: e.target.value } }))}
                            />
                          </div>
                          <button
                            type="button"
                            className="mgr-btn mgr-btn--primary mgr-btn--sm"
                            disabled={busy === `room-${r.id}`}
                            onClick={() => saveRoom(r.id)}
                          >
                            {busy === `room-${r.id}` ? 'Saving…' : 'Save changes'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════ PHOTOS TAB ══════════ */}
      {tab === 'photos' && (
        <div className="mgr-tab-body">
          {detailLoading ? (
            <div className="mgr-shimmer" style={{ height: 260, borderRadius: 12 }} />
          ) : (
            <>
              <div className="mgr-card">
                <div className="mgr-card__head">
                  <span className="mgr-card__head-icon">🏨</span>
                  Property photos
                </div>
                <form className="mgr-img-form" onSubmit={addHotelImage}>
                  <FieldInput
                    label="Image URL"
                    value={hotelImgUrl}
                    onChange={(e) => setHotelImgUrl(e.target.value)}
                    placeholder="https://…"
                  />
                  <FieldInput
                    label="Caption (optional)"
                    value={hotelImgCaption}
                    onChange={(e) => setHotelImgCaption(e.target.value)}
                  />
                  <button type="submit" className="mgr-btn mgr-btn--primary mgr-btn--form" disabled={busy === 'hotel-img'}>
                    {busy === 'hotel-img' ? 'Adding…' : 'Add photo'}
                  </button>
                </form>
                {(detail?.images ?? []).length === 0 ? (
                  <p className="mgr-empty-state">No photos added yet.</p>
                ) : (
                  <div className="mgr-photo-grid">
                    {(detail?.images ?? []).map((img) => (
                      <div key={img.id} className="mgr-photo-card">
                        <img src={img.url} alt={img.caption || ''} loading="lazy" />
                        {img.caption && <div className="mgr-photo-card__caption">{img.caption}</div>}
                        <button
                          type="button"
                          className="mgr-photo-card__del"
                          disabled={busy === `hdel-${img.id}`}
                          onClick={() => removeHotelImage(img.id)}
                        >
                          {busy === `hdel-${img.id}` ? '…' : '✕'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(detail?.rooms ?? []).map((r) => (
                <div key={r.id} className="mgr-card">
                  <div className="mgr-card__head">
                    <span className="mgr-card__head-icon">🛏</span>
                    {r.type} — photos
                  </div>
                  <form className="mgr-img-form" onSubmit={(e) => addRoomImage(e, r.id)}>
                    <FieldInput
                      label="Image URL"
                      value={roomImgUrl[r.id] || ''}
                      onChange={(e) => setRoomImgUrl((m) => ({ ...m, [r.id]: e.target.value }))}
                      placeholder="https://…"
                    />
                    <FieldInput
                      label="Caption (optional)"
                      value={roomImgCaption[r.id] || ''}
                      onChange={(e) => setRoomImgCaption((m) => ({ ...m, [r.id]: e.target.value }))}
                    />
                    <button type="submit" className="mgr-btn mgr-btn--primary mgr-btn--form" disabled={busy === `rimg-${r.id}`}>
                      {busy === `rimg-${r.id}` ? 'Adding…' : 'Add photo'}
                    </button>
                  </form>
                  {(r.images ?? []).length === 0 ? (
                    <p className="mgr-empty-state">No photos for this room yet.</p>
                  ) : (
                    <div className="mgr-photo-grid">
                      {(r.images ?? []).map((img) => (
                        <div key={img.id} className="mgr-photo-card">
                          <img src={img.url} alt={img.caption || ''} loading="lazy" />
                          {img.caption && <div className="mgr-photo-card__caption">{img.caption}</div>}
                          <button
                            type="button"
                            className="mgr-photo-card__del"
                            disabled={busy === `rdel-${img.id}`}
                            onClick={() => removeRoomImage(r.id, img.id)}
                          >
                            {busy === `rdel-${img.id}` ? '…' : '✕'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

    </div>
  );
}
