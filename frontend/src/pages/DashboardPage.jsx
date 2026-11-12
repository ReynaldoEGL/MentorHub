import { ArrowUpRight, BookOpen, Compass, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(' ')[0] || 'bienvenido';
  return <>
    <div className="page-heading"><div><span className="eyebrow">VERSIÓN 2 · CUENTAS Y PERFILES</span><h1>Hola, {firstName}</h1><p>Tu espacio académico ya está personalizado con tu cuenta y rol.</p></div>{user?.role === 'mentorado' && <Link className="button button-primary" to="/app/mentores">Explorar mentores <ArrowUpRight size={16}/></Link>}</div>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-icon"><UsersRound size={19}/></div><span>Tu tipo de cuenta</span><strong className="stat-text">{user?.role === 'mentor' ? 'Mentor' : user?.role === 'admin' ? 'Admin' : 'Mentorado'}</strong></div>
      <div className="stat-card"><div className="stat-icon"><ShieldCheck size={19}/></div><span>Sesión</span><strong className="stat-text">Activa</strong></div>
      <div className="stat-card"><div className="stat-icon"><BookOpen size={19}/></div><span>Perfil</span><strong className="stat-text">Registrado</strong></div>
    </div>
    <div className="two-column-layout v2-grid">
      <section className="panel"><div className="panel-title"><div><span className="eyebrow">TU CUENTA</span><h2>Perfil de usuario</h2></div><div className="avatar avatar-large">{user?.full_name?.slice(0,1).toUpperCase()}</div></div><div className="detail-grid"><div><span>Nombre completo</span><strong>{user?.full_name}</strong></div><div><span>Correo</span><strong>{user?.email}</strong></div><div><span>Rol asignado</span><strong>{user?.role}</strong></div><div><span>Estado</span><strong className="good-text">Cuenta activa</strong></div></div></section>
      <section className="panel welcome-panel"><div className="welcome-icon"><Compass size={22}/></div><span className="eyebrow">SIGUIENTE PASO</span><h2>{user?.role === 'mentorado' ? 'Encuentra a tu mentor ideal' : 'Prepara tu perfil académico'}</h2><p>{user?.role === 'mentorado' ? 'Explora perfiles y áreas de acompañamiento para encontrar el apoyo que necesitas.' : 'Completa tu información para que la comunidad pueda conocerte mejor.'}</p>{user?.role === 'mentorado' && <Link className="text-action" to="/app/mentores">Ir al directorio <ArrowUpRight size={15}/></Link>}</section>
    </div>
  </>;
}
