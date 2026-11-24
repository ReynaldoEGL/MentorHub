import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { getApiError } from '../api/client';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const { data } = await api.post('/auth/reset-password', { token, password }); setMessage(data.message); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };
  return <div className="auth-screen"><section className="auth-aside"><div className="brand brand-light"><span className="brand-mark">M</span><span>Mentor<span className="brand-accent">Hub</span></span></div><div className="auth-pitch"><span className="eyebrow">SEGURIDAD DE TU CUENTA</span><h1>Una nueva contraseña para continuar.</h1><p>El enlace de recuperación tiene una vigencia limitada por seguridad.</p></div></section><section className="auth-main"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">RESTABLECER CONTRASEÑA</span><h2>Crear nueva contraseña</h2><p>Utiliza al menos ocho caracteres.</p></div><form className="form-stack" onSubmit={submit}><label>Nueva contraseña<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres"/></label>{!token && <div className="form-error">No se encontró el token del enlace. Solicita uno nuevo.</div>}{message && <div className="form-success">{message}</div>}{error && <div className="form-error">{error}</div>}<button className="button button-primary button-wide" disabled={busy || !token}>{busy ? 'Actualizando…' : 'Actualizar contraseña'}</button></form><p className="auth-switch"><Link to="/login">Volver a iniciar sesión</Link></p></div></section></div>;
}
