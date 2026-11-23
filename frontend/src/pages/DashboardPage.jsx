import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, GraduationCap, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getApiError } from '../api/client';

const labels = { solicitada: 'Solicitada', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', realizada: 'Realizada' };
const dateLabel = (date) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

export default function DashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/citas').then(({ data }) => setAppointments(data.appointments)).catch((err) => setError(getApiError(err)));
    if (user?.role === 'admin') api.get('/admin/estadisticas').then(({ data }) => setStats(data.stats)).catch(() => {});
  }, [user]);
  const upcoming = appointments.filter((item) => ['solicitada', 'confirmada'].includes(item.status) && new Date(item.start_at) >= new Date()).slice(0, 4);
  const count = (status) => appointments.filter((item) => item.status === status).length;
  const cards = user?.role === 'admin' && stats ? [
    { label: 'Usuarios activos', value: stats.active_users, icon: UserRound },
    { label: 'Mentorías registradas', value: stats.total_appointments, icon: GraduationCap },
    { label: 'Por confirmar', value: stats.pending_appointments, icon: Clock3 },
    { label: 'Documentos pendientes', value: stats.pending_documents, icon: CheckCircle2 },
  ] : [
    { label: 'Total de mentorías', value: appointments.length, icon: GraduationCap },
    { label: 'Solicitadas', value: count('solicitada'), icon: Clock3 },
    { label: 'Confirmadas', value: count('confirmada'), icon: CalendarDays },
    { label: 'Realizadas', value: count('realizada'), icon: CheckCircle2 },
  ];
  return <>
    <div className="page-heading"><div><span className="eyebrow">PANEL PRINCIPAL</span><h1>Hola, {user?.full_name?.split(' ')[0]}</h1><p>Este es el resumen de tu actividad académica en MentorHub.</p></div>{user?.role === 'mentorado' && <Link className="button button-primary" to="/app/mentores">Buscar mentor <ArrowUpRight size={16}/></Link>}</div>
    {error && <div className="form-error">{error}</div>}
    <div className="stats-grid">{cards.map(({ label, value, icon: Icon }) => <div className="stat-card" key={label}><div className="stat-icon"><Icon size={19}/></div><span>{label}</span><strong>{value ?? '—'}</strong></div>)}</div>
    <section className="panel upcoming-panel"><div className="panel-title"><div><span className="eyebrow">AGENDA</span><h2>Próximas mentorías</h2></div><Link className="text-action" to="/app/citas">Ver todas <ArrowUpRight size={15}/></Link></div>
      <div className="upcoming-list">{upcoming.map((item) => <div className="upcoming-row" key={item.id}><div className="date-block"><strong>{new Date(item.start_at).toLocaleDateString('es-MX', { day: '2-digit' })}</strong><span>{new Date(item.start_at).toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')}</span></div><div className="upcoming-copy"><strong>{item.topic}</strong><span>{user?.role === 'mentor' ? item.mentee_name : item.mentor_name} · {dateLabel(item.start_at)}</span></div><span className={`status status-${item.status}`}>{labels[item.status]}</span></div>)}{!upcoming.length && <div className="empty-state"><CalendarDays size={22}/><strong>No tienes mentorías próximas</strong><span>Las solicitudes y sesiones aparecerán aquí.</span></div>}</div>
    </section>
  </>;
}
