import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const About = () => {
  const values = [
    {
      title: "Accessibility First",
      description: "Every feature is designed with blind and low-vision users as the primary audience. No visual dependencies."
    },
    {
      title: "Privacy Focused", 
      description: "Images are processed and discarded. We don't store visual data. Your surroundings stay private."
    },
    {
      title: "Open Development",
      description: "Built in the open. We believe accessibility tools should be transparent and community-driven."
    }
  ];

  const roadmap = [
    {
      phase: "PHASE 1",
      title: "MVP Demo",
      status: "Current",
      items: ["Web-based demo", "Voice I/O", "Scene analysis", "Short-term memory"]
    },
    {
      phase: "PHASE 2", 
      title: "Enhanced AI",
      status: "Next",
      items: ["Faster responses", "Offline support", "Object tracking", "Persistent memory"]
    },
    {
      phase: "PHASE 3",
      title: "Hardware",
      status: "Future",
      items: ["Wearable prototype", "Smart glasses", "Bone conduction audio", "All-day battery"]
    }
  ];

  return (
    <div className="about">
      {/* Hero */}
      <section className="about-hero">
        <motion.div 
          className="about-hero__content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="about-hero__label">ABOUT SONAR</span>
          <h1 className="about-hero__title">
            Building the Future of<br />
            <span className="about-hero__title-accent">Accessible Vision</span>
          </h1>
          <div className="about-hero__divider" />
          <p className="about-hero__text">
            SonarAI is the intelligence layer for accessible smart glasses. We're building 
            technology that helps blind and low-vision users understand and navigate the world 
            through voice interaction alone.
          </p>
        </motion.div>
      </section>

      {/* Mission */}
      <section className="section section--alt">
        <div className="section__container section__container--narrow">
          <motion.div 
            className="mission"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="mission__title">Our Mission</h2>
            <div className="mission__divider" />
            <p className="mission__text">
              Over 2.2 billion people worldwide have vision impairment. While smartphones 
              have brought many accessibility features, they still require looking at a screen. 
              We believe the future is voice-first, wearable, and always available.
            </p>
            <p className="mission__text">
              SonarAI is building that future — starting with intelligent scene understanding 
              that can describe your surroundings, remember context, and have a conversation 
              about what's around you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Values */}
      <section className="section">
        <div className="section__container">
          <div className="section__header">
            <span className="section__label">OUR VALUES</span>
            <h2 className="section__title">What We Stand For</h2>
            <div className="section__divider" />
          </div>

          <div className="values">
            {values.map((value, index) => (
              <motion.div
                key={value.title}
                className="value"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <div className="value__accent" />
                <h3 className="value__title">{value.title}</h3>
                <p className="value__desc">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="section section--quote">
        <div className="section__container section__container--narrow">
          <motion.div 
            className="quote"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="quote__mark">"</div>
            <p className="quote__text">
              Technology should remove barriers, not create them. Every person deserves 
              to understand the world around them.
            </p>
            <div className="quote__divider" />
          </motion.div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="section section--alt">
        <div className="section__container">
          <div className="section__header">
            <span className="section__label">PRODUCT ROADMAP</span>
            <h2 className="section__title">Where We're Headed</h2>
            <div className="section__divider" />
          </div>

          <div className="roadmap">
            {roadmap.map((phase, index) => (
              <motion.div
                key={phase.phase}
                className={`roadmap__phase ${phase.status === 'Current' ? 'roadmap__phase--current' : ''}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <span className="roadmap__label">{phase.phase}</span>
                <h3 className="roadmap__title">{phase.title}</h3>
                <span className={`roadmap__status roadmap__status--${phase.status.toLowerCase()}`}>
                  {phase.status}
                </span>
                <ul className="roadmap__list">
                  {phase.items.map(item => (
                    <li key={item} className="roadmap__item">{item}</li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section section--cta">
        <div className="section__container">
          <motion.div 
            className="cta-block"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="cta-block__title">Try SonarAI Today</h2>
            <p className="cta-block__text">
              Experience the future of accessible vision. No download required.
            </p>
            <div className="cta-block__buttons">
              <Link to="/demo" className="btn btn--light">
                LAUNCH DEMO
                <svg className="btn__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <a 
                href="https://github.com/SaadSafeer4/sonarai" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn--outline-light"
              >
                VIEW ON GITHUB
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default About;

