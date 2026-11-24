import { useEffect, useState } from 'react';
import { Download, Search, ShieldCheck, Users } from 'lucide-react';
import api, { getApiError } from '../api/client';

const roles = { admin: 'Administrador', mentor: 'Mentor', mentorado: 'Mentorado' };

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const [userResult, statsResult] = await Promise.all([
      api.get('/admin/usuarios', { params: { search } }), api.get('/admin/estadisticas'),
    ]);
    setUsers(userResult.data.users); setStats(statsResult.data.stats);
  };
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, [search]);

  const changeRole = async (userId, role) => {
    setBusyId(userId); setError('');
    try { await api.patch(`/admin/usuarios/${userId}/rol`, { role }); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const toggleActive = async (user) => {
    setBusyId(user.id); setError('');
    try { await api.patch(`/admin/usuarios/${user.id}/activo`, { is_active: !user.is_active }); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const exportCsv = async () => {
    try { const { data } = await api.get('/admin/reportes/citas.csv', { responseType: 'blob' }); const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = 'mentorhub-mentorias.csv'; a.click(); URL.revokeObjectURL(url); }
    catch (err) { setError(getApiError(err)); }
  };

  return <>
    <div className="page-heading"><div><span className="eyebrow">CONTROL DEL SISTEMA</span><h1>Administración</h1><p>Gestiona las cuentas, consulta indicadores y exporta el historial de mentorías.</p></div><button className="button button-primary" onClick={exportCsv}><Download size={15}/> Exportar citas CSV</button></div>
    {error && <div className="form-error detail-alert">{error}</div>}
    {stats && <div className="stats-grid admin-stats">{[
      ['Usuarios activos', stats.active_users], ['Mentores activos', stats.active_mentors],
      ['Mentorías registradas', stats.total_appointments], ['Por confirmar', stats.pending_appointments],
      ['Confirmadas', stats.confirmed_appointments], ['Realizadas', stats.completed_appointments],
      ['Documentos pendientes', stats.pending_documents], ['Total de usuarios', stats.total_users],
    ].map(([label, value]) => <div className="stat-card" key={label}><div className="stat-icon"><ShieldCheck size={18}/></div><span>{label}</span><strong>{value}</strong></div>)}</div>}
    <section className="panel table-panel"><div className="table-toolbar"><div className="panel-title"><h2><Users size={17}/> Usuarios</h2></div><div className="admin-search"><Search size={15}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nombre o correo"/></div></div>
      <div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
        {users.map((item) => <tr key={item.id}><td><strong>{item.full_name}</strong><span className="table-sub">Alta: {new Date(item.created_at).toLocaleDateString('es-MX')}</span></td><td>{item.email}</td><td><select className="role-select" value={item.role} disabled={busyId === item.id} onChange={(e) => changeRole(item.id, e.target.value)}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><span className={`status ${item.is_active ? 'status-realizada' : 'status-cancelada'}`}>{item.is_active ? 'Activo' : 'Inactivo'}</span></td><td><button className={`button button-small ${item.is_active ? 'button-outline-danger' : 'button-primary'}`} disabled={busyId === item.id} onClick={() => toggleActive(item)}>{item.is_active ? 'Desactivar' : 'Activar'}</button></td></tr>)}
        {!users.length && <tr><td colSpan="5"><div className="empty-state">No hay usuarios para mostrar.</div></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
