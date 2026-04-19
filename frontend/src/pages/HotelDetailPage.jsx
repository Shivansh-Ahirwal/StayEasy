import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DateRangePickerField from '../components/DateRangePickerField';
import { payPendingBooking } from '../services/completeRazorpayPayment';
import { defaultCheckInOut } from '../utils/dateDefaults';

/* ─── pure helpers ──────────────────────────────── */
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
function stayNights(ci, co) {
  if (!ci || !co) return 0;
  const d = (new Date(co) - new Date(ci)) / 86_400_000;
  return d > 0 ? Math.round(d) : 0;
}
function formatRs(n) {
  return Math.round(Number(n) || 0).toLocaleString('en-IN');
}

/* ─── group amenities by category ─── */
function groupAmenities(amenities) {
  const map = {};
  for (const a of amenities) {
    const cat = a.category || 'Other';
    if (!map[cat]) map[cat] = [];
    map[cat].push(a);
  }
  return map;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatReviewDate(iso) {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function ratingAspects(id, base) {
  const b = Number(base) || 4;
  return [
    { label: 'Cleanliness', val: Math.min(5, +(b + ((id * 3) % 10) / 10 - 0.3).toFixed(1)) },
    { label: 'Location',    val: Math.min(5, +(b + ((id * 7) % 10) / 10 + 0.1).toFixed(1)) },
    { label: 'Value',       val: Math.min(5, +(b + ((id * 5) % 10) / 10 - 0.5).toFixed(1)) },
    { label: 'Service',     val: Math.min(5, +(b + ((id * 9) % 10) / 10 - 0.1).toFixed(1)) },
  ];
}

const TIERS = ['Standard', 'Townhouse', 'Flagship'];
function tierFor(id) { return TIERS[id % TIERS.length]; }

function galleryUrls(id) {
  return {
    main:   `https://picsum.photos/seed/yoyodetail${id}/900/580`,
    thumbs: [
      `https://picsum.photos/seed/yoyoroom${id}/440/280`,
      `https://picsum.photos/seed/yoyolobby${id}/440/280`,
      `https://picsum.photos/seed/yoyobath${id}/440/280`,
      `https://picsum.photos/seed/yoyoview${id}/440/280`,
    ],
  };
}

/* ─── component ─────────────────────────────────── */
export default function HotelDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { checkIn: defaultIn, checkOut: defaultOut } = defaultCheckInOut();

  const [hotel, setHotel]       = useState(null);
  const [reviews, setReviews]   = useState([]);
  const [roomId, setRoomId]     = useState('');
  const [checkIn, setCheckIn]   = useState(() => searchParams.get('in') || defaultIn);
  const [checkOut, setCheckOut] = useState(() => searchParams.get('out') || defaultOut);
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [payBusy, setPayBusy]   = useState(false);

  useEffect(() => {
    const next = defaultCheckInOut();
    setCheckIn(searchParams.get('in') || next.checkIn);
    setCheckOut(searchParams.get('out') || next.checkOut);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: hotelData }, { data: reviewData }] = await Promise.all([
          api.get(`/hotels/${id}/`),
          api.get(`/hotels/${id}/reviews/`),
        ]);
        if (!cancelled) {
          setHotel(hotelData);
          if (hotelData.rooms?.length) setRoomId(String(hotelData.rooms[0].id));
          setReviews(reviewData.results ?? reviewData);
        }
      } catch (e) {
        if (!cancelled) setErr(e.response?.data?.detail || e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const minPrice = hotel?.rooms?.length
    ? Math.min(...hotel.rooms.map((r) => Number(r.price)))
    : null;

  const selectedRoom = useMemo(
    () => hotel?.rooms?.find((r) => String(r.id) === String(roomId)),
    [hotel, roomId],
  );

  const nights        = stayNights(checkIn, checkOut);
  const roomCost      = selectedRoom && nights > 0 ? Number(selectedRoom.price) * nights : null;
  const taxes         = roomCost != null ? Math.round(roomCost * 0.12) : null;
  const estimatedTotal = roomCost != null ? roomCost + taxes : null;

  const book = async () => {
    setErr(''); setMsg('');
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!nights) { setErr('Choose check-in and check-out (at least one night).'); return; }
    setPayBusy(true);
    try {
      const { data: booking } = await api.post('/bookings/', {
        room: Number(roomId),
        check_in: checkIn,
        check_out: checkOut,
      });
      setMsg('Booking held. Complete payment in the secure window…');
      await payPendingBooking(api, {
        bookingId: booking.id,
        userEmail: user?.email,
        hotelName: hotel?.name,
      });
      setMsg('');
      navigate('/bookings');
    } catch (e) {
      if (e.code === 'dismissed') {
        setErr('Payment not completed. Open "My bookings" and tap Pay now to retry.');
        setMsg('');
      } else {
        const d = e.response?.data;
        setErr(typeof d?.detail === 'string' ? d.detail : d ? JSON.stringify(d) : e.message || 'Something went wrong');
        setMsg('');
      }
    } finally {
      setPayBusy(false);
    }
  };

  /* ── loading / error states ── */
  if (!hotel) {
    return err
      ? <div className="section"><p className="error">{String(err)}</p></div>
      : (
        <div className="hdp-skeleton-page">
          <div className="hdp-skeleton-gallery">
            <div className="hdp-skeleton-main hdp-shimmer" />
            <div className="hdp-skeleton-thumbs">
              {[0,1,2,3].map(n => <div key={n} className="hdp-shimmer" />)}
            </div>
          </div>
          <div className="hdp-body">
            <div className="hdp-shimmer" style={{ height: 28, width: 260, borderRadius: 6, marginBottom: '1.5rem' }} />
            <div className="hdp-layout">
              <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {[180, 140, 220].map(h => <div key={h} className="hdp-shimmer" style={{ height: h, borderRadius: 12 }} />)}
              </div>
              <div className="hdp-shimmer" style={{ height: 400, borderRadius: 16 }} />
            </div>
          </div>
        </div>
      );
  }

  const numId    = Number(id);
  const amenityGroups = groupAmenities(hotel.amenities ?? []);
  const aspects   = ratingAspects(numId, hotel.rating);
  const { main: mainImg, thumbs } = galleryUrls(numId);
  const rating  = Number(hotel.rating) || 0;
  const rCount  = formatCount(hotel.review_count);

  return (
    <div className="hdp">

      {/* ── 1. Photo gallery ── */}
      <div className="hdp-gallery">
        <div className="hdp-gallery__main">
          <img src={mainImg} alt={hotel.name} loading="lazy" />
          <span className="hdp-gallery__tier">{tierFor(numId)}</span>
        </div>
        <div className="hdp-gallery__grid">
          {thumbs.map((src, i) => (
            <div key={i} className="hdp-gallery__thumb">
              <img src={src} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Page body ── */}
      <div className="hdp-body">

        {/* Breadcrumb */}
        <nav className="hdp-breadcrumb" aria-label="breadcrumb">
          <Link to="/">Home</Link>
          <span className="hdp-breadcrumb__sep">›</span>
          <Link to={`/search?q=${encodeURIComponent(hotel.city?.name ?? '')}`}>
            {hotel.city?.name ?? hotel.location}
          </Link>
          <span className="hdp-breadcrumb__sep">›</span>
          <span>{hotel.name}</span>
        </nav>

        <div className="hdp-layout">

          {/* ── Left: main content ── */}
          <div className="hdp-main">

            {/* Overview */}
            <div className="hdp-section hdp-section--overview">
              <div className="hdp-overview__header">
                <div>
                  <h1 className="hdp-name">{hotel.name}</h1>
                  <div className="hdp-meta-row">
                    <span className="hdp-location">📍 {hotel.location}</span>
                  </div>
                </div>
                <div className="hdp-rating-pill">
                  <span className="hdp-rating-pill__score">{formatRating(rating)}</span>
                  {rCount && <span className="hdp-rating-pill__count">({rCount})</span>}
                  <span className="hdp-rating-pill__label">
                    {rating >= 4.2 ? 'Excellent' : rating >= 3.8 ? 'Very Good' : 'Good'}
                  </span>
                </div>
              </div>

              {/* Key stats strip */}
              <div className="hdp-stats-strip">
                {minPrice != null && (
                  <div className="hdp-stat-chip">
                    <span className="hdp-stat-chip__val">₹{formatRs(minPrice)}</span>
                    <span className="hdp-stat-chip__label">per night</span>
                  </div>
                )}
                {hotel.rooms?.length > 0 && (
                  <div className="hdp-stat-chip">
                    <span className="hdp-stat-chip__val">{hotel.rooms.length}</span>
                    <span className="hdp-stat-chip__label">room type{hotel.rooms.length > 1 ? 's' : ''}</span>
                  </div>
                )}
                <div className="hdp-stat-chip">
                  <span className="hdp-stat-chip__val">✓</span>
                  <span className="hdp-stat-chip__label">Free cancellation</span>
                </div>
                <div className="hdp-stat-chip">
                  <span className="hdp-stat-chip__val">🔒</span>
                  <span className="hdp-stat-chip__label">Secure checkout</span>
                </div>
              </div>
            </div>

            {/* Amenities */}
            {Object.keys(amenityGroups).length > 0 && (
              <div className="hdp-section">
                <h2 className="hdp-section__title">What's included</h2>
                {Object.entries(amenityGroups).map(([cat, items]) => (
                  <div key={cat} className="hdp-amenity-group">
                    <div className="hdp-amenity-group__label">{cat}</div>
                    <div className="hdp-amenities">
                      {items.map((a) => (
                        <div key={a.id} className="hdp-amenity">
                          <span className="hdp-amenity__icon">{a.icon}</span>
                          <span className="hdp-amenity__label">{a.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* About */}
            {hotel.description && (
              <div className="hdp-section">
                <h2 className="hdp-section__title">About this property</h2>
                <p className="hdp-about">{hotel.description}</p>
              </div>
            )}

            {/* Room options */}
            <div className="hdp-section">
              <h2 className="hdp-section__title">Available rooms</h2>
              <div className="hdp-rooms">
                {hotel.rooms?.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`hdp-room-card${String(r.id) === String(roomId) ? ' hdp-room-card--selected' : ''}`}
                    onClick={() => setRoomId(String(r.id))}
                  >
                    <div className="hdp-room-card__thumb">
                      <img
                        src={`https://picsum.photos/seed/yoyorm${numId}${r.id}/200/140`}
                        alt={r.type}
                        loading="lazy"
                      />
                    </div>
                    <div className="hdp-room-card__info">
                      <div className="hdp-room-card__type">{r.type}</div>
                      <div className="hdp-room-card__perks">
                        <span>👥 Up to 2 guests</span>
                        <span>🛏 1 double bed</span>
                        <span>📐 {200 + (numId + r.id) % 150} sq ft</span>
                      </div>
                      <div className="hdp-room-card__inventory">
                        {r.total_rooms} unit{r.total_rooms > 1 ? 's' : ''} available
                      </div>
                    </div>
                    <div className="hdp-room-card__price">
                      <div className="hdp-room-card__price-val">₹{formatRs(r.price)}</div>
                      <div className="hdp-room-card__price-label">per night</div>
                      {String(r.id) === String(roomId) && (
                        <div className="hdp-room-card__selected-badge">Selected ✓</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="hdp-section">
              <h2 className="hdp-section__title">Location</h2>
              <div className="hdp-location-box">
                <div className="hdp-location-box__map-placeholder">
                  <span className="hdp-location-box__map-icon">🗺️</span>
                  <span className="hdp-location-box__map-label">Map view</span>
                  {hotel.latitude && hotel.longitude && (
                    <a
                      href={`https://www.google.com/maps?q=${hotel.latitude},${hotel.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hdp-location-box__gmaps"
                    >
                      Open in Google Maps ↗
                    </a>
                  )}
                </div>
                <div className="hdp-location-box__address">
                  <div className="hdp-location-box__name">{hotel.name}</div>
                  {hotel.address_line && (
                    <div className="hdp-location-box__line">{hotel.address_line}</div>
                  )}
                  <div className="hdp-location-box__city">
                    {hotel.city?.name}{hotel.city?.country?.name ? `, ${hotel.city.country.name}` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Guest reviews */}
            <div className="hdp-section">
              <div className="hdp-reviews-head">
                <h2 className="hdp-section__title" style={{ margin: 0 }}>Guest reviews</h2>
                <div className="hdp-reviews-score">
                  <span className="hdp-reviews-score__val">{formatRating(rating)}</span>
                  <span className="hdp-reviews-score__outof">/ 5</span>
                  {reviews.length > 0 && (
                    <span className="hdp-reviews-score__count">
                      {formatCount(reviews.length)} rating{reviews.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Rating aspect bars */}
              <div className="hdp-aspects">
                {aspects.map((a) => (
                  <div key={a.label} className="hdp-aspect">
                    <span className="hdp-aspect__label">{a.label}</span>
                    <div className="hdp-aspect__bar-wrap">
                      <div
                        className="hdp-aspect__bar"
                        style={{ width: `${(a.val / 5) * 100}%` }}
                      />
                    </div>
                    <span className="hdp-aspect__val">{a.val}</span>
                  </div>
                ))}
              </div>

              {/* Review cards */}
              <div className="hdp-review-list">
                {reviews.length === 0 && (
                  <p style={{ color: '#aaa', fontSize: '0.875rem' }}>No reviews yet.</p>
                )}
                {reviews.map((r) => (
                  <div key={r.id} className="hdp-review">
                    <div className="hdp-review__header">
                      <div className="hdp-review__avatar">{r.reviewer_name[0]}</div>
                      <div>
                        <div className="hdp-review__name">{r.reviewer_name}</div>
                        <div className="hdp-review__date">{formatReviewDate(r.created_at)}</div>
                      </div>
                      <div className="hdp-review__rating">
                        {'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}
                        <span> {r.rating}</span>
                      </div>
                    </div>
                    {r.comment && <p className="hdp-review__comment">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Right: booking card ── */}
          <aside className="hdp-booking">
            <div className="hdp-booking__card">

              {/* Price hook */}
              <div className="hdp-booking__hook">
                {minPrice != null
                  ? <><span className="hdp-booking__price">₹{formatRs(minPrice)}</span><span className="hdp-booking__per"> / night</span></>
                  : <span className="hdp-booking__price">See pricing</span>
                }
              </div>

              {/* Rating inline */}
              <div className="hdp-booking__rating-line">
                <span className="hdp-booking__stars">★</span>
                <strong>{formatRating(rating)}</strong>
                {rCount && <span className="hdp-booking__rcount">&nbsp;({rCount} reviews)</span>}
              </div>

              <div className="hdp-booking__divider" />

              {/* Room selector */}
              <div className="hdp-booking__field">
                <label className="hdp-booking__label" htmlFor="room-pick">Room type</label>
                <select
                  id="room-pick"
                  className="hdp-booking__select"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  {hotel.rooms?.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.type} — ₹{formatRs(r.price)}/night
                    </option>
                  ))}
                </select>
              </div>

              {/* Date picker */}
              <div className="hdp-booking__field">
                <label className="hdp-booking__label" htmlFor="hotel-stay-dates">Stay dates</label>
                <DateRangePickerField
                  triggerId="hotel-stay-dates"
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onRangeChange={({ checkIn: ci, checkOut: co }) => {
                    setCheckIn(ci);
                    setCheckOut(co);
                  }}
                  popperClassName="date-range-popper date-range-popper--panel"
                />
              </div>

              {/* Price breakdown */}
              {estimatedTotal != null && (
                <div className="hdp-price-breakdown">
                  <div className="hdp-price-breakdown__row">
                    <span>₹{formatRs(selectedRoom.price)} × {nights} night{nights > 1 ? 's' : ''}</span>
                    <span>₹{formatRs(roomCost)}</span>
                  </div>
                  <div className="hdp-price-breakdown__row">
                    <span>Taxes &amp; fees (12%)</span>
                    <span>₹{formatRs(taxes)}</span>
                  </div>
                  <div className="hdp-price-breakdown__total">
                    <span>Total</span>
                    <span>₹{formatRs(estimatedTotal)}</span>
                  </div>
                </div>
              )}

              {/* Alerts */}
              {msg && (
                <div className="hdp-booking__info">{msg}</div>
              )}
              {err && (
                <div className="hdp-booking__err">{String(err)}</div>
              )}

              {/* CTA */}
              <button
                type="button"
                className="hdp-booking__cta"
                onClick={book}
                disabled={payBusy}
              >
                {payBusy ? 'Processing…' : nights > 0 ? `Reserve for ${nights} night${nights > 1 ? 's' : ''}` : 'Check availability'}
              </button>

              {/* Trust row */}
              <div className="hdp-booking__trust">
                <span>🔒 Secure payment</span>
                <span>✓ Free cancellation</span>
                <span>⚡ Instant confirmation</span>
              </div>

              <p className="hdp-booking__footnote">
                Powered by Razorpay · UPI, cards &amp; netbanking supported
              </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
