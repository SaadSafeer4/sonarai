import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const isDemo = useLocation().pathname === '/demo';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`header ${scrolled ? 'header--scrolled' : ''} ${isDemo ? 'header--demo' : ''}`}>
      <nav className="header__nav">
        <Link to="/" className="header__logo">
          <span className="header__logo-mark">◉</span>
          <span className="header__logo-text">sonar</span>
        </Link>

        {isDemo ? (
          <Link to="/" className="header__back">← Back</Link>
        ) : (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link to="/demo" className="header__cta">Try Demo</Link>
          </motion.div>
        )}
      </nav>
    </header>
  );
}
