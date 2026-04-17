import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

export default function ListPropertyPage() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [hotelId, setHotelId] = useState(null);

  const [hotelName, setHotelName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [description, setDescription] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityId, setCityId] = useState(null);
  const [cityLabel, setCityLabel] = useState('');

  const [roomType, setRoomType] = useState('');
  const [roomPrice, setRoomPrice] = useState('');
  const [roomTotal, setRoomTotal] = useState('1');
  const [roomsAdded, setRoomsAdded] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCityResults([]);
      return () => {
        cancelled = true;
      };
    }

    setCityLoading(true);
    api
      .get('/cities/', { params: { q } })
      .then((res) => {
        if (cancelled) return;
        setCityResults(asList(res.data).slice(0, 12));
      })
      .catch(() => {
        if (cancelled) return;
        setCityResults([]);
      })
      .finally(() => {
        if (cancelled) return;
        setCityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cityQuery]);

  const createHotel = async (e) => {
    e.preventDefault();

    setErr('');
    setBusy(true);
    try {
      const payload = {
        name: hotelName.trim(),
        address_line: addressLine.trim(),
        description: description.trim(),
        city_id: cityId,
      };
      const { data } = await api.post('/hotels/', payload);
      setHotelId(data.id);
      await refreshMe();
      setStep(2);
    } catch (e) {
      const body = e.response?.data;
      setErr(
        body?.detail
          || (typeof body === 'object' ? JSON.stringify(body) : e.message),
      );
    } finally {
      setBusy(false);
    }
  };

  const addRoom = async (e) => {
    e.preventDefault();
    if (!hotelId) return;
    setErr('');
    setBusy(true);
    try {
      const payload = {
        hotel: hotelId,
        type: roomType.trim(),
        price: roomPrice,
        total_rooms: parseInt(roomTotal, 10),
      };
      const { data } = await api.post('/rooms/', payload);
      setRoomsAdded((rows) => [data, ...rows]);
      setRoomType('');
      setRoomPrice('');
      setRoomTotal('1');
    } catch (e) {
      const body = e.response?.data;
      setErr(
        body?.detail
          || (typeof body === 'object' ? JSON.stringify(body) : e.message),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <h1 className="section__title">List your property</h1>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
        A simple flow: add property details → add room types (pricing and total
        rooms) → start managing bookings in the dashboard.
      </p>
      {err ? <p className="error">{err}</p> : null}

      {step === 1 ? (
        <div className="panel">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Step 1: Property details</h2>
          <form onSubmit={createHotel}>
            <label style={{ display: 'block', marginBottom: '0.65rem' }}>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Property name
              </div>
              <input
                className="search-input"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                placeholder="e.g. Sunrise Residency"
                required
              />
            </label>

            <label style={{ display: 'block', marginBottom: '0.65rem' }}>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Address line (optional)
              </div>
              <input
                className="search-input"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Street / area / landmark"
              />
            </label>

            <label style={{ display: 'block', marginBottom: '0.65rem' }}>
              <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                Description (optional)
              </div>
              <textarea
                className="search-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Short description for guests"
                style={{ resize: 'vertical' }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.65rem' }}>
              <label style={{ display: 'block' }}>
                <div className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  City (search)
                </div>
                <input
                  className="search-input"
                  value={cityQuery}
                  onChange={(e) => {
                    setCityQuery(e.target.value);
                    setCityId(null);
                    setCityLabel('');
                  }}
                  placeholder="Type at least 2 letters…"
                  required={!cityId}
                />
              </label>

              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {cityId ? (
                  <>
                    Selected: <strong>{cityLabel}</strong>
                  </>
                ) : cityLoading ? (
                  'Searching cities…'
                ) : cityQuery.trim().length >= 2 ? (
                  'Pick a city below.'
                ) : (
                  'Start typing to search.'
                )}
              </div>

              {cityId ? null : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  {cityResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="panel"
                      style={{
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: '0.75rem',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                      }}
                      onClick={() => {
                        setCityId(c.id);
                        setCityLabel(
                          c.country?.name ? `${c.name}, ${c.country.name}` : c.name,
                        );
                        setCityQuery(c.name);
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        {c.country?.name ?? ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button type="submit" className="btn-search" disabled={busy || !cityId}>
                {busy ? 'Creating…' : 'Create property'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="panel">
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Step 2: Add room types</h2>
          <p className="muted" style={{ marginTop: '-0.25rem' }}>
            Add at least one room type so guests can book your property.
          </p>

          <form
            onSubmit={addRoom}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
              marginBottom: '1rem',
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>Room label</span>
              <input
                className="search-input"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value)}
                placeholder="e.g. Deluxe"
                required
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>Price (Rs.)</span>
              <input
                className="search-input"
                type="number"
                min="0"
                step="0.01"
                value={roomPrice}
                onChange={(e) => setRoomPrice(e.target.value)}
                required
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Total rooms
              </span>
              <input
                className="search-input"
                type="number"
                min="0"
                step="1"
                value={roomTotal}
                onChange={(e) => setRoomTotal(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn-search" disabled={busy}>
              {busy ? 'Adding…' : 'Add room type'}
            </button>
          </form>

          {roomsAdded.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {roomsAdded.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.75rem 0.9rem',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{r.type}</div>
                  <div className="muted" style={{ fontSize: '0.9rem' }}>
                    Rs. {r.price} · Total rooms: {r.total_rooms}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No room types added yet.</p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button
              type="button"
              className="btn-search"
              onClick={() => navigate('/manager')}
              disabled={!hotelId}
            >
              Go to dashboard
            </button>
            <Link to="/" className="nav-link">
              Back home
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

