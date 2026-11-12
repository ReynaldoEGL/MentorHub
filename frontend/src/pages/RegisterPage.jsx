import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../api/client';

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await register(form); navigate('/app'); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  return <div className="auth-screen"><section className="auth-aside"><div className="brand brand-light"><span className="brand-mark">M</span><span>Mentor<span className="brand-accent">Hub</span></span></div><div className="auth-pitch"><span className="eyebrow">TU COMUNIDAD ACADÉMICA</span><h1>Aprender acompañado hace la diferencia.</h1><p>Crea tu espacio para organizar sesiones, compartir avances y dar seguimiento a tus objetivos.</p></div><div className="aside-footer">Una comunidad para crecer.</div></section><section className="auth-main"><div className="auth-card"><div className="auth-heading"><span className="eyebrow">ÚNETE A MENTORHUB</span><h2>Crear cuenta</h2><p>El registro inicial crea una cuenta de mentorado.</p></div><form onSubmit={submit} className="form-stack"><label>Nombre completo<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required minLength={3} maxLength={140} placeholder="Tu nombre" /></label><label>Correo electrónico<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="nombre@correo.com" /></label><label>Contraseña<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="Mínimo 8 caracteres" /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-wide" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'} <ArrowRight size={17} /></button></form><p className="auth-switch">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p></div></section></div>;
}
