import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Home = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut",
      },
    },
  };

  const features = [
    {
      icon: "🎤",
      title: "Voice First",
      description: "Fully usable without looking at the screen. Just speak and listen."
    },
    {
      icon: "👁️",
      title: "Scene Understanding",
      description: "AI-powered vision that describes your surroundings with spatial awareness."
    },
    {
      icon: "🧠",
      title: "Short-Term Memory",
      description: "Ask follow-up questions. The system remembers what it saw."
    },
    {
      icon: "🎧",
      title: "Audio Narration",
      description: "Clear, conversational descriptions optimized for safety."
    }
  ];

  const steps = [
    { num: "01", title: "Tap to Speak", desc: "Press the button and ask what's around you." },
    { num: "02", title: "AI Analyzes", desc: "Camera captures the scene, AI understands it." },
    { num: "03", title: "Listen", desc: "Receive a clear, spatial description via voice." },
  ];

  return (
    <div className="home">
      {/* Hero Section */}
      <motion.section 
        className="hero"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="hero__content">
          <motion.span className="hero__badge" variants={itemVariants}>
            ACCESSIBILITY AI
          </motion.span>
          
          <motion.h1 className="hero__title" variants={itemVariants}>
            See the World<br />
            <span className="hero__title-accent">Through Sound</span>
          </motion.h1>
          
          <motion.div className="hero__divider" variants={itemVariants} />
          
          <motion.p className="hero__subtitle" variants={itemVariants}>
            SonarAI helps blind and low-vision users understand their surroundings 
            through voice interaction. The intelligence layer for future smart glasses.
          </motion.p>
          
          <motion.div className="hero__ctas" variants={itemVariants}>
            <Link to="/demo" className="btn btn--primary">
              TRY THE DEMO
              <svg className="btn__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link to="/about" className="btn btn--secondary">
              LEARN MORE
            </Link>
          </motion.div>
        </div>

        <motion.div 
          className="hero__visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="hero__visual-circle">
            <div className="hero__visual-pulse" />
            <div className="hero__visual-icon">◉</div>
          </div>
        </motion.div>
      </motion.section>

      {/* How It Works */}
      <section className="section section--alt">
        <div className="section__container">
          <div className="section__header">
            <span className="section__label">HOW IT WORKS</span>
            <h2 className="section__title">Three Simple Steps</h2>
            <div className="section__divider" />
          </div>

          <div className="steps">
            {steps.map((step, index) => (
              <motion.div 
                key={step.num}
                className="step"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <span className="step__num">{step.num}</span>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__desc">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="section">
        <div className="section__container">
          <div className="section__header">
            <span className="section__label">FEATURES</span>
            <h2 className="section__title">Built for Accessibility</h2>
            <div className="section__divider" />
          </div>

          <div className="features">
            {features.map((feature, index) => (
              <motion.div 
                key={feature.title}
                className="feature"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <span className="feature__icon">{feature.icon}</span>
                <h3 className="feature__title">{feature.title}</h3>
                <p className="feature__desc">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiator Section */}
      <section className="section section--highlight">
        <div className="section__container">
          <motion.div 
            className="highlight"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="highlight__label">KEY DIFFERENTIATOR</span>
            <h2 className="highlight__title">Short-Term Memory</h2>
            <div className="highlight__divider" />
            <p className="highlight__text">
              Unlike existing solutions, SonarAI remembers what it saw. Ask "What's around me?" 
              and then follow up with "Where was the chair you mentioned?" — and get a contextual answer.
            </p>
            <p className="highlight__text">
              This simple feature transforms the experience from a one-shot query to a natural conversation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section section--cta">
        <div className="section__container">
          <motion.div 
            className="cta-block"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="cta-block__title">Experience It Yourself</h2>
            <p className="cta-block__text">
              Try the demo now. All you need is a browser, camera, and microphone.
            </p>
            <Link to="/demo" className="btn btn--light">
              LAUNCH DEMO
              <svg className="btn__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;

