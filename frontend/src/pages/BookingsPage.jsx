import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { payPendingBooking } from '../services/completeRazorpayPayment';

export default function BookingsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loadErr, setLoadErr] = useState('');
  const [payErr, setPayErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/bookings/');
        setRows(data.results ?? data);
      } catch (e) {
        setLoadErr(e.response?.data?.detail || e.message);
      }
    })();
  }, []);

  const reload = async () => {
    const { data } = await api.get('/bookings/');
    setRows(data.results ?? data);
  };

  const pay = async (b) => {
    setPayErr('');
    setBusyId(b.id);
    try {
      await payPendingBooking(api, {
        bookingId: b.id,
        userEmail: user?.email,
      });
      await reload();
    } catch (e) {
      if (e.code === 'dismissed') {
        setPayErr('Payment was cancelled.');
      } else {
        setPayErr(e.message || String(e));
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loadErr) {
    return (
      <div className="section">
        <p className="error">{String(loadErr)}</p>
      </div>
    );
  }

  return (
    <section className="section">
      <h1 className="section__title">My bookings</h1>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
        View upcoming and past stays. Need help?{' '}
        <a href="#support">Contact support</a>.
      </p>
      {payErr ? <p className="error">{payErr}</p> : null}
      {rows.length === 0 && (
        <div className="panel" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            You have no bookings yet.
          </p>
          <Link to="/" className="btn-search" style={{ display: 'inline-block' }}>
            Search stays
          </Link>
        </div>
      )}
      {rows.map((b) => (
        <div key={b.id} className="panel" style={{ marginBottom: '1rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '1rem',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                Booking #{b.id}
              </div>
              <div className="muted" style={{ fontSize: '0.9rem' }}>
                {b.check_in} → {b.check_out}
              </div>
              {b.room_detail && (
                <div style={{ marginTop: '0.5rem' }}>
                  {b.room_detail.type}
                  <span className="muted"> · Property #{b.room_detail.hotel}</span>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
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
              <div style={{ fontWeight: 700, marginTop: '0.5rem' }}>
                Rs. {b.total_price}
              </div>
              {b.status === 'pending' ? (
                <button
                  type="button"
                  className="btn-search"
                  style={{
                    width: '100%',
                    marginTop: '0.65rem',
                    fontSize: '0.85rem',
                    padding: '0.45rem 0.75rem',
                  }}
                  disabled={busyId === b.id}
                  onClick={() => pay(b)}
                >
                  {busyId === b.id ? 'Opening payment…' : 'Pay now'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
