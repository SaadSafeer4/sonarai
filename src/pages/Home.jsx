import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';

function Section({ children, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  
  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

export default function Home() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div className="home">
      <motion.section className="hero" style={{ y: heroY }}>
        <motion.div className="hero__bg" style={{ opacity: heroOpacity }} />
        
        <div className="hero__content">
          <motion.div
            className="hero__tag"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            For the visually impaired
          </motion.div>
          
          <motion.h1 
            className="hero__title"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Your eyes,<br />
            <span className="hero__title-em">reimagined</span>
          </motion.h1>
          
          <motion.p 
            className="hero__desc"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            SonarAI describes the world around you through voice. 
            Ask what's nearby, and listen to understand your surroundings.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            <Link to="/demo" className="hero__cta">
              Try the demo <span className="hero__cta-arrow">→</span>
            </Link>
          </motion.div>
        </div>
        
        <motion.div 
          className="hero__scroll"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <span>Scroll to explore</span>
          <div className="hero__scroll-line" />
        </motion.div>
      </motion.section>

      <Section className="approach">
        <div className="approach__container">
          <span className="section-tag">How it works</span>
          <h2 className="approach__title">Not every frame<br />tells a story.</h2>
          <p className="approach__intro">
            Traditional vision tools are stuck choosing between two extremes. SonarAI decides intelligently.
          </p>

          <div className="approach__compare">
            {/* Traditional column */}
            <div className="approach__col">
              <div className="approach__col-header">
                <span className="approach__col-label">Traditional</span>
              </div>

              <motion.div className="approach__method" whileHover={{ y: -4 }}>
                <div className="approach__method-icon">📷</div>
                <h3>Single Frame Capture</h3>
                <p>Ask a question, get one frozen snapshot. Miss what came before it and what happens after.</p>
                <div className="approach__method-cons">
                  <span>✕ One moment, no context</span>
                  <span>✕ Fully reactive — you must always ask</span>
                </div>
              </motion.div>

              <div className="approach__or">or</div>

              <motion.div className="approach__method" whileHover={{ y: -4 }}>
                <div className="approach__method-icon">📹</div>
                <h3>Blind Continuous Streaming</h3>
                <p>Analyze every frame, every second — whether the scene changed or not.</p>
                <div className="approach__method-cons">
                  <span>✕ Floods you with redundant descriptions</span>
                  <span>✕ Wastes compute on unchanged scenes</span>
                </div>
              </motion.div>
            </div>

            {/* Arrow divider */}
            <div className="approach__arrow">→</div>

            {/* SonarAI column */}
            <div className="approach__col">
              <div className="approach__col-header">
                <span className="approach__col-label approach__col-label--new">SonarAI</span>
              </div>

              <motion.div className="approach__method approach__method--new" whileHover={{ y: -4 }}>
                <div className="approach__method-icon">🧠</div>
                <h3>Intelligent Frame Selection</h3>
                <p>
                  An agentic AI monitors the scene continuously and decides when a frame is actually worth analyzing — only speaking when something meaningful changes.
                </p>
                <div className="approach__method-pros">
                  <span>✓ Jaccard similarity skips duplicate frames</span>
                  <span>✓ Proactively flags hazards without being asked</span>
                  <span>✓ Scene memory answers follow-up questions</span>
                  <span>✓ Single AI provider, zero latency switching</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="difference">
        <div className="difference__container">
          <div className="difference__text">
            <span className="section-tag">What makes us different</span>
            <h2 className="difference__title">It remembers.</h2>
            <p className="difference__desc">
              Ask "What's around me?" then follow up with "Where was the chair?" 
              — SonarAI remembers the scene and answers questions about it.
            </p>
            <p className="difference__desc">
              Most tools give you a one-time answer. We give you a conversation.
            </p>
          </div>
          
          <div className="difference__visual">
            <div className="difference__chat">
              <div className="difference__bubble difference__bubble--user">What's around me?</div>
              <div className="difference__bubble difference__bubble--ai">
                You're in a living room. There's a couch to your left, a coffee table ahead, and a doorway on your right.
              </div>
              <div className="difference__bubble difference__bubble--user">Is the path to the door clear?</div>
              <div className="difference__bubble difference__bubble--ai">
                Yes, there's nothing blocking the way to the doorway on your right.
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="vision">
        <div className="vision__container">
          <h2 className="vision__text">
            We're building the <em>intelligence layer</em> for accessible smart glasses. This demo is the first step.
          </h2>
        </div>
      </Section>

      <Section className="final-cta">
        <div className="final-cta__container">
          <h2 className="final-cta__title">Try it yourself</h2>
          <p className="final-cta__desc">All you need is a browser with camera and microphone access.</p>
          <Link to="/demo" className="final-cta__btn">Launch Demo <span>→</span></Link>
          <div className="final-cta__links">
            <a href="https://github.com/SaadSafeer4/sonarai" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
          </div>
        </div>
      </Section>
    </div>
  );
}
