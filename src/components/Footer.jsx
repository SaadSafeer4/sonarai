import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__container">
        <div className="footer__left">
          <Link to="/" className="footer__logo">
            <span className="footer__logo-mark">◉</span>
            <span className="footer__logo-text">sonar</span>
          </Link>
          <p className="footer__tagline">See through sound.</p>
        </div>
        
        <a 
          href="https://github.com/SaadSafeer4/sonarai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="footer__link"
        >
          GitHub
        </a>
      </div>
      
      <div className="footer__bottom">
        <span>© 2026 SonarAI</span>
        <span>Made in Abu Dhabi</span>
      </div>
    </footer>
  );
}
