import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

const STEPS = [
  { n: 1, label: 'Property details' },
  { n: 2, label: 'Room types' },
  { n: 3, label: 'Go live' },
];

const BENEFITS = [
  {
    icon: '🏨',
    title: 'Zero listing fee',
    body: 'List for free. We only earn when you do.',
  },
  {
    icon: '📅',
    title: 'Smart booking calendar',
    body: 'Automatic availability tracking — no double-bookings, ever.',
  },
  {
    icon: '💳',
    title: 'Instant payments',
    body: 'Razorpay-backed payments settle directly to your account.',
  },
  {
    icon: '📊',
    title: 'Manager dashboard',
    body: 'Check guests in/out, manage rooms, and track revenue in one place.',
  },
];

export default function ListPropertyPage() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();

  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [hotelId, setHotelId] = useState(null);

  // Step 1 — property fields
  const [hotelName, setHotelName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [description, setDescription] = useState('');

  // City autocomplete
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityId, setCityId] = useState(null);
  const [cityLabel, setCityLabel] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const cityRef = useRef(null);

  // Step 2 — room fields
  const [roomType, setRoomType] = useState('');
  const [roomPrice, setRoomPrice] = useState('');
  const [roomTotal, setRoomTotal] = useState('1');
  const [roomsAdded, setRoomsAdded] = useState([]);

  // Close city dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (cityRef.current && !cityRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced city search
  useEffect(() => {
    let cancelled = false;
    const q = cityQuery.trim();

    if (cityId || q.length < 2) {
      setCityResults([]);
      setShowDropdown(false);
      return () => { cancelled = true; };
    }

    const timer = setTimeout(() => {
      setCityLoading(true);
      api
        .get('/cities/', { params: { q } })
        .then((res) => {
          if (cancelled) return;
          const results = asList(res.data).slice(0, 8);
          setCityResults(results);
          setShowDropdown(results.length > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setCityResults([]);
          setShowDropdown(false);
        })
        .finally(() => {
          if (!cancelled) setCityLoading(false);
        });
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityQuery, cityId]);

  const selectCity = (c) => {
    const label = c.country?.name ? `${c.name}, ${c.country.name}` : c.name;
    setCityId(c.id);
    setCityLabel(label);
    setCityQuery(label);
    setShowDropdown(false);
    setCityResults([]);
  };

  const clearCity = () => {
    setCityId(null);
    setCityLabel('');
    setCityQuery('');
    setCityResults([]);
    setShowDropdown(false);
  };

  const createHotel = async (e) => {
    e.preventDefault();
    if (!cityId) {
      setErr('Please select a city from the dropdown.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const { data } = await api.post('/hotels/', {
        name: hotelName.trim(),
        address_line: addressLine.trim(),
        description: description.trim(),
        city_id: cityId,
      });
      setHotelId(data.id);
      await refreshMe();
      setStep(2);
    } catch (ex) {
      const body = ex.response?.data;
      setErr(
        body?.detail ||
        (typeof body === 'object' ? JSON.stringify(body) : ex.message),
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
      const { data } = await api.post('/rooms/', {
        hotel: hotelId,
        type: roomType.trim(),
        price: roomPrice,
        total_rooms: parseInt(roomTotal, 10),
      });
      setRoomsAdded((prev) => [...prev, data]);
      setRoomType('');
      setRoomPrice('');
      setRoomTotal('1');
    } catch (ex) {
      const body = ex.response?.data;
      setErr(
        body?.detail ||
        (typeof body === 'object' ? JSON.stringify(body) : ex.message),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lp-page">

      {/* Hero */}
      <div className="lp-hero">
        <div className="lp-hero__inner">
          <div className="lp-hero__eyebrow">Partner with STAYEazy</div>
          <h1 className="lp-hero__title">
            List your property,<br />start earning today
          </h1>
          <p className="lp-hero__sub">
            Join thousands of hosts. Set up in minutes — no listing fee, no commitment.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="lp-body">
        <div className="lp-body__inner">

          {/* Left: form */}
          <div className="lp-form-col">

            {/* Step indicator */}
            <div className="lp-steps">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.n}>
                  <div
                    className={[
                      'lp-step',
                      step === s.n ? 'lp-step--active' : '',
                      step > s.n ? 'lp-step--done' : '',
                    ].join(' ')}
                  >
                    <div className="lp-step__dot">
                      {step > s.n ? '✓' : s.n}
                    </div>
                    <span className="lp-step__label">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`lp-step__line ${step > s.n ? 'lp-step__line--done' : ''}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Error banner */}
            {err && (
              <div className="lp-alert lp-alert--error" role="alert">
                <span className="lp-alert__icon">⚠</span>
                <span>{err}</span>
              </div>
            )}

            {/* ── Step 1: Property details ── */}
            {step === 1 && (
              <div className="panel">
                <div className="lp-panel-head">
                  <h2 className="lp-panel-head__title">Property details</h2>
                  <p className="lp-panel-head__sub">
                    Tell guests about your property — name, location, and a brief description.
                  </p>
                </div>

                <form onSubmit={createHotel} noValidate>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-hotel-name">
                      Property name <span className="lp-required">*</span>
                    </label>
                    <input
                      id="lp-hotel-name"
                      className="lp-input"
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      placeholder="e.g. Sunrise Residency"
                      required
                      autoComplete="off"
                    />
                  </div>

                  {/* City autocomplete */}
                  <div className="lp-field" ref={cityRef}>
                    <label className="lp-label" htmlFor="lp-city">
                      City <span className="lp-required">*</span>
                    </label>
                    <div className="lp-city-wrap">
                      <input
                        id="lp-city"
                        className={`lp-input${cityId ? ' lp-input--locked' : ''}`}
                        value={cityQuery}
                        onChange={(e) => {
                          if (cityId) clearCity();
                          setCityQuery(e.target.value);
                        }}
                        onFocus={() => {
                          if (!cityId && cityQuery.trim().length >= 2 && cityResults.length > 0) {
                            setShowDropdown(true);
                          }
                        }}
                        placeholder="Type at least 2 letters…"
                        autoComplete="off"
                        aria-autocomplete="list"
                        aria-expanded={showDropdown}
                      />
                      {cityLoading && <span className="lp-city-spinner" aria-hidden="true" />}
                      {cityId && (
                        <button
                          type="button"
                          className="lp-city-clear"
                          onClick={clearCity}
                          aria-label="Clear city selection"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {cityId && (
                      <div className="lp-city-selected">
                        <span className="lp-city-selected__pin">📍</span>
                        {cityLabel}
                      </div>
                    )}

                    {showDropdown && cityResults.length > 0 && !cityId && (
                      <ul className="lp-city-dropdown" role="listbox">
                        {cityResults.map((c) => (
                          <li key={c.id} role="option">
                            <button
                              type="button"
                              className="lp-city-option"
                              onMouseDown={(e) => {
                                e.preventDefault(); // prevent blur before click
                                selectCity(c);
                              }}
                            >
                              <span className="lp-city-option__name">{c.name}</span>
                              {c.country?.name && (
                                <span className="lp-city-option__country">{c.country.name}</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {showDropdown && !cityLoading && cityResults.length === 0 && cityQuery.trim().length >= 2 && !cityId && (
                      <div className="lp-city-empty">
                        No cities found for &ldquo;{cityQuery}&rdquo;
                      </div>
                    )}
                  </div>

                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-address">
                      Address
                      <span className="lp-optional"> — optional</span>
                    </label>
                    <input
                      id="lp-address"
                      className="lp-input"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="Street, area or landmark"
                      autoComplete="off"
                    />
                  </div>

                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-description">
                      Description
                      <span className="lp-optional"> — optional</span>
                    </label>
                    <textarea
                      id="lp-description"
                      className="lp-input lp-textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      maxLength={500}
                      placeholder="Highlight what makes your property special — amenities, vibe, location…"
                    />
                    <div className="lp-char-count">{description.length} / 500</div>
                  </div>

                  <button
                    type="submit"
                    className="btn-search lp-cta-btn"
                    disabled={busy || !hotelName.trim() || !cityId}
                  >
                    {busy ? 'Creating property…' : 'Continue to rooms →'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Step 2: Room types ── */}
            {step === 2 && (
              <div className="panel">
                <div className="lp-panel-head">
                  <h2 className="lp-panel-head__title">Add room types</h2>
                  <p className="lp-panel-head__sub">
                    Add at least one room type with pricing. Guests will see these options when booking.
                  </p>
                </div>

                <form onSubmit={addRoom} noValidate>
                  <div className="lp-field">
                    <label className="lp-label" htmlFor="lp-room-type">
                      Room label <span className="lp-required">*</span>
                    </label>
                    <input
                      id="lp-room-type"
                      className="lp-input"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      placeholder="e.g. Standard, Deluxe, Suite"
                      required
                      autoComplete="off"
                    />
                  </div>

                  <div className="lp-room-row">
                    <div className="lp-field">
                      <label className="lp-label" htmlFor="lp-room-price">
                        Price / night (₹) <span className="lp-required">*</span>
                      </label>
                      <input
                        id="lp-room-price"
                        className="lp-input"
                        type="number"
                        min="0"
                        step="1"
                        value={roomPrice}
                        onChange={(e) => setRoomPrice(e.target.value)}
                        placeholder="e.g. 1499"
                        required
                      />
                    </div>
                    <div className="lp-field">
                      <label className="lp-label" htmlFor="lp-room-total">
                        Total rooms <span className="lp-required">*</span>
                      </label>
                      <input
                        id="lp-room-total"
                        className="lp-input"
                        type="number"
                        min="1"
                        step="1"
                        value={roomTotal}
                        onChange={(e) => setRoomTotal(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn-search lp-cta-btn lp-cta-btn--secondary"
                    disabled={busy || !roomType.trim() || !roomPrice}
                  >
                    {busy ? 'Adding…' : '+ Add room type'}
                  </button>
                </form>

                {/* Added rooms */}
                {roomsAdded.length > 0 ? (
                  <div className="lp-rooms-list">
                    <div className="lp-rooms-list__head">
                      Added room types
                      <span className="lp-rooms-list__count">{roomsAdded.length}</span>
                    </div>
                    {roomsAdded.map((r) => (
                      <div key={r.id} className="lp-room-card">
                        <div className="lp-room-card__icon">🛏</div>
                        <div className="lp-room-card__info">
                          <div className="lp-room-card__name">{r.type}</div>
                          <div className="lp-room-card__meta">
                            ₹{Number(r.price).toLocaleString('en-IN')} / night
                            &nbsp;·&nbsp;
                            {r.total_rooms} room{r.total_rooms !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <span className="lp-room-card__badge">Live</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lp-rooms-empty">
                    <div className="lp-rooms-empty__icon">🛏️</div>
                    <p>No room types yet. Add at least one to go live.</p>
                  </div>
                )}

                <div className="lp-step2-actions">
                  <button
                    type="button"
                    className="btn-search lp-cta-btn"
                    disabled={roomsAdded.length === 0}
                    onClick={() => setStep(3)}
                  >
                    Finish setup →
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => navigate('/manager')}
                  >
                    Skip — go to dashboard
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Success ── */}
            {step === 3 && (
              <div className="panel lp-success-panel">
                <div className="lp-success-icon">🎉</div>
                <h2 className="lp-success-title">You&rsquo;re live!</h2>
                <p className="lp-success-sub">
                  Your property is now listed on STAYEazy. Head to your dashboard
                  to manage bookings, add photos, and update room details anytime.
                </p>
                <div className="lp-success-actions">
                  <button
                    type="button"
                    className="btn-search lp-cta-btn"
                    onClick={() => navigate('/manager')}
                  >
                    Open property dashboard →
                  </button>
                  <Link to="/" className="btn-outline lp-success-home">
                    Back to home
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Right: benefits sidebar */}
          <aside className="lp-aside">
            <div className="lp-aside__card">
              <div className="lp-aside__heading">Why list with STAYEazy?</div>
              <div className="lp-benefits">
                {BENEFITS.map((b) => (
                  <div key={b.title} className="lp-benefit">
                    <div className="lp-benefit__icon">{b.icon}</div>
                    <div>
                      <div className="lp-benefit__title">{b.title}</div>
                      <div className="lp-benefit__body">{b.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lp-aside__card lp-stats-card">
              <div className="lp-stats">
                <div className="lp-stat">
                  <div className="lp-stat__val">1,100+</div>
                  <div className="lp-stat__label">Properties listed</div>
                </div>
                <div className="lp-stat">
                  <div className="lp-stat__val">50+</div>
                  <div className="lp-stat__label">Cities covered</div>
                </div>
                <div className="lp-stat">
                  <div className="lp-stat__val">₹0</div>
                  <div className="lp-stat__label">Listing fee</div>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
