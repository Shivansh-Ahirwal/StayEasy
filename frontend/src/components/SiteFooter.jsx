import React from 'react';
import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__grid">
          <div>
            <h4>Yoyo Stays</h4>
            <Link to="/">Find hotels</Link>
            <Link to="/bookings">My bookings</Link>
            <span style={{ display: 'block', paddingTop: '0.5rem' }}>
              Save on stays · Free cancellation on select rooms
            </span>
          </div>
          <div>
            <h4>Support</h4>
            <a href="#help">Help centre</a>
            <a href="#safety">Trust &amp; safety</a>
            <a href="#terms">Terms &amp; conditions</a>
          </div>
          <div>
            <h4>For partners</h4>
            <a href="#list">List your property</a>
            <a href="#business">Yoyo for business</a>
          </div>
        </div>
        <div className="site-footer__bottom">
          Demo UI inspired by leading travel sites · Not affiliated with{' '}
          <a
            href="https://www.oyorooms.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline', color: '#b0b0b0' }}
          >
            OYO
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
