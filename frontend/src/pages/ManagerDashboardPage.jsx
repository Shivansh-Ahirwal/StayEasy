import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

function formatDt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function ManagerDashboardPage() {
  const [hotels, setHotels] = useState([]);
  const [hotelId, setHotelId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [roomDrafts, setRoomDrafts] = useState({});
  const [hotelImgUrl, setHotelImgUrl] = useState('');
  const [hotelImgCaption, setHotelImgCaption] = useState('');
  const [roomImgUrl, setRoomImgUrl] = useState({});
  const [roomImgCaption, setRoomImgCaption] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const [hotelsLoaded, setHotelsLoaded] = useState(false);

  const loadDetail = useCallback(async (id) => {
    if (!id) return;
    setErr('');
    const { data } = await api.get(`/manager/hotels/${id}/`);
    setDetail(data);
    const drafts = {};
    (data.rooms ?? []).forEach((r) => {
      drafts[r.id] = {
        type: r.type,
        price: String(r.price),
        total_rooms: String(r.total_rooms),
      };
    });
    setRoomDrafts(drafts);
  }, []);

  const loadBookings = useCallback(async (id, status) => {
    if (!id) return;
    setErr('');
    const params = status ? { status } : {};
    const { data } = await api.get(`/manager/hotels/${id}/bookings/`, {
      params,
    });
    setBookings(asList(data));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr('');
        const { data } = await api.get('/manager/hotels/');
        const list = asList(data);
        if (!cancelled) {
          setHotels(list);
          setHotelId((prev) => prev ?? (list[0]?.id ?? null));
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e.response?.data?.detail || e.message);
        }
      } finally {
        if (!cancelled) setHotelsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    loadDetail(hotelId).catch((e) => {
      setErr(e.response?.data?.detail || e.message);
    });
    loadBookings(hotelId, statusFilter).catch((e) => {
      setErr(e.response?.data?.detail || e.message);
    });
  }, [hotelId, statusFilter, loadDetail, loadBookings]);

  const saveRoom = async (roomId) => {
    const d = roomDrafts[roomId];
    if (!d) return;
    setBusy(`room-${roomId}`);
    setErr('');
    try {
      const payload = {
        type: d.type,
        price: d.price,
        total_rooms: parseInt(d.total_rooms, 10),
      };
      await api.patch(`/manager/rooms/${roomId}/`, payload);
      await loadDetail(hotelId);
    } catch (e) {
      const body = e.response?.data;
      setErr(
        body?.detail ||
          (typeof body === 'object'
            ? JSON.stringify(body)
            : e.message),
      );
    } finally {
      setBusy(null);
    }
  };

  const addHotelImage = async (e) => {
    e.preventDefault();
    if (!hotelImgUrl.trim() || !hotelId) return;
    setBusy('hotel-img');
    setErr('');
    try {
      await api.post(`/manager/hotels/${hotelId}/images/`, {
        url: hotelImgUrl.trim(),
        caption: hotelImgCaption.trim() || '',
        sort_order: 0,
      });
      setHotelImgUrl('');
      setHotelImgCaption('');
      await loadDetail(hotelId);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  const removeHotelImage = async (imageId) => {
    if (!hotelId) return;
    setBusy(`hdel-${imageId}`);
    setErr('');
    try {
      await api.delete(`/manager/hotels/${hotelId}/images/${imageId}/`);
      await loadDetail(hotelId);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  const addRoomImage = async (e, roomId) => {
    e.preventDefault();
    const url = (roomImgUrl[roomId] || '').trim();
    if (!url) return;
    setBusy(`rimg-${roomId}`);
    setErr('');
    try {
      await api.post(`/manager/rooms/${roomId}/images/`, {
        url,
        caption: (roomImgCaption[roomId] || '').trim() || '',
        sort_order: 0,
      });
      setRoomImgUrl((m) => ({ ...m, [roomId]: '' }));
      setRoomImgCaption((m) => ({ ...m, [roomId]: '' }));
      await loadDetail(hotelId);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  const removeRoomImage = async (roomId, imageId) => {
    setBusy(`rdel-${imageId}`);
    setErr('');
    try {
      await api.delete(`/manager/rooms/${roomId}/images/${imageId}/`);
      await loadDetail(hotelId);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  const checkIn = async (bookingId) => {
    setBusy(`in-${bookingId}`);
    setErr('');
    try {
      await api.post(`/manager/bookings/${bookingId}/check-in/`);
      await loadBookings(hotelId, statusFilter);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  const checkOut = async (bookingId) => {
    setBusy(`out-${bookingId}`);
    setErr('');
    try {
      await api.post(`/manager/bookings/${bookingId}/check-out/`);
      await loadBookings(hotelId, statusFilter);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!hotelsLoaded) {
    return (
      <section className="section">
        <h1 className="section__title">Property dashboard</h1>
        <p className="muted">Loading your properties…</p>
      </section>
    );
  }

  if (hotels.length === 0) {
    return (
      <section className="section">
        <h1 className="section__title">Property dashboard</h1>
        <p className="muted">
          You are not assigned as manager to any hotel yet. Contact an
          administrator to link your account to a property.
        </p>
        {err ? <p className="error">{err}</p> : null}
        <Link to="/" className="btn-search" style={{ display: 'inline-block' }}>
          Back home
        </Link>
      </section>
    );
  }

  return (
    <section className="section">
      <h1 className="section__title">Property dashboard</h1>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
        Manage bookings, room rates, inventory, photos, and guest check-in for
        properties you operate.
      </p>
      {err ? <p className="error" style={{ marginBottom: '1rem' }}>{err}</p> : null}

      <div className="panel" style={{ marginBottom: '1.25rem' }}>
        <label className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
          Property
        </label>
        <select
          className="search-input"
          style={{ maxWidth: '28rem', width: '100%' }}
          value={hotelId ?? ''}
          onChange={(e) => setHotelId(Number(e.target.value))}
        >
          {hotels.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
              {h.city_name ? ` · ${h.city_name}` : ''}
            </option>
          ))}
        </select>
        {detail ? (
          <p className="muted" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            {detail.location}
          </p>
        ) : null}
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Bookings</h2>
      <div className="panel" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Status
            <select
              className="search-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        {bookings.length === 0 ? (
          <p className="muted">No bookings for this filter.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bookings.map((b) => (
              <div
                key={b.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>#{b.id} · {b.guest_name}</div>
                    <div className="muted" style={{ fontSize: '0.9rem' }}>
                      {b.guest_email}
                    </div>
                    <div style={{ marginTop: '0.35rem' }}>
                      {b.room_type}
                      <span className="muted"> · {b.check_in} → {b.check_out}</span>
                    </div>
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      Check-in: {formatDt(b.checked_in_at)} · Check-out:{' '}
                      {formatDt(b.checked_out_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background:
                          b.status === 'confirmed'
                            ? '#e8f5e9'
                            : b.status === 'pending'
                              ? '#fff8e1'
                              : '#ffebee',
                        color:
                          b.status === 'confirmed'
                            ? '#2e7d32'
                            : b.status === 'pending'
                              ? '#f57f17'
                              : '#c62828',
                      }}
                    >
                      {b.status}
                    </span>
                    <div style={{ fontWeight: 700, marginTop: '0.35rem' }}>
                      Rs. {b.total_price}
                    </div>
                    {b.status === 'confirmed' ? (
                      <div
                        style={{
                          display: 'flex',
                          gap: '0.5rem',
                          marginTop: '0.65rem',
                          justifyContent: 'flex-end',
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          type="button"
                          className="btn-search"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                          disabled={Boolean(b.checked_in_at) || busy === `in-${b.id}`}
                          onClick={() => checkIn(b.id)}
                        >
                          {busy === `in-${b.id}` ? '…' : 'Check in'}
                        </button>
                        <button
                          type="button"
                          className="btn-search"
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.65rem',
                            opacity: b.checked_out_at ? 0.5 : 1,
                          }}
                          disabled={
                            !b.checked_in_at ||
                            Boolean(b.checked_out_at) ||
                            busy === `out-${b.id}`
                          }
                          onClick={() => checkOut(b.id)}
                        >
                          {busy === `out-${b.id}` ? '…' : 'Check out'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>
        Rooms, pricing & availability
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {(detail?.rooms ?? []).map((r) => {
          const d = roomDrafts[r.id] || {
            type: r.type,
            price: String(r.price),
            total_rooms: String(r.total_rooms),
          };
          return (
            <div key={r.id} className="panel">
              <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
                Room type #{r.id}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))',
                  gap: '0.75rem',
                  alignItems: 'end',
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Label</span>
                  <input
                    className="search-input"
                    value={d.type}
                    onChange={(e) =>
                      setRoomDrafts((m) => ({
                        ...m,
                        [r.id]: { ...d, type: e.target.value },
                      }))
                    }
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>Price (Rs.)</span>
                  <input
                    className="search-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.price}
                    onChange={(e) =>
                      setRoomDrafts((m) => ({
                        ...m,
                        [r.id]: { ...d, price: e.target.value },
                      }))
                    }
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Total rooms
                  </span>
                  <input
                    className="search-input"
                    type="number"
                    min="0"
                    step="1"
                    value={d.total_rooms}
                    onChange={(e) =>
                      setRoomDrafts((m) => ({
                        ...m,
                        [r.id]: { ...d, total_rooms: e.target.value },
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn-search"
                  style={{ height: 'fit-content' }}
                  disabled={busy === `room-${r.id}`}
                  onClick={() => saveRoom(r.id)}
                >
                  {busy === `room-${r.id}` ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: '1.15rem', margin: '1.5rem 0 0.75rem' }}>
        Property photos
      </h2>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <form
          onSubmit={addHotelImage}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.65rem',
            alignItems: 'flex-end',
            marginBottom: '1rem',
          }}
        >
          <label style={{ flex: '1 1 14rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Image URL</span>
            <input
              className="search-input"
              value={hotelImgUrl}
              onChange={(e) => setHotelImgUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label style={{ flex: '1 1 10rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Caption (optional)</span>
            <input
              className="search-input"
              value={hotelImgCaption}
              onChange={(e) => setHotelImgCaption(e.target.value)}
            />
          </label>
          <button
            type="submit"
            className="btn-search"
            disabled={busy === 'hotel-img'}
          >
            {busy === 'hotel-img' ? 'Adding…' : 'Add photo'}
          </button>
        </form>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))',
            gap: '0.65rem',
          }}
        >
          {(detail?.images ?? []).map((img) => (
            <div key={img.id} style={{ position: 'relative' }}>
              <img
                src={img.url}
                alt={img.caption || ''}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  objectFit: 'cover',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              />
              <button
                type="button"
                className="nav-link"
                style={{
                  marginTop: '0.35rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  color: '#c62828',
                  padding: 0,
                }}
                disabled={busy === `hdel-${img.id}`}
                onClick={() => removeHotelImage(img.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: '1.15rem', marginBottom: '0.75rem' }}>Room photos</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {(detail?.rooms ?? []).map((r) => (
          <div key={r.id} className="panel">
            <div style={{ fontWeight: 600, marginBottom: '0.65rem' }}>{r.type}</div>
            <form
              onSubmit={(e) => addRoomImage(e, r.id)}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.65rem',
                alignItems: 'flex-end',
                marginBottom: '0.85rem',
              }}
            >
              <label style={{ flex: '1 1 14rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="muted" style={{ fontSize: '0.8rem' }}>Image URL</span>
                <input
                  className="search-input"
                  value={roomImgUrl[r.id] || ''}
                  onChange={(e) =>
                    setRoomImgUrl((m) => ({ ...m, [r.id]: e.target.value }))
                  }
                  placeholder="https://…"
                />
              </label>
              <label style={{ flex: '1 1 10rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="muted" style={{ fontSize: '0.8rem' }}>Caption</span>
                <input
                  className="search-input"
                  value={roomImgCaption[r.id] || ''}
                  onChange={(e) =>
                    setRoomImgCaption((m) => ({ ...m, [r.id]: e.target.value }))
                  }
                />
              </label>
              <button
                type="submit"
                className="btn-search"
                disabled={busy === `rimg-${r.id}`}
              >
                {busy === `rimg-${r.id}` ? 'Adding…' : 'Add'}
              </button>
            </form>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(6rem, 1fr))',
                gap: '0.5rem',
              }}
            >
              {(r.images ?? []).map((img) => (
                <div key={img.id}>
                  <img
                    src={img.url}
                    alt={img.caption || ''}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <button
                    type="button"
                    className="nav-link"
                    style={{
                      marginTop: '0.25rem',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none',
                      color: '#c62828',
                      padding: 0,
                    }}
                    disabled={busy === `rdel-${img.id}`}
                    onClick={() => removeRoomImage(r.id, img.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
