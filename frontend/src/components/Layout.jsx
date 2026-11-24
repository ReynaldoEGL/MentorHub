import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Bell, CalendarDays, GraduationCap, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const roleLabels = { admin: 'Administrador', mentor: 'Mentor', mentorado: 'Mentorado' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    api.get('/notificaciones').then(({ data }) => { setNotifications(data.notifications); setUnread(data.unread); }).catch(() => {});
  }, []);
  const links = [
    { to: '/app', label: 'Resumen', icon: LayoutDashboard, end: true },
    ...(user?.role === 'mentor' ? [{ to: '/app/tutorias', label: 'Mis tutorías ofertadas', icon: GraduationCap }] : []),
    ...(user?.role === 'mentor' ? [{ to: '/app/disponibilidad', label: 'Mi disponibilidad', icon: CalendarDays }] : []),
    { to: '/app/citas', label: user?.role === 'admin' ? 'Todas las tutorías' : 'Mis tutorías asignadas', icon: GraduationCap },
    { to: '/app/documentos', label: 'Documentos', icon: Bell },
    ...(user?.role === 'admin' ? [{ to: '/app/admin', label: 'Administración', icon: Settings }] : []),
  ];

  const openNotification = async (item) => {
    try { await api.patch(`/notificaciones/${item.id}/leer`); } catch {}
    setNotifications((old) => old.map((notice) => notice.id === item.id ? { ...notice, is_read: true } : notice));
    setUnread((count) => Math.max(0, count - (item.is_read ? 0 : 1)));
    setNotificationsOpen(false);
    if (item.resource_type === 'appointment' || item.resource_type === 'evidence') navigate(`/app/citas/${item.resource_id}`);
    else if (item.resource_type === 'document_request') navigate('/app/documentos');
  };

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
        <header className="topbar"><div><span className="topbar-kicker">PLATAFORMA ACADÉMICA</span><strong>Tu espacio de mentoría</strong></div><div className="topbar-user"><div className="notification-wrap"><button className="notification-button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notificaciones"><Bell size={18}/>{unread > 0 && <span className="notification-dot">{unread > 9 ? '9+' : unread}</span>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-head"><strong>Notificaciones</strong><button onClick={async () => { await api.patch('/notificaciones/leer-todas'); setNotifications((old) => old.map((item) => ({ ...item, is_read: true }))); setUnread(0); }}>Marcar leídas</button></div>{notifications.slice(0, 8).map((item) => <button key={item.id} className={`notification-item ${item.is_read ? '' : 'unread'}`} onClick={() => openNotification(item)}><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString('es-MX')}</small></button>)}{!notifications.length && <p className="empty-state">Todavía no tienes notificaciones.</p>}</div>}</div><span>{user?.full_name}</span><div className="avatar avatar-small">{user?.full_name?.slice(0, 1).toUpperCase()}</div></div></header>
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  );
}
