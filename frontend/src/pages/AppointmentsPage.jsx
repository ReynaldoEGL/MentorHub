import { useEffect, useState } from 'react';
import { CalendarClock, Check, CircleX, Clock3, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const statuses = { solicitada: 'Solicitada', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', realizada: 'Realizada' };
const formatDate = (value) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('todas');

  const load = async () => { const { data } = await api.get('/citas'); setAppointments(data.appointments); };
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, []);

  const updateStatus = async (id, status) => {
    setError('');
    try { await api.patch(`/citas/${id}/estado`, { status }); await load(); }
    catch (err) { setError(getApiError(err)); }
  };

  const filtered = appointments.filter((item) => filter === 'todas' || item.status === filter);
  return <>
    <div className="page-heading"><div><span className="eyebrow">SEGUIMIENTO</span><h1>Mis mentorías</h1><p>Consulta tus sesiones, revisa solicitudes y da seguimiento a cada encuentro.</p></div><div className="count-card"><strong>{appointments.length}</strong><span>sesiones registradas</span></div></div>
    <section className="panel table-panel">
      <div className="table-toolbar"><div className="panel-title"><h2>Historial de citas</h2></div><select className="compact-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="todas">Todos los estados</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {error && <div className="form-error">{error}</div>}
      <div className="table-scroll"><table><thead><tr><th>Mentoría</th><th>{user?.role === 'mentor' ? 'Mentorado' : 'Mentor'}</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id}><td><strong>{item.topic}</strong><span className="table-sub">{item.modality === 'en_linea' ? 'En línea' : 'Presencial'}</span></td><td>{user?.role === 'mentor' ? item.mentee_name : item.mentor_name}</td><td>{formatDate(item.start_at)}<span className="table-sub">a {new Date(item.end_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></td><td><span className={`status status-${item.status}`}>{statuses[item.status]}</span></td><td><div className="action-row"><Link className="text-action" to={`/app/citas/${item.id}`} title="Ver detalles"><ExternalLink size={15}/></Link>
          {user?.role === 'mentor' && item.status === 'solicitada' && <><button className="icon-button success" onClick={() => updateStatus(item.id, 'confirmada')} title="Confirmar"><Check size={15}/></button><button className="icon-button danger" onClick={() => updateStatus(item.id, 'rechazada')} title="Rechazar"><CircleX size={15}/></button></>}
          {user?.role === 'mentor' && item.status === 'confirmada' && <button className="button button-small" onClick={() => updateStatus(item.id, 'realizada')}>Marcar realizada</button>}
          {['mentor','mentorado'].includes(user?.role) && ['solicitada','confirmada'].includes(item.status) && <button className="icon-button danger" onClick={() => updateStatus(item.id, 'cancelada')} title="Cancelar"><CircleX size={15}/></button>}
        </div></td></tr>)}
        {!filtered.length && <tr><td colSpan="5"><div className="empty-state">No hay mentorías para este filtro.</div></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
