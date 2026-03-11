import { useState, useEffect } from 'react';
import StreamApp from './StreamApp';
import Login from './Login';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('stream_token'));

  useEffect(() => {
    if (token) {
      localStorage.setItem('stream_token', token);
    } else {
      localStorage.removeItem('stream_token');
    }
  }, [token]);

  const handleLogout = () => {
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  let username = '';
  try {
    const base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) {
      if (pad === 1) throw new Error('Invalid base64 string');
      base64 += new Array(5 - pad).join('=');
    }
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    username = payload.username;
  } catch (e) {
    localStorage.removeItem('stream_token');
    return <Login onLogin={setToken} />;
  }

  return <StreamApp token={token} username={username} onLogout={handleLogout} />;
}
