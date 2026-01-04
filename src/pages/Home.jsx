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

      <Section className="how">
        <div className="how__container">
          <span className="section-tag">How it works</span>
          <h2 className="how__title">Three words.<br />Complete awareness.</h2>
          
          <div className="how__steps">
            {[
              { num: '1', title: 'Speak', desc: 'Tap the button and ask "What\'s around me?"' },
              { num: '2', title: 'Capture', desc: 'Your camera takes a snapshot of the scene.' },
              { num: '3', title: 'Listen', desc: 'Hear a clear description of your surroundings.' }
            ].map(step => (
              <motion.div 
                key={step.num}
                className="how__step"
                whileHover={{ y: -8 }}
              >
                <div className="how__step-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </motion.div>
            ))}
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
