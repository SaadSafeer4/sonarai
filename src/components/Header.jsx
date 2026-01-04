import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const isDemo = location.pathname === '/demo';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`header ${isScrolled ? 'header--scrolled' : ''} ${isDemo ? 'header--demo' : ''}`}>
      <nav className="header__nav">
        <Link to="/" className="header__logo">
          <span className="header__logo-mark">◉</span>
          <span className="header__logo-text">sonar</span>
        </Link>

        <div className="header__actions">
          {!isDemo && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link to="/demo" className="header__cta">
                Try Demo
              </Link>
            </motion.div>
          )}
          {isDemo && (
            <Link to="/" className="header__back">
              ← Back
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
