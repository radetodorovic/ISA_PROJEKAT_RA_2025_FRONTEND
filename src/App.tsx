import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import VideoList from './components/VideoList';
import VideoPage from './components/VideoPage';
import LoginPage from './components/LoginPage';
import { useAuth } from './contexts/AuthContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/videos/:id" element={<VideoPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

const Header: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ background: 'linear-gradient(90deg,#4f46e5,#7c3aed)', padding: '12px 16px' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Jutjubić - Video Platform</Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/" style={{ color: '#fff' }}>All Videos</Link>
          {isAuthenticated ? (
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              Logout
            </button>
          ) : (
            <Link to="/login" style={{ color: '#fff' }}>Login</Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
