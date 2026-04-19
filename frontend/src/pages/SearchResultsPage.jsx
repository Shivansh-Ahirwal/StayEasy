import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import DateRangePickerField from '../components/DateRangePickerField';
import RoomsGuestsPicker from '../components/RoomsGuestsPicker';
import SearchResultHotelCard from '../components/SearchResultHotelCard';
import SearchResultsMap from '../components/SearchResultsMap';
import { defaultCheckInOut } from '../utils/dateDefaults';
import {
  buildStaySearchParams,
  parseStaySearchParams,
  stayQueryStringForHotel,
} from '../utils/stayQuery';

const COLLECTIONS = [
  { id: 'family', label: 'Family stays' },
  { id: 'group', label: 'For group travellers' },
  { id: 'airport', label: 'Near airport' },
  { id: 'budget', label: 'Budget picks' },
];

const CATEGORY_FILTERS = [
  { id: 'top_rated', label: 'Yoyo Rooms — top rated' },
  { id: 'value', label: 'Best value deals' },
];

const AREA_CHIPS_DEFAULT = [
  'City centre',
  'Near station',
  'Shopping district',
];

const AREA_CHIPS_DELHI = [
  'New Delhi Railway Station',
  'Mahipalpur',
  'Karol Bagh',
  'Paharganj',
  'Connaught Place',
];

function areaChipsForQuery(q) {
  const s = (q || '').toLowerCase();
  if (s.includes('delhi')) return AREA_CHIPS_DELHI;
  return AREA_CHIPS_DEFAULT;
}

function asList(data) {
  if (!data) return [];
  return Array.isArray(data) ? data : data.results ?? [];
}

function collectionPredicate(id) {
  switch (id) {
    case 'family':
      return (h) => Number(h.rating) >= 4;
    case 'group':
      return (h) =>
        h.min_room_price != null && Number(h.min_room_price) >= 1500;
    case 'airport':
      return (h) =>
        `${h.location || ''} ${h.address_line || ''}`
          .toLowerCase()
          .includes('airport');
    case 'budget':
      return (h) =>
        h.min_room_price != null && Number(h.min_room_price) < 2000;
    default:
      return () => true;
  }
}

function categoryPredicate(id) {
  switch (id) {
    case 'top_rated':
      return (h) => Number(h.rating) >= 4.2;
    case 'value':
      return (h) =>
        h.min_room_price != null && Number(h.min_room_price) < 2500;
    default:
      return () => true;
  }
}

function chipPredicate(chip) {
  const c = chip.toLowerCase();
  return (h) => {
    const blob = `${h.location || ''} ${h.city?.name || ''} ${
      h.address_line || ''
    }`.toLowerCase();
    return blob.includes(c);
  };
}

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [defaults] = useState(() => defaultCheckInOut());

  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [checkIn, setCheckIn] = useState(
    () => searchParams.get('in') || defaults.checkIn,
  );
  const [checkOut, setCheckOut] = useState(
    () => searchParams.get('out') || defaults.checkOut,
  );
  const [roomGuestCounts, setRoomGuestCounts] = useState(() => {
    const { roomGuestCounts: rc } = parseStaySearchParams(searchParams);
    return rc;
  });

  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState(2);
  const [err, setErr] = useState('');
  const [mapOn, setMapOn] = useState(false);
  const sentinelRef = useRef(null);

  // ── Location autocomplete ──
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const locWrapRef = useRef(null);
  const abortRef = useRef(null);
  const [sortBy, setSortBy] = useState('popular');
  const [areaQuery, setAreaQuery] = useState('');
  const [activeChips, setActiveChips] = useState([]);
  const [collections, setCollections] = useState(() => new Set());
  const [categories, setCategories] = useState(() => new Set());
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(50000);
  const [sliderMin, setSliderMin] = useState(0);
  const [sliderMax, setSliderMax] = useState(50000);

  const syncFromUrl = useCallback(() => {
    const parsed = parseStaySearchParams(searchParams);
    setQ(searchParams.get('q') || '');
    setCheckIn(searchParams.get('in') || defaults.checkIn);
    setCheckOut(searchParams.get('out') || defaults.checkOut);
    setRoomGuestCounts(parsed.roomGuestCounts);
  }, [searchParams, defaults]);

  useEffect(() => {
    syncFromUrl();
  }, [syncFromUrl]);

  const searchKey = searchParams.toString();

  // ── Initial fetch (100) on search change ──
  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const term = (params.get('q') || '').trim();
    let cancelled = false;
    setErr('');
    setLoading(true);
    setHasMore(false);
    setNextPage(2);
    api.get('/hotels/', { params: { q: term || undefined, page_size: 100, page: 1 } })
      .then(({ data }) => {
        if (cancelled) return;
        setHotels(asList(data));
        setHasMore(Boolean(data.next));
        setNextPage(2);
      })
      .catch((e) => {
        if (!cancelled) { setErr(e.response?.data?.detail || e.message); setHotels([]); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [searchKey]);

  // ── Load more (20 at a time) ──
  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const params = new URLSearchParams(searchKey);
    const term = (params.get('q') || '').trim();
    setLoadingMore(true);
    api.get('/hotels/', { params: { q: term || undefined, page_size: 20, page: nextPage } })
      .then(({ data }) => {
        setHotels((prev) => [...prev, ...asList(data)]);
        setHasMore(Boolean(data.next));
        setNextPage((p) => p + 1);
      })
      .catch((e) => setErr(e.response?.data?.detail || e.message))
      .finally(() => setLoadingMore(false));
  }, [searchKey, nextPage, hasMore, loadingMore]);

  // ── IntersectionObserver on sentinel ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const numericPrices = useMemo(() => {
    return hotels
      .map((h) => (h.min_room_price != null ? Number(h.min_room_price) : null))
      .filter((n) => n != null && !Number.isNaN(n));
  }, [hotels]);

  useEffect(() => {
    if (numericPrices.length === 0) {
      setSliderMin(0);
      setSliderMax(50000);
      setPriceMin(0);
      setPriceMax(50000);
      return;
    }
    const lo = Math.floor(Math.min(...numericPrices));
    const hi = Math.ceil(Math.max(...numericPrices));
    setSliderMin(lo);
    setSliderMax(hi);
    setPriceMin(lo);
    setPriceMax(hi);
  }, [numericPrices]);

  const filteredSorted = useMemo(() => {
    let list = [...hotels];

    list = list.filter((h) => {
      const p =
        h.min_room_price != null ? Number(h.min_room_price) : null;
      if (p == null) return true;
      return p >= priceMin && p <= priceMax;
    });

    for (const chip of activeChips) {
      const pred = chipPredicate(chip);
      list = list.filter(pred);
    }

    for (const id of collections) {
      list = list.filter(collectionPredicate(id));
    }

    for (const id of categories) {
      list = list.filter(categoryPredicate(id));
    }

    if (areaQuery.trim()) {
      const aq = areaQuery.trim().toLowerCase();
      list = list.filter((h) => {
        const blob = `${h.location || ''} ${h.address_line || ''}`.toLowerCase();
        return blob.includes(aq);
      });
    }

    if (sortBy === 'popular') {
      list.sort((a, b) => Number(b.rating) - Number(a.rating));
    } else if (sortBy === 'price_asc') {
      list.sort((a, b) => {
        const pa = a.min_room_price != null ? Number(a.min_room_price) : 1e12;
        const pb = b.min_room_price != null ? Number(b.min_room_price) : 1e12;
        return pa - pb;
      });
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => {
        const pa = a.min_room_price != null ? Number(a.min_room_price) : -1;
        const pb = b.min_room_price != null ? Number(b.min_room_price) : -1;
        return pb - pa;
      });
    }

    return list;
  }, [
    hotels,
    priceMin,
    priceMax,
    activeChips,
    collections,
    categories,
    areaQuery,
    sortBy,
  ]);

  const staySuffix = stayQueryStringForHotel(checkIn, checkOut, roomGuestCounts);

  const locationTitle = useMemo(() => {
    const t = (searchParams.get('q') || '').trim();
    if (t) return t;
    return 'your destination';
  }, [searchParams]);

  const chips = useMemo(
    () => areaChipsForQuery(searchParams.get('q') || ''),
    [searchParams],
  );

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setSuggestions([]); setHighlight(-1); return; }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const [cRes, hRes] = await Promise.all([
          api.get('/cities/', { params: { q: term }, signal: ac.signal }),
          api.get('/hotels/', { params: { q: term }, signal: ac.signal }),
        ]);
        const cityRows = (cRes.data.results ?? cRes.data).slice(0, 8).map((c) => ({
          kind: 'city', key: `c-${c.id}`, value: c.name,
          primary: c.name, secondary: c.country?.name ?? '',
        }));
        const hotelRows = (hRes.data.results ?? hRes.data).slice(0, 6).map((h) => ({
          kind: 'hotel', key: `h-${h.id}`, value: h.name,
          primary: h.name,
          secondary: h.city ? `${h.city.name}, ${h.city.country_name ?? ''}` : h.location ?? '',
        }));
        setSuggestions([...cityRows, ...hotelRows]);
        setHighlight(-1);
      } catch (e) {
        if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED') return;
        setSuggestions([]);
      }
    }, 280);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]);

  useEffect(() => {
    const onDocDown = (e) => {
      if (locWrapRef.current && !locWrapRef.current.contains(e.target)) {
        setSuggestOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const applySuggestion = (item) => {
    setQ(item.value);
    setSuggestOpen(false);
    setHighlight(-1);
    setSuggestions([]);
    const next = buildStaySearchParams({ q: item.value, checkIn, checkOut, roomGuestCounts });
    setSearchParams(next);
  };

  const onLocKeyDown = (e) => {
    if (!suggestOpen && suggestions.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setSuggestOpen(true); return;
    }
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((i) => (i + 1 >= suggestions.length ? 0 : i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); setSuggestOpen(false); setHighlight(-1); }
    else if (e.key === 'Enter' && highlight >= 0 && suggestions[highlight]) { e.preventDefault(); applySuggestion(suggestions[highlight]); }
  };

  const citySuggestions = suggestions.filter((s) => s.kind === 'city');
  const hotelSuggestions = suggestions.filter((s) => s.kind === 'hotel');

  const onSearchSubmit = (e) => {
    e.preventDefault();
    setSuggestOpen(false);
    const next = buildStaySearchParams({
      q,
      checkIn,
      checkOut,
      roomGuestCounts,
    });
    setSearchParams(next);
  };

  const toggleChip = (label) => {
    setActiveChips((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  };

  const toggleSetMember = (setState, id) => {
    setState((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="sr-page">
      <div className="sr-toolbar">
        <div className="sr-toolbar__inner">
          <form className="sr-search-form" onSubmit={onSearchSubmit}>
            <div className="sr-search-form__loc" ref={locWrapRef}>
              <label className="sr-search-form__mini-label" htmlFor="sr-q">
                Location
              </label>
              <input
                id="sr-q"
                className="sr-search-form__input"
                value={q}
                onChange={(e) => { setQ(e.target.value); setSuggestOpen(true); }}
                onFocus={() => { if (suggestions.length > 0) setSuggestOpen(true); }}
                onKeyDown={onLocKeyDown}
                placeholder="City, area or property"
                autoComplete="off"
                role="combobox"
                aria-expanded={suggestOpen}
                aria-controls="sr-loc-listbox"
                aria-autocomplete="list"
              />
              {suggestOpen && q.trim().length >= 2 && suggestions.length > 0 && (
                <ul id="sr-loc-listbox" className="search-suggestions" role="listbox">
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
            <div className="sr-search-form__dates">
              <span className="sr-search-form__mini-label">Dates</span>
              <DateRangePickerField
                triggerId="sr-dates"
                checkIn={checkIn}
                checkOut={checkOut}
                onRangeChange={({ checkIn: ci, checkOut: co }) => {
                  setCheckIn(ci);
                  setCheckOut(co);
                }}
                popperClassName="date-range-popper date-range-popper--sr"
              />
            </div>
            <div className="sr-search-form__guests">
              <span className="sr-search-form__mini-label">Guests</span>
              <RoomsGuestsPicker
                id="sr-guests"
                value={roomGuestCounts}
                onChange={setRoomGuestCounts}
              />
            </div>
            <button type="submit" className="sr-search-form__submit">
              Search
            </button>
          </form>
        </div>
      </div>

      <div className="sr-layout">
        <aside className="sr-filters" aria-label="Filters">
          <h2 className="sr-filters__title">Filters</h2>

          <section className="sr-filter-block">
            <h3 className="sr-filter-block__heading">Popular locations</h3>
            <input
              type="search"
              className="sr-filter-block__search"
              placeholder="Search area"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              aria-label="Filter by area"
            />
            <div className="sr-chips">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sr-chip${activeChips.includes(c) ? ' sr-chip--on' : ''}`}
                  onClick={() => toggleChip(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          <section className="sr-filter-block">
            <h3 className="sr-filter-block__heading">Price range (₹ / night)</h3>
            <div className="sr-range">
              <label className="sr-range__label">
                Min · ₹{priceMin.toLocaleString('en-IN')}
                <input
                  type="range"
                  min={sliderMin}
                  max={Math.max(sliderMin, priceMax)}
                  value={priceMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v <= priceMax) setPriceMin(v);
                  }}
                />
              </label>
              <label className="sr-range__label">
                Max · ₹{priceMax.toLocaleString('en-IN')}
                <input
                  type="range"
                  min={Math.min(sliderMax, priceMin)}
                  max={sliderMax}
                  value={priceMax}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= priceMin) setPriceMax(v);
                  }}
                />
              </label>
            </div>
          </section>

          <section className="sr-filter-block">
            <h3 className="sr-filter-block__heading">Collections</h3>
            <ul className="sr-checklist">
              {COLLECTIONS.map((c) => (
                <li key={c.id}>
                  <label className="sr-check">
                    <input
                      type="checkbox"
                      checked={collections.has(c.id)}
                      onChange={() => toggleSetMember(setCollections, c.id)}
                    />
                    {c.label}
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="sr-filter-block">
            <h3 className="sr-filter-block__heading">Categories</h3>
            <ul className="sr-checklist">
              {CATEGORY_FILTERS.map((c) => (
                <li key={c.id}>
                  <label className="sr-check">
                    <input
                      type="checkbox"
                      checked={categories.has(c.id)}
                      onChange={() => toggleSetMember(setCategories, c.id)}
                    />
                    {c.label}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="sr-main">
          <header className="sr-main__head">
            <h1 className="sr-main__title">
              {loading ? (
                'Searching…'
              ) : (
                <>
                  {filteredSorted.length} stay
                  {filteredSorted.length === 1 ? '' : 's'} in {locationTitle}
                </>
              )}
            </h1>
            <div className="sr-main__controls">
              <label className="sr-toggle">
                <input
                  type="checkbox"
                  checked={mapOn}
                  onChange={(e) => setMapOn(e.target.checked)}
                />
                <span>Map view</span>
              </label>
              <label className="sr-sort">
                <span className="sr-sort__label">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="popular">Popularity</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </label>
            </div>
          </header>

          <div className="sr-main__listing">
            {mapOn ? (
              <SearchResultsMap
                hotels={filteredSorted}
                stayQuery={staySuffix}
              />
            ) : null}

            <div className="sr-banners">
              <div className="sr-banner sr-banner--yellow">
                <strong>WEBSITEOFFER</strong>
                <span>
                  Extra 5% off on select stays with this code at checkout.
                </span>
              </div>
              <div className="sr-banner sr-banner--teal">
                <strong>Yoyo Money</strong>
                <span>Use wallet balance on your next booking (demo).</span>
              </div>
            </div>

            {err && <p className="error">{String(err)}</p>}
            {!loading && !err && filteredSorted.length === 0 && (
              <p className="muted">
                No stays match your filters.{' '}
                <Link to="/">Try a new search</Link>
              </p>
            )}

            <div className="sr-results-list">
              {filteredSorted.map((h) => (
                <SearchResultHotelCard
                  key={h.id}
                  hotel={h}
                  stayQuery={staySuffix}
                />
              ))}
            </div>

            {/* Sentinel — triggers next page when scrolled into view */}
            {hasMore && <div ref={sentinelRef} className="sr-sentinel" />}

            {loadingMore && (
              <div className="sr-load-more">
                <span className="sr-load-more__spinner" />
                Loading more hotels…
              </div>
            )}

            {!hasMore && !loading && hotels.length > 0 && (
              <p className="sr-load-more sr-load-more--end">
                All {hotels.length} properties loaded
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
