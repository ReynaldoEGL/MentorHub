import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus2, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getApiError } from '../api/client';

const emptyForm = { topic: '', modality: 'presencial', location_or_link: '', start_at: '', end_at: '' };
const dateLabel = (value) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const inputLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function TutoriasPage() {
  const [offerings, setOfferings] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get('/tutorias');
    setOfferings(data.offerings);
  }, []);
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true); setMessage(''); setError('');
    try {
      const payload = {
        ...form,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
      };
      if (editingId) await api.put(`/tutorias/${editingId}`, payload);
      else await api.post('/tutorias', payload);
      setMessage(editingId ? 'Tutoría actualizada.' : 'Tutoría registrada. Administración podrá asignar un tutorado.');
      setForm(emptyForm); setEditingId(null);
      await load();
    } catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  const edit = (item) => {
    setEditingId(item.id); setError(''); setMessage('');
    setForm({
      topic: item.topic, modality: item.modality,
      location_or_link: item.location_or_link || '',
      start_at: inputLocal(item.start_at), end_at: inputLocal(item.end_at),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (item) => {
    if (!window.confirm(`¿Retirar la tutoría "${item.topic}"?`)) return;
    setBusy(true); setError(''); setMessage('');
    try { await api.delete(`/tutorias/${item.id}`); setMessage('Tutoría retirada.'); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  return <>
    <div className="page-heading"><div><span className="eyebrow">PLANIFICACIÓN ACADÉMICA</span>
      <h1>Mis tutorías ofertadas</h1><p>Publica una tutoría individual. Solo administración podrá asignar a un estudiante.</p>
    </div><Link className="button button-outline" to="/app/disponibilidad">Configurar disponibilidad</Link></div>
    {error && <div className="form-error detail-alert">{error}</div>}
    {message && <div className="form-success detail-alert">{message}</div>}
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-title"><h2><CalendarPlus2 size={18}/> {editingId ? 'Editar tutoría sin asignar' : 'Registrar una tutoría'}</h2></div>
      <p className="hint" style={{ marginBottom: 14 }}>Primero publica un bloque en Mi disponibilidad. La tutoría debe quedar dentro de ese horario y no empalmarse con otras.</p>
      <form className="form-grid" onSubmit={save}>
        <label className="field-full">Tema o materia<input required minLength={3} maxLength={180} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Ej. Asesoría de estructuras de datos"/></label>
        <label>Inicio<input required type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })}/></label>
        <label>Fin<input required type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })}/></label>
        <label>Modalidad<select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}><option value="presencial">Presencial</option><option value="en_linea">En línea</option></select></label>
        <label>Lugar o enlace<input maxLength={2000} value={form.location_or_link} onChange={(e) => setForm({ ...form, location_or_link: e.target.value })} placeholder="Aula o enlace de reunión"/></label>
        <div className="field-full form-actions">
          {editingId && <button type="button" className="button button-outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Descartar cambios</button>}
          <button className="button button-primary" disabled={busy}>{busy ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Publicar tutoría'}</button>
        </div>
      </form>
    </section>
    <section className="panel table-panel">
      <div className="panel-title"><h2>Tutorías publicadas</h2><span className="count-pill">{offerings.length}</span></div>
      <div className="table-scroll"><table><thead><tr><th>Materia</th><th>Fecha y hora</th><th>Modalidad</th><th>Estado</th><th>Estudiante asignado</th><th>Acciones</th></tr></thead><tbody>
        {offerings.map((item) => {
          const editable = item.status === 'abierta' && !item.appointment_id && new Date(item.start_at) > new Date();
          return <tr key={item.id}>
            <td><strong>{item.topic}</strong></td><td>{dateLabel(item.start_at)}</td>
            <td>{item.modality === 'en_linea' ? 'En línea' : 'Presencial'}</td>
            <td><span className={`status status-${item.status === 'cancelada' ? 'cancelada' : item.appointment_id ? 'confirmada' : 'solicitada'}`}>{item.status === 'cancelada' ? 'Retirada o cancelada' : item.appointment_id ? 'Asignada' : 'Pendiente de asignación'}</span></td>
            <td>{item.mentee_name || 'Sin asignar'}</td>
            <td><div className="action-row">
              {item.appointment_id ? <Link className="text-action" to={`/app/citas/${item.appointment_id}`}>Abrir cita</Link> : editable ? <>
                <button type="button" disabled={busy} className="icon-button" title="Editar tutoría" onClick={() => edit(item)}><Pencil size={15}/></button>
                <button type="button" disabled={busy} className="icon-button danger" title="Retirar tutoría" onClick={() => remove(item)}><Trash2 size={15}/></button>
              </> : '—'}
            </div></td>
          </tr>;
        })}
        {!offerings.length && <tr><td colSpan="6"><div className="empty-state">Aún no has publicado tutorías. Registra la primera en el formulario de arriba.</div></td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
