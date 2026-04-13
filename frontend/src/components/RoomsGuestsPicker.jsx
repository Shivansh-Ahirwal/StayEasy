import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import './RoomsGuestsPicker.css';

const MAX_ROOMS = 8;
const MAX_GUESTS_PER_ROOM = 16;

/**
 * @param {number[]} counts
 * @returns {string}
 */
export function formatRoomsGuestsSummary(counts) {
  if (!counts?.length) return '1 Room, 1 Guest';
  const rooms = counts.length;
  const guests = counts.reduce((a, b) => a + b, 0);
  const rPart = rooms === 1 ? '1 Room' : `${rooms} Rooms`;
  const gPart = guests === 1 ? '1 Guest' : `${guests} Guests`;
  return `${rPart}, ${gPart}`;
}

/** OYO-style rooms + per-room guest steppers in a popover. */
export default function RoomsGuestsPicker({ value, onChange, id: idProp }) {
  const autoId = useId();
  const triggerId = idProp ?? `rooms-guests-${autoId}`;
  const panelId = `${triggerId}-panel`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const counts = value?.length ? value : [1];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        close();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const setGuestsForRoom = useCallback(
    (index, nextVal) => {
      const v = Math.min(
        MAX_GUESTS_PER_ROOM,
        Math.max(1, Math.floor(nextVal)),
      );
      const next = counts.map((g, i) => (i === index ? v : g));
      onChange(next);
    },
    [counts, onChange],
  );

  const addRoom = useCallback(() => {
    if (counts.length >= MAX_ROOMS) return;
    onChange([...counts, 1]);
  }, [counts, onChange]);

  const deleteLastRoom = useCallback(() => {
    if (counts.length <= 1) return;
    onChange(counts.slice(0, -1));
  }, [counts, onChange]);

  const summary = formatRoomsGuestsSummary(counts);
  const canDeleteRoom = counts.length > 1;
  const canAddRoom = counts.length < MAX_ROOMS;

  return (
    <div className="rooms-guests-picker" ref={rootRef}>
      <button
        type="button"
        id={triggerId}
        className="rooms-guests-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="rooms-guests-picker__trigger-text">{summary}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="rooms-guests-picker__popover"
          role="dialog"
          aria-labelledby={`${panelId}-title`}
        >
          <div className="rooms-guests-picker__head" id={`${panelId}-title`}>
            <span className="rooms-guests-picker__head-rooms">Rooms</span>
            <span className="rooms-guests-picker__head-guests">Guests</span>
          </div>

          <ul className="rooms-guests-picker__list" role="list">
            {counts.map((guests, index) => (
              <li key={index} className="rooms-guests-picker__row">
                <span className="rooms-guests-picker__room-label">
                  Room {index + 1}
                </span>
                <div
                  className="rooms-guests-picker__stepper"
                  role="group"
                  aria-label={`Guests in room ${index + 1}`}
                >
                  <button
                    type="button"
                    className="rooms-guests-picker__step"
                    aria-label="Decrease guests"
                    disabled={guests <= 1}
                    onClick={() => setGuestsForRoom(index, guests - 1)}
                  >
                    −
                  </button>
                  <span className="rooms-guests-picker__step-value" aria-live="polite">
                    {guests}
                  </span>
                  <button
                    type="button"
                    className="rooms-guests-picker__step"
                    aria-label="Increase guests"
                    disabled={guests >= MAX_GUESTS_PER_ROOM}
                    onClick={() => setGuestsForRoom(index, guests + 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="rooms-guests-picker__footer">
            <button
              type="button"
              className={`rooms-guests-picker__link${canDeleteRoom ? '' : ' rooms-guests-picker__link--disabled'}`}
              disabled={!canDeleteRoom}
              onClick={deleteLastRoom}
            >
              Delete room
            </button>
            <button
              type="button"
              className={`rooms-guests-picker__link${canAddRoom ? '' : ' rooms-guests-picker__link--disabled'}`}
              disabled={!canAddRoom}
              onClick={addRoom}
            >
              Add room
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
