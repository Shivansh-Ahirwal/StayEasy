import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import DateRangePickerField from '../components/DateRangePickerField';
import RoomsGuestsPicker from '../components/RoomsGuestsPicker';
import {
  ArrowRight,
  Calendar,
  MapPin,
  Search,
  Star,
  TrendingUp,
  Users,
} from '../components/Icons';
import { defaultCheckInOut } from '../utils/dateDefaults';
import { buildStaySearchParams, stayQueryStringForHotel } from '../utils/stayQuery';

const POPULAR_CITIES = [
  { name: 'Mumbai',    emoji: '🌊' },
  { name: 'Delhi',     emoji: '🏛️' },
  { name: 'Bangalore', emoji: '🌿' },
  { name: 'Hyderabad', emoji: '🕌' },
  { name: 'Chennai',   emoji: '🎭' },
  { name: 'Kolkata',   emoji: '🌉' },
  { name: 'Pune',      emoji: '🏔️' },
  { name: 'Goa',       emoji: '🏖️' },
];

const SUGGEST_DEBOUNCE_MS = 280;
const MIN_QUERY_LEN = 2;

function hotelImageUrl(id) {
  return `https://picsum.photos/seed/yoyo${id}/640/400`;
}

function formatRating(r) {
  const n = parseFloat(Number(r).toFixed(1));
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatCount(n) {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000) return `${parseFloat((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1000) return `${parseFloat((n / 1000).toFixed(1))}k`;
  return String(n);
}

function asList(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

function PicksSkeleton() {
  return (
    <>
      {[1, 2, 3].map((n) => (
        <div key={n} className="hp-pick-row hp-pick-row--skeleton">
          <div className="hp-pick-row__thumb hp-skeleton" />
          <div className="hp-pick-row__info">
            <div className="hp-skeleton" style={{ height: 12, width: '70%', borderRadius: 4 }} />
            <div className="hp-skeleton" style={{ height: 10, width: '45%', borderRadius: 4, marginTop: 6 }} />
          </div>
        </div>
      ))}
    </>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { checkIn: defaultIn, checkOut: defaultOut } = defaultCheckInOut();
  const [hotels, setHotels] = useState([]);
  const [q, setQ] = useState('');
  const [activeCity, setActiveCity] = useState('');
  const [checkIn, setCheckIn] = useState(defaultIn);
  const [checkOut, setCheckOut] = useState(defaultOut);
  const [roomGuestCounts, setRoomGuestCounts] = useState([1]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const [topPicks, setTopPicks] = useState([]);
  const [picksCity, setPicksCity] = useState(null);
  const [picksLoading, setPicksLoading] = useState(true);

  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  const load = async (searchQ) => {
    setErr('');
    const term = searchQ !== undefined ? searchQ : q;
    try {
      const params = term.trim() ? { q: term.trim() } : {};
      const { data } = await api.get('/hotels/', { params });
      setHotels(data.results ?? data);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function cityFromCoords(lat, lon) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      return (
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        data.address?.county ||
        null
      );
    }

    async function fetchTopPicks(city) {
      const params = city ? { loc: city, limit: 4 } : { limit: 4 };
      const { data } = await api.get('/hotels/top_picks/', { params });
      if (!cancelled) {
        setTopPicks(data.results ?? []);
        setPicksCity(data.city || null);
      }
    }

    if (!navigator.geolocation) {
      fetchTopPicks(null).finally(() => { if (!cancelled) setPicksLoading(false); });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        let city = null;
        try { city = await cityFromCoords(coords.latitude, coords.longitude); } catch (_) {}
        try { await fetchTopPicks(city); } catch (_) { if (!cancelled) setTopPicks([]); }
        if (!cancelled) setPicksLoading(false);
      },
      () => {
        // User denied or timed out — fall back to global top picks
        fetchTopPicks(null).finally(() => { if (!cancelled) setPicksLoading(false); });
      },
      { timeout: 8000, maximumAge: 300_000 },
    );

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setHighlight(-1);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const [cRes, hRes] = await Promise.all([
          api.get('/cities/', { params: { q: term }, signal: ac.signal }),
          api.get('/hotels/', { params: { q: term }, signal: ac.signal }),
        ]);
        const cityRows = asList(cRes.data).slice(0, 8).map((c) => ({
          kind: 'city', key: `c-${c.id}`, value: c.name,
          primary: c.name, secondary: c.country?.name ?? '',
        }));
        const hotelRows = asList(hRes.data).slice(0, 6).map((h) => ({
          kind: 'hotel', key: `h-${h.id}`, value: h.name,
          primary: h.name,
          secondary: h.city != null ? `${h.city.name}, ${h.city.country_name}` : h.location ?? '',
        }));
        setSuggestions([...cityRows, ...hotelRows]);
        setHighlight(-1);
      } catch (e) {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);

  useEffect(() => {
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSuggestOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const applySuggestion = (item) => {
    if (!item) return;
    setQ(item.value);
    setActiveCity('');
    setSuggestOpen(false);
    setHighlight(-1);
    load(item.value);
  };

  const onSearch = (e) => {
    e.preventDefault();
    setSuggestOpen(false);
    setActiveCity('');
    const loc = q.trim();
    if (!loc || !checkIn || !checkOut) {
      setErr('Please enter a destination and stay dates.');
      return;
    }
    setErr('');
    navigate(`/search?${buildStaySearchParams({ q: loc, checkIn, checkOut, roomGuestCounts }).toString()}`);
  };

  const pickCity = (city) => {
    setActiveCity(city);
    setQ(city);
    setSuggestOpen(false);
    setSuggestions([]);
    load(city);
  };

  const clearCity = () => { setActiveCity(''); setQ(''); load(''); };

  const queryForHotel = () => stayQueryStringForHotel(checkIn, checkOut, roomGuestCounts);

  const onLocKeyDown = (e) => {
    if (!suggestOpen && suggestions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSuggestOpen(true);
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((i) => (i + 1 >= suggestions.length ? 0 : i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); setSuggestOpen(false); setHighlight(-1); }
    else if (e.key === 'Enter' && highlight >= 0 && suggestions[highlight]) { e.preventDefault(); applySuggestion(suggestions[highlight]); }
  };

  const citySuggestions = suggestions.filter((s) => s.kind === 'city');
  const hotelSuggestions = suggestions.filter((s) => s.kind === 'hotel');

  return (
    <>
      {/* ── Hero ── */}
      <section className="hp-hero">
        <div className="hp-hero__inner">
          <div className="hp-hero__grid">

            {/* Left: headline + search */}
            <div className="hp-hero__left">
              <p className="hp-hero__eyebrow">Discover · Book · Stay</p>
              <h1 className="hp-hero__title">
                Find your perfect stay,<br />anywhere in India
              </h1>
              <p className="hp-hero__sub">
                Over 1,100 properties &nbsp;·&nbsp; Great prices &nbsp;·&nbsp; Instant booking
              </p>

              <form className="hp-search-card" onSubmit={onSearch}>
                {/* Location */}
                <div
                  className="search-field search-field--autocomplete hp-search-field--loc"
                  ref={wrapRef}
                >
                  <label htmlFor="search-loc" className="hp-field-label">
                    <MapPin size={13} /> City, area or property
                  </label>
                  <input
                    id="search-loc"
                    autoComplete="off"
                    placeholder="Where do you want to stay?"
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setActiveCity(''); setSuggestOpen(true); }}
                    onFocus={() => { if (suggestions.length > 0) setSuggestOpen(true); }}
                    onKeyDown={onLocKeyDown}
                    role="combobox"
                    aria-expanded={suggestOpen}
                    aria-controls="search-loc-listbox"
                    aria-autocomplete="list"
                  />
                  {suggestOpen && q.trim().length >= MIN_QUERY_LEN && suggestions.length > 0 && (
                    <ul id="search-loc-listbox" className="search-suggestions" role="listbox">
                      {citySuggestions.length > 0 && (
                        <>
                          <li className="search-suggestions__label" role="presentation">Cities</li>
                          {citySuggestions.map((item) => {
                            const idx = suggestions.indexOf(item);
                            return (
                              <li key={item.key} role="presentation">
                                <button
                                  type="button" role="option" aria-selected={highlight === idx}
                                  className={`search-suggestion${highlight === idx ? ' search-suggestion--active' : ''}`}
                                  onMouseEnter={() => setHighlight(idx)}
                                  onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => applySuggestion(item)}
                                >
                                  <span className="search-suggestion__tag">City</span>
                                  <span className="search-suggestion__primary">{item.primary}</span>
                                  {item.secondary && <div className="search-suggestion__secondary">{item.secondary}</div>}
                                </button>
                              </li>
                            );
                          })}
                        </>
                      )}
                      {hotelSuggestions.length > 0 && (
                        <>
                          <li className="search-suggestions__label" role="presentation">Properties</li>
                          {hotelSuggestions.map((item) => {
                            const idx = suggestions.indexOf(item);
                            return (
                              <li key={item.key} role="presentation">
                                <button
                                  type="button" role="option" aria-selected={highlight === idx}
                                  className={`search-suggestion${highlight === idx ? ' search-suggestion--active' : ''}`}
                                  onMouseEnter={() => setHighlight(idx)}
                                  onMouseDown={(ev) => ev.preventDefault()}
                                  onClick={() => applySuggestion(item)}
                                >
                                  <span className="search-suggestion__tag">Stay</span>
                                  <span className="search-suggestion__primary">{item.primary}</span>
                                  {item.secondary && <div className="search-suggestion__secondary">{item.secondary}</div>}
                                </button>
                              </li>
                            );
                          })}
                        </>
                      )}
                    </ul>
                  )}
                </div>

                {/* Dates */}
                <div className="search-field search-field--daterange-wrap">
                  <label className="search-field__eyebrow hp-field-label" htmlFor="hero-date-range">
                    <Calendar size={13} /> Dates
                  </label>
                  <DateRangePickerField
                    triggerId="hero-date-range"
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onRangeChange={({ checkIn: ci, checkOut: co }) => { setCheckIn(ci); setCheckOut(co); }}
                  />
                </div>

                {/* Rooms & guests */}
                <div className="search-field search-field--guest-wrap">
                  <label className="search-field__eyebrow hp-field-label" htmlFor="hero-rooms-guests">
                    <Users size={13} /> Rooms &amp; guests
                  </label>
                  <RoomsGuestsPicker id="hero-rooms-guests" value={roomGuestCounts} onChange={setRoomGuestCounts} />
                </div>

                <button type="submit" className="btn-search btn-search--hero hp-search-btn">
                  <Search size={16} />
                  Search
                </button>
              </form>

              {err && <p className="hp-hero__err">{err}</p>}

              {/* Quick city chips */}
              <div className="hp-hero__chips">
                <span className="hp-hero__chips-label">Popular:</span>
                {POPULAR_CITIES.slice(0, 5).map(({ name }) => (
                  <button
                    key={name}
                    type="button"
                    className={`hp-hero__chip${activeCity === name ? ' hp-hero__chip--active' : ''}`}
                    onClick={() => pickCity(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: floating top-picks card */}
            <aside className="hp-hero__right" aria-label="Top picks">
              <div className="hp-picks-card">
                <div className="hp-picks-card__head">
                  <TrendingUp size={16} />
                  <span>
                    {picksCity ? `Top picks in ${picksCity}` : 'Top picks right now'}
                  </span>
                </div>

                <div className="hp-picks-card__list">
                  {picksLoading ? (
                    <PicksSkeleton />
                  ) : topPicks.length === 0 ? (
                    <p className="hp-picks-empty">No properties loaded yet.</p>
                  ) : (
                    topPicks.map((h) => (
                      <Link
                        key={h.id}
                        to={`/hotels/${h.id}${queryForHotel()}`}
                        className="hp-pick-row"
                      >
                        <div
                          className="hp-pick-row__thumb"
                          style={{ backgroundImage: `url(${hotelImageUrl(h.id)})` }}
                        />
                        <div className="hp-pick-row__info">
                          <div className="hp-pick-row__name">{h.name}</div>
                          <div className="hp-pick-row__meta">
                            <span className="hp-pick-row__loc">
                              {h.city ? h.city.name : (h.location ?? '—')}
                            </span>
                            <span className="hp-pick-row__rating">
                              <Star size={10} style={{ fill: '#f59e0b', stroke: '#f59e0b' }} />
                              {formatRating(h.rating)}
                              {formatCount(h.review_count) ? ` (${formatCount(h.review_count)})` : ''}
                            </span>
                          </div>
                          {h.min_room_price && (
                            <div className="hp-pick-row__price">
                              from ₹{Number(h.min_room_price).toLocaleString('en-IN')}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={14} className="hp-pick-row__arrow" />
                      </Link>
                    ))
                  )}
                </div>

                <Link
                  to={picksCity ? `/search?q=${encodeURIComponent(picksCity)}` : '/search'}
                  className="hp-picks-card__footer"
                >
                  {picksCity ? `View all stays in ${picksCity}` : 'View all 1,100+ stays'} <ArrowRight size={14} />
                </Link>
              </div>

              {/* Trust badges */}
              <div className="hp-trust-row">
                <div className="hp-trust-badge">
                  <span className="hp-trust-badge__val">₹0</span>
                  <span className="hp-trust-badge__label">Listing fee</span>
                </div>
                <div className="hp-trust-sep" />
                <div className="hp-trust-badge">
                  <span className="hp-trust-badge__val">50+</span>
                  <span className="hp-trust-badge__label">Cities</span>
                </div>
                <div className="hp-trust-sep" />
                <div className="hp-trust-badge">
                  <span className="hp-trust-badge__val">1.1K+</span>
                  <span className="hp-trust-badge__label">Properties</span>
                </div>
              </div>
            </aside>

          </div>
        </div>
      </section>

      {/* ── Popular destinations ── */}
      <section className="hp-section">
        <h2 className="hp-section__title">Popular destinations</h2>
        <div className="hp-cities">
          {POPULAR_CITIES.map(({ name, emoji }) => (
            <button
              key={name}
              type="button"
              className={`hp-city-card${activeCity === name ? ' hp-city-card--active' : ''}`}
              onClick={() => pickCity(name)}
            >
              <span className="hp-city-card__emoji">{emoji}</span>
              <span className="hp-city-card__name">{name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Limited-time deals banner ── */}
      <section className="hp-deals-banner">
        <div className="hp-deals-banner__inner">
          <div className="hp-deals-banner__badge">🔥 Limited Time</div>
          <h2 className="hp-deals-banner__title">Up to 40% off on weekend stays</h2>
          <p className="hp-deals-banner__sub">Book before Sunday midnight · No cancellation fee</p>
          <button type="button" className="hp-deals-banner__cta" onClick={() => navigate('/search')}>
            Grab the deal <ArrowRight size={15} />
          </button>
        </div>
        <div className="hp-deals-banner__bubbles" aria-hidden>
          <span /><span /><span /><span />
        </div>
      </section>

      {/* ── Value propositions ── */}
      <section className="hp-section hp-why">
        <h2 className="hp-section__title">Why book with STAYEazy?</h2>
        <div className="hp-why-grid">
          {[
            { icon: '🏷️', title: 'Best Price Guarantee', desc: 'Find a lower price elsewhere? We match it — no questions asked.' },
            { icon: '⚡', title: 'Instant Confirmation', desc: 'Your booking is confirmed in seconds. No waiting, no follow-ups.' },
            { icon: '🔒', title: 'Secure Payments', desc: 'End-to-end encrypted checkout. Pay by UPI, card, or net banking.' },
            { icon: '🎧', title: '24 / 7 Support', desc: 'Our travel experts are available round the clock via chat or call.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="hp-why-card">
              <div className="hp-why-card__icon">{icon}</div>
              <h3 className="hp-why-card__title">{title}</h3>
              <p className="hp-why-card__desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="hp-section hp-how">
        <h2 className="hp-section__title">Book in 3 simple steps</h2>
        <div className="hp-how-steps">
          {[
            { n: '01', icon: '🔍', title: 'Search your destination', desc: 'Enter a city or property name and pick your travel dates.' },
            { n: '02', icon: '🏨', title: 'Choose your stay', desc: 'Compare properties by price, rating, and amenities.' },
            { n: '03', icon: '✅', title: 'Book & travel', desc: 'Secure your room in seconds and get instant confirmation.' },
          ].map(({ n, icon, title, desc }) => (
            <div key={n} className="hp-how-step">
              <div className="hp-how-step__num">{n}</div>
              <div className="hp-how-step__icon">{icon}</div>
              <h3 className="hp-how-step__title">{title}</h3>
              <p className="hp-how-step__desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="hp-stats-strip">
        {[
          { val: '1,100+', label: 'Properties listed' },
          { val: '50+',    label: 'Cities covered' },
          { val: '4.6★',  label: 'Average guest rating' },
          { val: '₹0',    label: 'Cancellation fee*' },
        ].map(({ val, label }) => (
          <div key={label} className="hp-stats-strip__item">
            <span className="hp-stats-strip__val">{val}</span>
            <span className="hp-stats-strip__label">{label}</span>
          </div>
        ))}
      </section>

      {/* ── List your property CTA ── */}
      <section className="hp-host-cta">
        <div className="hp-host-cta__text">
          <h2 className="hp-host-cta__title">Own a property? List it free today.</h2>
          <p className="hp-host-cta__sub">
            Join 500+ hosts earning extra income on STAYEazy. No listing fee, no commission on the first 10 bookings.
          </p>
          <div className="hp-host-cta__actions">
            <button type="button" className="hp-host-cta__btn hp-host-cta__btn--primary" onClick={() => navigate('/manager')}>
              Start listing for free
            </button>
            <button type="button" className="hp-host-cta__btn hp-host-cta__btn--ghost">
              Learn more
            </button>
          </div>
        </div>
        <div className="hp-host-cta__visual" aria-hidden>
          <span className="hp-host-cta__badge">🏠</span>
          <div className="hp-host-cta__ring" />
          <div className="hp-host-cta__ring hp-host-cta__ring--2" />
        </div>
      </section>

      {/* ── Hotels grid — only shown when a city is active ── */}
      {activeCity && (
      <section className="hp-section hp-section--hotels">
        <div className="hp-hotels-head">
          <h2 className="hp-section__title" style={{ margin: 0 }}>
            Stays in {activeCity}
          </h2>
          <button type="button" className="hp-clear-filter" onClick={clearCity}>
            ✕ Clear filter
          </button>
        </div>

        {err && <p className="error" style={{ marginTop: '0.75rem' }}>{String(err)}</p>}
        {hotels.length === 0 && !err && !loading && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>No properties in {activeCity} yet.</p>
        )}

        <div className="hp-hotel-grid">
          {hotels.map((h) => (
            <article key={h.id} className="hotel-card">
              <Link to={`/hotels/${h.id}${queryForHotel()}`}>
                <div
                  className="hotel-card__media"
                  style={{ backgroundImage: `url(${hotelImageUrl(h.id)})` }}
                >
                  <span className="hotel-card__badge">
                    {formatRating(h.rating)}
                    {formatCount(h.review_count) ? ` (${formatCount(h.review_count)})` : ''}
                  </span>
                </div>
              </Link>
              <div className="hotel-card__body">
                <h3 className="hotel-card__name">{h.name}</h3>
                <p className="hotel-card__loc">
                  {h.city ? `${h.city.name}, ${h.city.country_name}` : h.location}
                </p>
                <div className="hotel-card__meta">
                  <span className="hotel-card__rating">
                    {Number(h.rating) >= 4 ? 'Excellent' : 'Good'} · Guest favourite
                  </span>
                  <Link className="hotel-card__cta" to={`/hotels/${h.id}${queryForHotel()}`}>
                    View deals
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      )}
    </>
  );
}

function ChevronRight(p) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={p.size ?? 16} height={p.size ?? 16}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={p.className} aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
