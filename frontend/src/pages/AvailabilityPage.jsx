import { useEffect, useState } from 'react';
import { CalendarPlus, Clock3, Trash2 } from 'lucide-react';
import api, { getApiError } from '../api/client';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const blank = { kind: 'weekly', weekday: '1', specific_date: '', start_time: '09:00', end_time: '13:00', active_from: '', active_until: '' };

export default function AvailabilityPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => { const { data } = await api.get('/disponibilidad/mia'); setItems(data.availabilities); };
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, []);

  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const body = { start_time: form.start_time, end_time: form.end_time, active_from: form.active_from || null, active_until: form.active_until || null };
      if (form.kind === 'weekly') body.weekday = Number(form.weekday); else body.specific_date = form.specific_date;
      await api.post('/disponibilidad', body);
      setMessage('Bloque de disponibilidad agregado.'); setForm(blank); await load();
    } catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('¿Eliminar este bloque de disponibilidad?')) return;
    try { await api.delete(`/disponibilidad/${id}`); await load(); }
    catch (err) { setError(getApiError(err)); }
  };

  return <>
    <div className="page-heading"><div><span className="eyebrow">AGENDA DEL MENTOR</span><h1>Mi disponibilidad</h1><p>Publica horarios recurrentes o fechas específicas para que los mentorados puedan solicitar sesiones.</p></div></div>
    <div className="two-column-layout">
      <section className="panel form-panel"><div className="panel-title"><h2><CalendarPlus size={18}/> Agregar horario</h2></div>
        <form className="form-grid" onSubmit={submit}>
          <label className="field-full">Tipo de disponibilidad<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="weekly">Recurrente semanal</option><option value="date">Fecha específica</option></select></label>
          {form.kind === 'weekly' ? <label className="field-full">Día de la semana<select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })}>{dayLabels.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label> : <label className="field-full">Fecha<input type="date" value={form.specific_date} onChange={(e) => setForm({ ...form, specific_date: e.target.value })} required/></label>}
          <label>Hora de inicio<input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required/></label>
          <label>Hora de fin<input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required/></label>
          {form.kind === 'weekly' && <><label>Vigente desde (opcional)<input type="date" value={form.active_from} onChange={(e) => setForm({ ...form, active_from: e.target.value })}/></label><label>Vigente hasta (opcional)<input type="date" value={form.active_until} onChange={(e) => setForm({ ...form, active_until: e.target.value })}/></label></>}
          {message && <div className="form-success field-full">{message}</div>}{error && <div className="form-error field-full">{error}</div>}
          <div className="field-full"><button className="button button-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar disponibilidad'}</button></div>
        </form>
      </section>
      <section className="panel list-panel"><div className="panel-title"><h2>Horarios publicados</h2><span className="count-pill">{items.length}</span></div>
        <div className="schedule-list">{items.map((item) => <div className="schedule-row" key={item.id}><div className="schedule-icon"><Clock3 size={17}/></div><div className="schedule-copy"><strong>{item.specific_date || `${dayLabels[item.weekday]} · cada semana`}</strong><span>{item.start_time} – {item.end_time}{item.active_until ? ` · hasta ${item.active_until}` : ''}</span></div><button className="icon-button danger" onClick={() => remove(item.id)} title="Eliminar"><Trash2 size={16}/></button></div>)}{!items.length && <p className="empty-state">Todavía no publicas disponibilidad.</p>}</div>
      </section>
    </div>
  </>;
}
