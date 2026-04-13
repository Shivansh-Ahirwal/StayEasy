import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import DateRangePickerField from '../components/DateRangePickerField';
import { payPendingBooking } from '../services/completeRazorpayPayment';
import { defaultCheckInOut } from '../utils/dateDefaults';

function stayNights(checkInIso, checkOutIso) {
  if (!checkInIso || !checkOutIso) return 0;
  const [y1, m1, d1] = checkInIso.split('-').map(Number);
  const [y2, m2, d2] = checkOutIso.split('-').map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  const n = Math.round((b - a) / 86400000);
  return n > 0 ? n : 0;
}

function detailImageUrl(id) {
  return `https://picsum.photos/seed/yoyodetail${id}/1400/500`;
}

export default function HotelDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { checkIn: defaultIn, checkOut: defaultOut } = defaultCheckInOut();
  const [hotel, setHotel] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState(
    () => searchParams.get('in') || defaultIn,
  );
  const [checkOut, setCheckOut] = useState(
    () => searchParams.get('out') || defaultOut,
  );
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  useEffect(() => {
    const next = defaultCheckInOut();
    setCheckIn(searchParams.get('in') || next.checkIn);
    setCheckOut(searchParams.get('out') || next.checkOut);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/hotels/${id}/`);
        if (!cancelled) {
          setHotel(data);
          if (data.rooms?.length) setRoomId(String(data.rooms[0].id));
        }
      } catch (e) {
        if (!cancelled) setErr(e.response?.data?.detail || e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const minPrice = hotel?.rooms?.length
    ? Math.min(...hotel.rooms.map((r) => Number(r.price)))
    : null;

  const selectedRoom = useMemo(
    () => hotel?.rooms?.find((r) => String(r.id) === String(roomId)),
    [hotel, roomId],
  );

  const nights = stayNights(checkIn, checkOut);
  const estimatedTotal =
    selectedRoom && nights > 0 ? Number(selectedRoom.price) * nights : null;

  const book = async () => {
    setErr('');
    setMsg('');
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!nights) {
      setErr('Choose check-in and check-out (at least one night).');
      return;
    }
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
        setErr(
          'Payment was not completed. The booking is pending — open ' +
            '“My bookings” and tap Pay now to retry.',
        );
        setMsg('');
      } else {
        const d = e.response?.data;
        const detail = d?.detail;
        setErr(
          typeof detail === 'string'
            ? detail
            : detail
              ? JSON.stringify(detail)
              : e.message || 'Something went wrong',
        );
        setMsg('');
      }
    } finally {
      setPayBusy(false);
    }
  };

  if (!hotel) {
    return err ? (
      <div className="section">
        <p className="error">{String(err)}</p>
      </div>
    ) : (
      <div className="loading-state">Finding your stay…</div>
    );
  }

  return (
    <div className="detail-layout">
      <div>
        <nav className="breadcrumb">
          <Link to="/">Home</Link>
          {' / '}
          <span>{hotel.location}</span>
          {' / '}
          <span>{hotel.name}</span>
        </nav>
        <div
          className="detail-hero"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.45), transparent), url(${detailImageUrl(hotel.id)})`,
          }}
        />
        <div className="panel" style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.65rem' }}>
            {hotel.name}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {hotel.location} · Rating {Number(hotel.rating).toFixed(1)} · From Rs.{' '}
            {minPrice ?? '—'} / night · Secure checkout with{' '}
            <strong>Razorpay</strong> (test mode supported)
          </p>
          {hotel.description && (
            <p style={{ marginTop: '1rem', marginBottom: 0 }}>
              {hotel.description}
            </p>
          )}
        </div>
        <div className="panel">
          <h2>Select room</h2>
          {hotel.rooms?.map((r) => (
            <div key={r.id} className="room-row">
              <div>
                <strong>{r.type}</strong>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {r.total_rooms} units · Free cancellation on select rates
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>Rs. {r.price}</div>
                <div className="muted" style={{ fontSize: '0.8rem' }}>
                  per night
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="panel" style={{ position: 'sticky', top: 'calc(var(--header-h) + 1rem)' }}>
        <h2 style={{ marginTop: 0 }}>Book this property</h2>
        <div className="form-group">
          <label htmlFor="room-pick">Room type</label>
          <select
            id="room-pick"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          >
            {hotel.rooms?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.type} — Rs. {r.price}/night
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="hotel-stay-dates">Stay dates</label>
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
        {estimatedTotal != null && (
          <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '1.05rem' }}>
            Total · Rs. {estimatedTotal.toLocaleString('en-IN')}
            <span className="muted" style={{ fontWeight: 500, fontSize: '0.85rem' }}>
              {' '}
              ({nights} night{nights === 1 ? '' : 's'})
            </span>
          </p>
        )}
        <button
          type="button"
          className="btn-search"
          style={{ width: '100%' }}
          onClick={book}
          disabled={payBusy}
        >
          {payBusy ? 'Processing…' : 'Continue to book'}
        </button>
        <p className="muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
          You will pay with Razorpay (UPI, card, netbanking in production). Test
          keys: see README.
        </p>
        {msg && <p className="muted">{msg}</p>}
        {err && <p className="error">{String(err)}</p>}
      </aside>
    </div>
  );
}
