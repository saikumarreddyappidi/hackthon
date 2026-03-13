import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="public-nav">
      <div className="public-nav-inner">
        <Link to="/" className="public-logo">
          🎓 Study Analyzer
        </Link>

        <button className="nav-hamburger" onClick={() => setOpen(!open)} type="button" aria-label="Toggle navigation">
          ☰
        </button>

        <nav className={`public-links ${open ? 'open' : ''}`}>
          <NavLink to="/" onClick={() => setOpen(false)}>Home</NavLink>
          <NavLink to="/login" onClick={() => setOpen(false)}>Login</NavLink>
          <NavLink to="/signup" onClick={() => setOpen(false)}>Signup</NavLink>
        </nav>
      </div>
    </header>
  );
}
