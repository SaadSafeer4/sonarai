import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__top">
          {/* Logo & Tagline */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo">
              <span className="footer__logo-icon">◉</span>
              <span className="footer__logo-text">sonar</span>
            </Link>
            <p className="footer__tagline">
              See the world through sound.
            </p>
          </div>

          {/* Links */}
          <div className="footer__links">
            <div className="footer__links-group">
              <h4 className="footer__links-title">PRODUCT</h4>
              <Link to="/demo" className="footer__link">Demo</Link>
              <Link to="/about" className="footer__link">About</Link>
            </div>
            <div className="footer__links-group">
              <h4 className="footer__links-title">CONNECT</h4>
              <a href="https://github.com/SaadSafeer4/sonarai" target="_blank" rel="noopener noreferrer" className="footer__link">GitHub</a>
              <a href="mailto:hello@sonarai.com" className="footer__link">Contact</a>
            </div>
          </div>
        </div>

        <div className="footer__divider" />

        <div className="footer__bottom">
          <p className="footer__copyright">
            © 2026 SonarAI. Building accessibility for everyone.
          </p>
          <p className="footer__made">
            Made with purpose in Abu Dhabi
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

