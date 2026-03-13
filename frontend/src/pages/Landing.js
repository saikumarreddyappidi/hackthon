import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import FloatingBackground from '../components/FloatingBackground';
import PublicNavbar from '../components/PublicNavbar';
import { useAuth } from '../AuthContext';

export default function Landing() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="public-page">
      <FloatingBackground />
      <PublicNavbar />

      <section className="hero-section page-fade">
        <div className="hero-content">
          <p className="hero-kicker">🌿 MLNeurothon-2K26</p>
          <h1 className="hero-title">Smart Study Habit <span className="hero-gradient-word">Analyzer</span></h1>
          <p className="hero-tagline">
            Track sessions, visualize trends, predict readiness, and follow personalized study plans.
          </p>

          <div className="hero-cta">
            <Link to="/signup" className="btn btn-primary btn-lg">Get Started</Link>
            <Link to="/login" className="btn btn-outline btn-lg">View Demo</Link>
          </div>

          <div className="hero-stats">
            <div><strong>10+</strong><span>Core Features</span></div>
            <div><strong>ML</strong><span>Random Forest AI</span></div>
            <div><strong>9</strong><span>Interactive Pages</span></div>
          </div>
        </div>
      </section>
    </div>
  );
}
