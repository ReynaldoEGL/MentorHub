import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../api/client';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError(''); setBusy(true);
    try { await login(form); navigate('/app'); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  return <div className="auth-screen"><section className="auth-aside"><div className="brand brand-light"><span className="brand-mark">M</span><span>Mentor<span className="brand-accent">Hub</span></span></div><div className="auth-pitch"><span className="eyebrow">APRENDER EN COMUNIDAD</span><h1>El siguiente paso en tu desarrollo académico comienza aquí.</h1><p>Conecta con mentores, agenda sesiones y mantén tus avances organizados en un solo lugar.</p></div><div className="aside-footer"><GraduationCap size={18} /> Mentorías con propósito.</div></section><section className="auth-main"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">BIENVENIDO DE NUEVO</span><h2>Iniciar sesión</h2><p>Ingresa tus datos para continuar.</p></div><form onSubmit={submit} className="form-stack"><label>Correo electrónico<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="nombre@correo.com" /></label><label>Contraseña<input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required placeholder="Tu contraseña" /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Ingresando…' : 'Entrar'} <ArrowRight size={17} /></button></form><p className="auth-switch">¿Aún no tienes cuenta? <Link to="/registro">Crear una cuenta</Link></p></div></section></div>;
}
