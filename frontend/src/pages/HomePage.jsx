import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import DateRangePickerField from '../components/DateRangePickerField';
import RoomsGuestsPicker from '../components/RoomsGuestsPicker';
import { defaultCheckInOut } from '../utils/dateDefaults';
import {
  buildStaySearchParams,
  stayQueryStringForHotel,
} from '../utils/stayQuery';

const POPULAR_CITIES = [
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Goa',
];

const SUGGEST_DEBOUNCE_MS = 280;
const MIN_QUERY_LEN = 2;

function hotelImageUrl(id) {
  return `https://picsum.photos/seed/yoyo${id}/640/400`;
}

function asList(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
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
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          api.get('/cities/', {
            params: { q: term },
            signal: ac.signal,
          }),
          api.get('/hotels/', {
            params: { q: term },
            signal: ac.signal,
          }),
        ]);

        const cityRows = asList(cRes.data).slice(0, 8).map((c) => ({
          kind: 'city',
          key: `c-${c.id}`,
          value: c.name,
          primary: c.name,
          secondary: c.country?.name ?? '',
        }));

        const hotelRows = asList(hRes.data).slice(0, 6).map((h) => ({
          kind: 'hotel',
          key: `h-${h.id}`,
          value: h.name,
          primary: h.name,
          secondary:
            h.city != null
              ? `${h.city.name}, ${h.city.country_name}`
              : h.location ?? '',
        }));

        setSuggestions([...cityRows, ...hotelRows]);
        setHighlight(-1);
      } catch (e) {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      ac.abort();
    };
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
    const params = buildStaySearchParams({
      q: loc,
      checkIn,
      checkOut,
      roomGuestCounts,
    });
    navigate(`/search?${params.toString()}`);
  };

  const pickCity = (city) => {
    setActiveCity(city);
    setQ(city);
    setSuggestOpen(false);
    setSuggestions([]);
    load(city);
  };

  const queryForHotel = () =>
    stayQueryStringForHotel(checkIn, checkOut, roomGuestCounts);

  const onLocKeyDown = (e) => {
    if (!suggestOpen && suggestions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSuggestOpen(true);
    }
    if (!suggestOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((i) => (i + 1 >= suggestions.length ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSuggestOpen(false);
      setHighlight(-1);
    } else if (e.key === 'Enter' && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      applySuggestion(suggestions[highlight]);
    }
  };

  const citySuggestions = suggestions.filter((s) => s.kind === 'city');
  const hotelSuggestions = suggestions.filter((s) => s.kind === 'hotel');

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <h1 className="hero__title">
            Thousands of hotels and homes — great prices, simple booking
          </h1>
          <p className="hero__subtitle">
            Search by city, check dates, and book in a few taps. Member deals
            coming soon.
          </p>
          <form className="search-card" onSubmit={onSearch}>
            <div
              className="search-field search-field--autocomplete"
              style={{ flex: '2 1 200px' }}
              ref={wrapRef}
            >
              <label htmlFor="search-loc">City, area or property</label>
              <input
                id="search-loc"
                autoComplete="off"
                placeholder="Where do you want to stay?"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActiveCity('');
                  setSuggestOpen(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setSuggestOpen(true);
                }}
                onKeyDown={onLocKeyDown}
                role="combobox"
                aria-expanded={suggestOpen}
                aria-controls="search-loc-listbox"
                aria-autocomplete="list"
              />
              {suggestOpen &&
                q.trim().length >= MIN_QUERY_LEN &&
                suggestions.length > 0 && (
                  <ul
                    id="search-loc-listbox"
                    className="search-suggestions"
                    role="listbox"
                  >
                    {citySuggestions.length > 0 && (
                      <>
                        <li className="search-suggestions__label" role="presentation">
                          Cities
                        </li>
                        {citySuggestions.map((item) => {
                          const globalIdx = suggestions.indexOf(item);
                          return (
                            <li key={item.key} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={highlight === globalIdx}
                                className={`search-suggestion${highlight === globalIdx ? ' search-suggestion--active' : ''}`}
                                onMouseEnter={() => setHighlight(globalIdx)}
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => applySuggestion(item)}
                              >
                                <span className="search-suggestion__tag">City</span>
                                <span className="search-suggestion__primary">
                                  {item.primary}
                                </span>
                                {item.secondary ? (
                                  <div className="search-suggestion__secondary">
                                    {item.secondary}
                                  </div>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </>
                    )}
                    {hotelSuggestions.length > 0 && (
                      <>
                        <li className="search-suggestions__label" role="presentation">
                          Properties
                        </li>
                        {hotelSuggestions.map((item) => {
                          const globalIdx = suggestions.indexOf(item);
                          return (
                            <li key={item.key} role="presentation">
                              <button
                                type="button"
                                role="option"
                                aria-selected={highlight === globalIdx}
                                className={`search-suggestion${highlight === globalIdx ? ' search-suggestion--active' : ''}`}
                                onMouseEnter={() => setHighlight(globalIdx)}
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => applySuggestion(item)}
                              >
                                <span className="search-suggestion__tag">Stay</span>
                                <span className="search-suggestion__primary">
                                  {item.primary}
                                </span>
                                {item.secondary ? (
                                  <div className="search-suggestion__secondary">
                                    {item.secondary}
                                  </div>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </>
                    )}
                  </ul>
                )}
            </div>
            <div className="search-field search-field--daterange-wrap">
              <label className="search-field__eyebrow" htmlFor="hero-date-range">
                Dates
              </label>
              <DateRangePickerField
                triggerId="hero-date-range"
                checkIn={checkIn}
                checkOut={checkOut}
                onRangeChange={({ checkIn: ci, checkOut: co }) => {
                  setCheckIn(ci);
                  setCheckOut(co);
                }}
              />
            </div>
            <div className="search-field search-field--guest-wrap">
              <label
                className="search-field__eyebrow"
                htmlFor="hero-rooms-guests"
              >
                Rooms &amp; guests
              </label>
              <RoomsGuestsPicker
                id="hero-rooms-guests"
                value={roomGuestCounts}
                onChange={setRoomGuestCounts}
              />
            </div>
            <button type="submit" className="btn-search btn-search--hero">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Popular cities</h2>
        <div className="city-row">
          {POPULAR_CITIES.map((city) => (
            <button
              key={city}
              type="button"
              className={`city-pill${activeCity === city ? ' city-pill--active' : ''}`}
              onClick={() => pickCity(city)}
            >
              {city}
            </button>
          ))}
        </div>

        <h2 className="section__title">Stays for you</h2>
        {err && <p className="error">{String(err)}</p>}
        {hotels.length === 0 && !err && (
          <p className="muted">No properties match your search yet.</p>
        )}
        <div className="hotel-grid">
          {hotels.map((h) => (
            <article key={h.id} className="hotel-card">
              <Link to={`/hotels/${h.id}${queryForHotel()}`}>
                <div
                  className="hotel-card__media"
                  style={{
                    backgroundImage: `url(${hotelImageUrl(h.id)})`,
                  }}
                >
                  <span className="hotel-card__badge">
                    {Number(h.rating).toFixed(1)} / 5
                  </span>
                </div>
              </Link>
              <div className="hotel-card__body">
                <h3 className="hotel-card__name">{h.name}</h3>
                <p className="hotel-card__loc">
                  {h.city
                    ? `${h.city.name}, ${h.city.country_name}`
                    : h.location}
                </p>
                <div className="hotel-card__meta">
                  <span className="hotel-card__rating">
                    {Number(h.rating) >= 4 ? 'Excellent' : 'Good'} · Guest
                    favourite
                  </span>
                  <Link
                    className="hotel-card__cta"
                    to={`/hotels/${h.id}${queryForHotel()}`}
                  >
                    View deals
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
