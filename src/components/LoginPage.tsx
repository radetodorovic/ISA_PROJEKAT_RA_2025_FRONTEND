import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';

// Jednostavna login stranica: POST na /login, token iz Authorization headera ili body.token
const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Ako je već ulogovan, idi na home
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Pokušaj sa {email, password}, pa fallback na {username, password}
      let res;
      try {
        res = await api.post('/login', { email: emailOrUsername, password });
      } catch (err) {
        res = await api.post('/login', { username: emailOrUsername, password });
      }

      // Token iz Authorization headera
      const authHeader = (res.headers?.authorization || res.headers?.Authorization) as
        | string
        | undefined;
      let token: string | undefined;
      if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7);
      }
      // Ili iz body.token
      if (!token && typeof (res.data as any)?.token === 'string') {
        token = (res.data as any).token;
      }

      if (!token) throw new Error('Token nije pronađen u odgovoru servera');

      login(token);
      navigate('/', { replace: true }); // posle logina idi na početnu sa videima
    } catch (err: any) {
      setError(err?.message || 'Prijavljivanje nije uspelo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1 style={{ marginBottom: 12 }}>Login</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            placeholder="Email ili korisničko ime"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Lozinka"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Prijavljivanje…' : 'Login'}
          </button>
          {error && <div className="error">{error}</div>}
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
