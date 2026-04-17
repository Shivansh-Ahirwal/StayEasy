import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { payPendingBooking } from '../services/completeRazorpayPayment';

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

function fmtDayLabel(isoDate) {
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return isoDate;
  }
}

function fmtDow(isoDate) {
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  } catch {
    return '';
  }
}

function tripKey(b) {
  return `${b.city_name || 'Unknown'}|${b.country_name || ''}`;
}

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
        setRows(asList(data));
      } catch (e) {
        setLoadErr(e.response?.data?.detail || e.message);
      }
    })();
  }, []);

  const reload = async () => {
    const { data } = await api.get('/bookings/');
    setRows(asList(data));
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

  const trips = useMemo(() => {
    const map = new Map();
    rows.forEach((b) => {
      const k = tripKey(b);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(b);
    });

    const groups = Array.from(map.entries()).map(([k, items]) => {
      items.sort((a, b) => String(a.check_in).localeCompare(String(b.check_in)));
      const first = items[0];
      const last = items[items.length - 1];
      return {
        key: k,
        city: first.city_name || 'Your trip',
        country: first.country_name || '',
        start: first.check_in,
        end: last.check_out,
        items,
      };
    });

    groups.sort((a, b) => String(b.start).localeCompare(String(a.start)));
    return groups;
  }, [rows]);

  return (
    <section className="section">
      <h1 className="section__title">Trips</h1>
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
      {trips.map((t) => (
        <div key={t.key} className="panel" style={{ marginBottom: '1.25rem', padding: 0 }}>
          <div
            style={{
              padding: '1.15rem 1.25rem 1rem',
              borderBottom: '1px solid var(--border)',
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0))',
            }}
          >
            <div style={{ fontSize: '1.55rem', fontWeight: 800 }}>
              {t.city}
            </div>
            <div className="muted" style={{ marginTop: '0.25rem' }}>
              {t.start} – {t.end}
              <span style={{ margin: '0 0.5rem' }}>·</span>
              {t.items.length} booking{t.items.length === 1 ? '' : 's'}
              {t.country ? (
                <>
                  <span style={{ margin: '0 0.5rem' }}>·</span>
                  {t.country}
                </>
              ) : null}
            </div>
          </div>

          <div style={{ padding: '0.85rem 1.25rem 1.1rem' }}>
            {t.items.map((b) => (
              <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '5.25rem 1fr', gap: '0.9rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {fmtDayLabel(b.check_in)}
                  </div>
                  <div>{fmtDow(b.check_in)}</div>
                  <div style={{ marginTop: '0.35rem', fontWeight: 700 }}>
                    14:00
                  </div>
                </div>

                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '0.85rem 1rem',
                    marginBottom: '0.85rem',
                    background: 'var(--bg-white)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {b.hotel_name || `Property #${b.hotel_id || b.room_detail?.hotel || '—'}`}
                      </div>
                      <div className="muted" style={{ fontSize: '0.9rem', marginTop: '0.15rem' }}>
                        {b.check_in} → {b.check_out}
                        {b.room_detail?.type ? (
                          <>
                            <span className="muted"> · </span>
                            {b.room_detail.type}
                          </>
                        ) : null}
                      </div>
                      <details style={{ marginTop: '0.55rem' }}>
                        <summary className="muted" style={{ cursor: 'pointer' }}>
                          View details
                        </summary>
                        <div className="muted" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                          Booking #{b.id}
                          <span style={{ margin: '0 0.5rem' }}>·</span>
                          Total: Rs. {b.total_price}
                        </div>
                        <div className="muted" style={{ fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          Check-in status: {b.checked_in_at ? 'Checked in' : 'Not checked in'}
                          <span style={{ margin: '0 0.5rem' }}>·</span>
                          Check-out status: {b.checked_out_at ? 'Checked out' : 'Not checked out'}
                        </div>
                      </details>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
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
                        {b.status === 'confirmed' ? 'Completed' : b.status}
                      </span>
                      <div style={{ fontWeight: 800, marginTop: '0.55rem' }}>
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

                  <div
                    style={{
                      marginTop: '0.85rem',
                      paddingTop: '0.85rem',
                      borderTop: '1px dashed var(--border)',
                      display: 'grid',
                      gridTemplateColumns: '6rem 1fr',
                      gap: '0.75rem',
                      alignItems: 'start',
                    }}
                  >
                    <div className="muted" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      {fmtDayLabel(b.check_out)}
                      <div style={{ fontWeight: 600 }}>{fmtDow(b.check_out)}</div>
                      <div style={{ marginTop: '0.35rem', fontWeight: 800, color: 'var(--text)' }}>
                        11:00
                      </div>
                    </div>
                    <div className="muted" style={{ fontSize: '0.9rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text)' }}>
                        Check out
                      </span>
                      <span className="muted"> · </span>
                      {b.hotel_name || 'Stay'}
                      <div style={{ marginTop: '0.35rem' }}>
                        Have a wonderful trip
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
