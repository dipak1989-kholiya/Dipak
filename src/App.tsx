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

  return <StreamApp token={token} onLogout={handleLogout} />;
}
