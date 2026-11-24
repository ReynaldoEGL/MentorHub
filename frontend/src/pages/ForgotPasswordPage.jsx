import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const { data } = await api.post('/auth/forgot-password', { email }); setMessage(data.message); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };
  return <div className="auth-screen"><section className="auth-aside"><div className="brand brand-light"><span className="brand-mark">M</span><span>Mentor<span className="brand-accent">Hub</span></span></div><div className="auth-pitch"><span className="eyebrow">RECUPERAR ACCESO</span><h1>Volvamos a conectar con tus objetivos.</h1><p>Te enviaremos instrucciones para restablecer la contraseña asociada a tu cuenta.</p></div></section><section className="auth-main"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">RECUPERACIÓN DE CUENTA</span><h2>¿Olvidaste tu contraseña?</h2><p>Ingresa el correo con el que te registraste.</p></div><form className="form-stack" onSubmit={submit}><label>Correo electrónico<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="nombre@correo.com"/></label>{message && <div className="form-success">{message}</div>}{error && <div className="form-error">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Enviando…' : 'Enviar instrucciones'}</button></form><p className="auth-switch"><Link to="/login">Volver a iniciar sesión</Link></p></div></section></div>;
}
