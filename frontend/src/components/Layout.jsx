import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, GraduationCap, LayoutDashboard, LogOut, Search, Settings, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const roleLabels = { admin: 'Administrador', mentor: 'Mentor', mentorado: 'Mentorado' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = [
    { to: '/app', label: 'Resumen', icon: LayoutDashboard, end: true },
    ...(user?.role === 'mentorado' ? [{ to: '/app/mentores', label: 'Buscar mentores', icon: Search }] : []),
    ...(user?.role === 'mentor' ? [{ to: '/app/disponibilidad', label: 'Mi disponibilidad', icon: CalendarDays }] : []),
    { to: '/app/citas', label: 'Mis mentorías', icon: GraduationCap },
    { to: '/app/documentos', label: 'Documentos', icon: Bell },
    ...(user?.role === 'admin' ? [{ to: '/app/admin', label: 'Administración', icon: Settings }] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">M</span><span>Mentor<span className="brand-accent">Hub</span></span></div>
        <div className="sidebar-label">ESPACIO DE TRABAJO</div>
        <nav className="side-nav">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini"><div className="avatar">{user?.full_name?.slice(0, 1).toUpperCase()}</div><div className="profile-copy"><strong>{user?.full_name}</strong><span>{roleLabels[user?.role]}</span></div></div>
          <button className="nav-link logout-link" onClick={handleLogout}><LogOut size={18} /><span>Cerrar sesión</span></button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div><span className="topbar-kicker">PLATAFORMA ACADÉMICA</span><strong>Tu espacio de mentoría</strong></div><div className="topbar-user"><span>{user?.full_name}</span><div className="avatar avatar-small">{user?.full_name?.slice(0, 1).toUpperCase()}</div></div></header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
