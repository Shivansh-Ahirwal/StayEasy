import React from 'react';
import { Link } from 'react-router-dom';

const AMENITIES = [
  { key: 'reception', label: 'Reception' },
  { key: 'wifi', label: 'Free Wifi' },
  { key: 'power', label: 'Power backup' },
];

const TIERS = ['Mid range', 'Townhouse', 'Flagship'];

function tierForHotel(id) {
  return TIERS[id % TIERS.length];
}

function formatRs(n) {
  const x = Math.round(Number(n) || 0);
  return x.toLocaleString('en-IN');
}

function ratingLabel(rating) {
  const r = Number(rating);
  if (r >= 4.2) return 'Excellent';
  if (r >= 3.8) return 'Very Good';
  if (r >= 3.4) return 'Good';
  return 'Pleasant';
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

function hotelGalleryUrls(id) {
  const main = `https://picsum.photos/seed/yoyo${id}/520/340`;
  const thumbs = [0, 1, 2, 3].map(
    (i) => `https://picsum.photos/seed/yoyo${id}t${i}/96/72`,
  );
  return { main, thumbs };
}

/**
 * @param {{ hotel: object, stayQuery: string }} props
 */
export default function SearchResultHotelCard({ hotel, stayQuery }) {
  const id = hotel.id;
  const { main, thumbs } = hotelGalleryUrls(id);
  const price = hotel.min_room_price != null ? Number(hotel.min_room_price) : null;
  const struck = price != null ? Math.round(price * 1.42) : null;
  const offPct =
    price != null && struck > price
      ? Math.min(90, Math.round((1 - price / struck) * 100))
      : null;
  const taxHint = price != null ? Math.round(price * 0.12) : null;
  const bookedN = 800 + (id % 2200);
  const rating = Number(hotel.rating) || 0;
  const reviewsN = hotel.review_count ?? 0;
  const detailPath = `/hotels/${id}${stayQuery}`;

  return (
    <article className="sr-card">
      <div className="sr-card__gallery">
        <div className="sr-card__main-shot">
          <span className="sr-card__tier">{tierForHotel(id)}</span>
          <img src={main} alt="" className="sr-card__main-img" loading="lazy" />
        </div>
        <div className="sr-card__thumbs">
          {thumbs.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" />
          ))}
        </div>
      </div>

      <div className="sr-card__body">
        <div className="sr-card__main-col">
          <h2 className="sr-card__title">
            <Link to={detailPath}>{hotel.name}</Link>
          </h2>
          <p className="sr-card__address">{hotel.location}</p>

          <div className="sr-card__rating-row">
            <span className="sr-card__rating-badge">
              {formatRating(rating)}
            </span>
            <span className="sr-card__rating-text">
              {formatCount(reviewsN)
                ? `(${formatCount(reviewsN)}) · `
                : ''}
              {ratingLabel(rating)}
            </span>
          </div>

          <div className="sr-card__amenities">
            {AMENITIES.map((a) => (
              <span key={a.key} className="sr-card__amenity">
                {a.label}
              </span>
            ))}
            <span className="sr-card__amenity-more">+ 17 more</span>
          </div>
        </div>

        <div className="sr-card__aside">
          <p className="sr-card__social-proof">
            {bookedN.toLocaleString('en-IN')}+ people booked this stay in the
            last 6 months
          </p>

          {price != null ? (
            <div className="sr-card__price-block">
              <div className="sr-card__price-line">
                <span className="sr-card__price">₹{formatRs(price)}</span>
                {struck > price ? (
                  <>
                    <span className="sr-card__was">₹{formatRs(struck)}</span>
                    {offPct != null ? (
                      <span className="sr-card__off">{offPct}% off</span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <p className="sr-card__taxes">
                + ₹{formatRs(taxHint)} taxes &amp; fees · per room per night
              </p>
            </div>
          ) : (
            <p className="sr-card__price-muted">See details for pricing</p>
          )}

          <div className="sr-card__actions">
            <Link className="sr-card__btn sr-card__btn--outline" to={detailPath}>
              View Details
            </Link>
            <Link className="sr-card__btn sr-card__btn--primary" to={detailPath}>
              Book Now
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
