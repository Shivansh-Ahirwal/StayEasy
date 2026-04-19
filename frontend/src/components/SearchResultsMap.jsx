import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

function useCustomIcons() {
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

function makePriceIcon(label) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin">${label}</div>`,
    iconSize: null,
    iconAnchor: [0, 0],
    popupAnchor: [0, -4],
  });
}

function FitBounds({ markers }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 13);
      return;
    }
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng]));
    map.fitBounds(b, { padding: [56, 56], maxZoom: 14 });
  }, [map, markers]);
  return null;
}

function mappableHotel(hotel) {
  const lat = hotel.latitude != null ? Number(hotel.latitude) : NaN;
  const lng = hotel.longitude != null ? Number(hotel.longitude) : NaN;
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
    return null;

  const price =
    hotel.min_room_price != null
      ? `₹${Math.round(Number(hotel.min_room_price)).toLocaleString('en-IN')}`
      : null;

  return {
    id: hotel.id,
    lat,
    lng,
    name: hotel.name,
    city: hotel.city?.name ?? '',
    rating: hotel.rating != null ? Number(hotel.rating).toFixed(1) : null,
    reviewCount: hotel.review_count ?? 0,
    price,
    priceLabel: price ?? 'See price',
  };
}

const INDIA_CENTER = [22.5937, 78.9629];
const INDIA_ZOOM = 5;

export default function SearchResultsMap({ hotels, stayQuery }) {
  useCustomIcons();

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
        <div className="sr-map-empty">
          <span className="sr-map-empty__icon">🗺️</span>
          <p className="sr-map-empty__text">
            No map coordinates found for these properties yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sr-map-wrap">
      <div className="sr-map-header">
        <span className="sr-map-header__label">
          📍 {markers.length} propert{markers.length === 1 ? 'y' : 'ies'} on map
        </span>
        <span className="sr-map-header__hint">Click a pin for details</span>
      </div>
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
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={makePriceIcon(m.priceLabel)}
          >
            <Popup className="sr-map-popup-wrap" maxWidth={240} minWidth={220}>
              <div className="sr-map-popup">
                <img
                  className="sr-map-popup__img"
                  src={`https://picsum.photos/seed/yoyo${m.id}/240/120`}
                  alt={m.name}
                  loading="lazy"
                />
                <div className="sr-map-popup__body">
                  <div className="sr-map-popup__name">{m.name}</div>
                  {m.city && (
                    <div className="sr-map-popup__city">📍 {m.city}</div>
                  )}
                  <div className="sr-map-popup__foot">
                    {m.rating && (
                      <span className="sr-map-popup__rating">
                        ⭐ {m.rating}
                        {m.reviewCount > 0 && (
                          <span className="sr-map-popup__rc">
                            &nbsp;({m.reviewCount > 999
                              ? `${(m.reviewCount / 1000).toFixed(1)}k`
                              : m.reviewCount})
                          </span>
                        )}
                      </span>
                    )}
                    {m.price && (
                      <span className="sr-map-popup__price">{m.price}<span className="sr-map-popup__per">/night</span></span>
                    )}
                  </div>
                  <Link
                    className="sr-map-popup__cta"
                    to={`/hotels/${m.id}${stayQuery}`}
                  >
                    View property →
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
