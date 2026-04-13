import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

/** Fix default marker assets with Vite / bundlers. */
function useDefaultLeafletIcon() {
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);
}

/**
 * @param {{ id: number, lat: number, lng: number }[]} markers
 */
function FitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
      return;
    }
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(b, { padding: [48, 48], maxZoom: 14 });
  }, [map, markers]);
  return null;
}

/**
 * @param {object} hotel
 * @returns {{ id: number, lat: number, lng: number, name: string, priceLabel: string } | null}
 */
function mappableHotel(hotel) {
  const lat =
    hotel.latitude != null ? Number(hotel.latitude) : Number.NaN;
  const lng =
    hotel.longitude != null ? Number(hotel.longitude) : Number.NaN;
  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  const price =
    hotel.min_room_price != null
      ? `₹${Math.round(Number(hotel.min_room_price)).toLocaleString('en-IN')}`
      : 'See pricing';
  return {
    id: hotel.id,
    lat,
    lng,
    name: hotel.name,
    priceLabel: price,
  };
}

const INDIA_CENTER = [22.5937, 78.9629];
const INDIA_ZOOM = 5;

/**
 * OpenStreetMap + markers for filtered search results.
 *
 * @param {{ hotels: object[], stayQuery: string }} props
 */
export default function SearchResultsMap({ hotels, stayQuery }) {
  useDefaultLeafletIcon();

  const markers = useMemo(() => {
    const out = [];
    for (const h of hotels) {
      const m = mappableHotel(h);
      if (m) out.push(m);
    }
    return out;
  }, [hotels]);

  if (markers.length === 0) {
    return (
      <div className="sr-map-wrap sr-map-wrap--empty" role="status">
        <p className="muted" style={{ margin: 0 }}>
          No properties on this list have map coordinates yet. Try another
          search or import hotels with latitude/longitude.
        </p>
      </div>
    );
  }

  return (
    <div className="sr-map-wrap">
      <MapContainer
        center={INDIA_CENTER}
        zoom={INDIA_ZOOM}
        className="sr-map-leaflet"
        scrollWheelZoom
        aria-label="Map of search results"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]}>
            <Popup>
              <div className="sr-map-popup">
                <strong className="sr-map-popup__title">{m.name}</strong>
                <div className="sr-map-popup__price">{m.priceLabel}</div>
                <Link
                  className="sr-map-popup__link"
                  to={`/hotels/${m.id}${stayQuery}`}
                >
                  View property
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
