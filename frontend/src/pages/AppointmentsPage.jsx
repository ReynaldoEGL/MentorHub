import { useEffect, useState } from 'react';
import { CircleX, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const statuses = { solicitada: 'Pendiente antigua', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', realizada: 'Realizada' };
const formatDate = (value) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('todas');
  const [busy, setBusy] = useState(false);
  const load = async () => { const { data } = await api.get('/citas'); setAppointments(data.appointments); };
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, []);

  const updateStatus = async (item, status) => {
    if (status === 'cancelada' && !window.confirm(`¿Cancelar la tutoría "${item.topic}"? Esta asignación quedará en el historial.`)) return;
    setError(''); setMessage(''); setBusy(true);
    try {
      await api.patch(`/citas/${item.id}/estado`, { status });
      setMessage('Estado actualizado correctamente.'); await load();
    } catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  const filtered = appointments.filter((item) => filter === 'todas' || item.status === filter);
  return <>
    <div className="page-heading"><div><span className="eyebrow">SEGUIMIENTO</span><h1>{user?.role === 'admin' ? 'Todas las tutorías' : 'Mis tutorías asignadas'}</h1>
      <p>{user?.role === 'mentorado' ? 'Aquí aparecen las tutorías que te asigne administración.' : 'Consulta las tutorías individuales y da seguimiento a las sesiones.'}</p></div>
      <div className="count-card"><strong>{appointments.length}</strong><span>sesiones registradas</span></div></div>
    {error && <div className="form-error detail-alert">{error}</div>}
    {message && <div className="form-success detail-alert">{message}</div>}
    <section className="panel table-panel"><div className="table-toolbar"><div className="panel-title"><h2>Historial de tutorías</h2></div>
      <select className="compact-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="todas">Todos los estados</option>
        {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></div>
      <div className="table-scroll"><table><thead><tr><th>Tutoría</th><th>Mentor</th><th>Tutorado</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id}><td><strong>{item.topic}</strong><span className="table-sub">{item.modality === 'en_linea' ? 'En línea' : 'Presencial'}</span></td>
          <td>{item.mentor_name}</td><td>{item.mentee_name}</td><td>{formatDate(item.start_at)}<span className="table-sub">hasta {new Date(item.end_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></td>
          <td><span className={`status status-${item.status}`}>{statuses[item.status]}</span></td><td><div className="action-row"><Link className="text-action" to={`/app/citas/${item.id}`} title="Ver detalles"><ExternalLink size={15}/> Abrir</Link>
            {user?.role === 'mentor' && item.status === 'confirmada' && new Date(item.end_at) <= new Date() && <button disabled={busy} className="button button-small" onClick={() => updateStatus(item, 'realizada')}>Marcar realizada</button>}
            {user?.role === 'admin' && item.status === 'solicitada' && <><button disabled={busy} className="button button-small" onClick={() => updateStatus(item, 'confirmada')}>Aceptar antigua</button><button disabled={busy} className="button button-small" onClick={() => updateStatus(item, 'rechazada')}>Rechazar</button></>}
            {user?.role === 'admin' && ['solicitada','confirmada'].includes(item.status) && <button disabled={busy} className="icon-button danger" onClick={() => updateStatus(item, 'cancelada')} title="Cancelar asignación"><CircleX size={15}/></button>}
          </div></td></tr>)}
        {!filtered.length && <tr><td colSpan="6"><div className="empty-state">No hay tutorías para este filtro.</div></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
