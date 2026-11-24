import { useCallback, useEffect, useState } from 'react';
import { Download, Search, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/client';

const roles = { admin: 'Administrador', mentor: 'Mentor', mentorado: 'Tutorado' };
const formatted = (value) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [offerings, setOfferings] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [selectedMentees, setSelectedMentees] = useState({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [userResult, statsResult, offerResult, menteeResult] = await Promise.all([
      api.get('/admin/usuarios', { params: { search } }),
      api.get('/admin/estadisticas'),
      api.get('/tutorias'),
      api.get('/tutorias/tutorados'),
    ]);
    setUsers(userResult.data.users);
    setStats(statsResult.data.stats);
    setOfferings(offerResult.data.offerings);
    setMentees(menteeResult.data.mentees);
  }, [search]);
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, [load]);

  const changeRole = async (userId, role) => {
    setBusyId(userId); setError(''); setMessage('');
    try { await api.patch(`/admin/usuarios/${userId}/rol`, { role }); await load(); setMessage('Rol actualizado.'); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const toggleActive = async (user) => {
    setBusyId(user.id); setError(''); setMessage('');
    try { await api.patch(`/admin/usuarios/${user.id}/activo`, { is_active: !user.is_active }); await load(); setMessage('Estado de la cuenta actualizado.'); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const assign = async (item) => {
    const menteeId = selectedMentees[item.id];
    if (!menteeId) return setError('Primero selecciona un tutorado.');
    if (!window.confirm(`¿Asignar al tutorado seleccionado a "${item.topic}"?`)) return;
    setBusyId(item.id); setError(''); setMessage('');
    try {
      await api.post(`/tutorias/${item.id}/asignar`, { mentee_id: menteeId });
      setMessage('Asignación individual realizada. Mentor y tutorado fueron notificados.');
      setSelectedMentees((old) => ({ ...old, [item.id]: '' }));
      await load();
    } catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const exportCsv = async () => {
    setError('');
    try {
      const { data } = await api.get('/admin/reportes/citas.csv', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a'); link.href = url; link.download = 'mentorhub-tutorias.csv'; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(getApiError(err)); }
  };

  const unassigned = offerings.filter((item) => item.status === 'abierta' && !item.appointment_id && new Date(item.start_at) > new Date());
  return <>
    <div className="page-heading"><div><span className="eyebrow">CONTROL DEL SISTEMA</span><h1>Administración</h1>
      <p>Solo el administrador asigna estudiantes a las tutorías individuales registradas por los mentores.</p></div>
      <button className="button button-primary" onClick={exportCsv}><Download size={15}/> Exportar CSV</button></div>
    {error && <div className="form-error detail-alert">{error}</div>}
    {message && <div className="form-success detail-alert">{message}</div>}
    {stats && <div className="stats-grid admin-stats">{[
      ['Usuarios activos', stats.active_users], ['Mentores activos', stats.active_mentors],
      ['Tutorías asignadas', stats.total_appointments], ['Ofertas sin asignar', unassigned.length],
      ['Confirmadas', stats.confirmed_appointments], ['Realizadas', stats.completed_appointments],
      ['Documentos pendientes', stats.pending_documents], ['Total de usuarios', stats.total_users],
    ].map(([label, value]) => <div className="stat-card" key={label}><div className="stat-icon"><ShieldCheck size={18}/></div><span>{label}</span><strong>{value}</strong></div>)}</div>}

    <section className="panel table-panel" style={{ marginBottom: 20 }}>
      <div className="table-toolbar"><div className="panel-title"><h2>Asignación de tutorías individuales</h2></div><span className="count-pill">{unassigned.length} disponibles</span></div>
      <p className="hint" style={{ margin: '6px 0 15px' }}>El mentor registra una tutoría con una sola plaza. Selecciona a un tutorado activo y confirma la asignación. Después podrás consultar la cita en Todas las tutorías.</p>
      <div className="table-scroll"><table><thead><tr><th>Tutoría</th><th>Mentor</th><th>Fecha</th><th>Estado</th><th>Tutorado</th><th>Acción</th></tr></thead><tbody>
        {offerings.map((item) => {
          const available = item.status === 'abierta' && !item.appointment_id && new Date(item.start_at) > new Date();
          const status = item.status === 'cancelada' ? 'Retirada o cancelada' : item.appointment_id ? 'Asignada' : available ? 'Sin asignar' : 'Vencida';
          return <tr key={item.id}>
            <td><strong>{item.topic}</strong><span className="table-sub">{item.modality === 'en_linea' ? 'En línea' : 'Presencial'}</span></td>
            <td>{item.mentor_name}</td><td>{formatted(item.start_at)}</td>
            <td><span className={`status status-${item.appointment_id ? 'confirmada' : item.status === 'cancelada' ? 'cancelada' : 'solicitada'}`}>{status}</span></td>
            <td>{item.mentee_name || (available ? <select className="compact-select" aria-label={`Tutorado para ${item.topic}`} value={selectedMentees[item.id] || ''} onChange={(e) => setSelectedMentees((old) => ({ ...old, [item.id]: e.target.value }))}>
              <option value="">Seleccionar tutorado</option>
              {mentees.map((mentee) => <option key={mentee.id} value={mentee.id}>{mentee.full_name} ({mentee.email})</option>)}
            </select> : '—')}</td>
            <td>{available ? <button className="button button-small" disabled={busyId === item.id || !selectedMentees[item.id]} onClick={() => assign(item)}>Asignar</button>
              : item.appointment_id ? <Link className="text-action" to={`/app/citas/${item.appointment_id}`}>Abrir cita</Link> : '—'}</td>
          </tr>;
        })}
        {!offerings.length && <tr><td colSpan="6"><div className="empty-state">No hay tutorías publicadas. Pide a un mentor que configure su disponibilidad y registre una tutoría.</div></td></tr>}
      </tbody></table></div>
    </section>

    <section className="panel table-panel"><div className="table-toolbar"><div className="panel-title"><h2><Users size={17}/> Cuentas y roles</h2></div>
      <div className="admin-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o correo"/></div></div>
      <div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
        {users.map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong><span className="table-sub">Alta: {new Date(item.created_at).toLocaleDateString('es-MX')}</span></td>
          <td>{item.email}</td><td><select className="role-select" value={item.role} disabled={busyId === item.id} onChange={(e) => changeRole(item.id, e.target.value)}>
            {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></td><td><span className={`status ${item.is_active ? 'status-realizada' : 'status-cancelada'}`}>{item.is_active ? 'Activo' : 'Inactivo'}</span></td>
          <td><button className={`button button-small ${item.is_active ? 'button-outline-danger' : 'button-primary'}`} disabled={busyId === item.id} onClick={() => toggleActive(item)}>{item.is_active ? 'Desactivar' : 'Activar'}</button></td></tr>)}
        {!users.length && <tr><td colSpan="5"><div className="empty-state">No hay usuarios para mostrar.</div></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
