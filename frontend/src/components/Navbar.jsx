import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LogoMark, IconQuiz } from './Icons.jsx';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/');
  }

  function isActive(path) {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  }

  return (
    <nav className="nav">
      <Link to="/" className="nav-brand">
        <LogoMark size={28} />
        <span className="nav-brand-text">
          Connectomic <strong>Medical Academy</strong>
        </span>
      </Link>
      <div className="nav-links">
        {currentUser && <Link className={`nav-btn ${isActive('/sections') ? 'active' : ''}`} to="/sections">Sections</Link>}
        {currentUser?.role === 'student' && <Link className={`nav-btn ${isActive('/tests') ? 'active' : ''}`} to="/tests">Test Centre</Link>}
        {currentUser?.role === 'faculty' && <Link className={`nav-btn ${isActive('/faculty') ? 'active' : ''}`} to="/faculty">Faculty Hub</Link>}
        {currentUser?.role === 'admin' && <Link className={`nav-btn ${isActive('/admin') ? 'active' : ''}`} to="/admin">Admin</Link>}
        {!currentUser && <Link className="nav-btn" to="/login">Login</Link>}
        {!currentUser && <Link className="nav-btn nav-btn-cta" to="/register">Register</Link>}
        {currentUser && <button className="nav-btn" onClick={handleLogout}>Log out</button>}
      </div>
    </nav>
  );
}
