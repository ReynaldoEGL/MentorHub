import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, Search, UserRound } from 'lucide-react';
import api, { getApiError } from '../api/client';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function MentorsPage() {
  const [mentors, setMentors] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [form, setForm] = useState({ date: '', start_time: '10:00', end_time: '11:00', topic: '', modality: 'en_linea', location_or_link: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMentors = async () => {
    const { data } = await api.get('/mentores', { params: { search } });
    setMentors(data.mentors);
  };
  useEffect(() => { loadMentors().catch((err) => setError(getApiError(err))); }, [search]);

  const selectMentor = async (mentor) => {
    setSelected(mentor); setMessage(''); setError('');
    try {
      const { data } = await api.get(`/disponibilidad/mentor/${mentor.id}`);
      setAvailability(data.availabilities);
    } catch (err) { setError(getApiError(err)); }
  };

  const book = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await api.post('/citas', {
        mentor_id: selected.id,
        start_at: new Date(`${form.date}T${form.start_time}:00`).toISOString(),
        end_at: new Date(`${form.date}T${form.end_time}:00`).toISOString(),
        topic: form.topic, modality: form.modality, location_or_link: form.location_or_link,
      });
      setMessage('Solicitud enviada. El mentor deberá confirmarla.');
      setForm({ ...form, topic: '' });
    } catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  return <>
    <div className="page-heading"><div><span className="eyebrow">DIRECTORIO ACADÉMICO</span><h1>Encuentra un mentor</h1><p>Explora las áreas de acompañamiento y solicita una sesión en un horario disponible.</p></div></div>
    <div className="directory-layout">
      <section className="panel directory-panel">
        <div className="panel-title"><h2>Mentores disponibles</h2><span className="count-pill">{mentors.length}</span></div>
        <div className="search-box"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o materia…" /></div>
        {error && <div className="form-error">{error}</div>}
        <div className="mentor-list">
          {mentors.map((mentor) => <button key={mentor.id} className={`mentor-row ${selected?.id === mentor.id ? 'selected' : ''}`} onClick={() => selectMentor(mentor)}>
            <div className="avatar mentor-avatar"><UserRound size={17}/></div><div className="mentor-copy"><strong>{mentor.full_name}</strong><span>{mentor.areas?.length ? mentor.areas.join(' · ') : 'Áreas por definir'}</span></div><span className="row-arrow">›</span>
          </button>)}
          {!mentors.length && <p className="empty-state">No hay mentores que coincidan con la búsqueda.</p>}
        </div>
      </section>
      <section className="panel mentor-detail">
        {!selected ? <div className="empty-detail"><div className="empty-icon"><UserRound size={24}/></div><h3>Selecciona un mentor</h3><p>Elige una persona de la lista para consultar su perfil y horarios.</p></div> : <>
          <div className="mentor-profile-head"><div className="avatar profile-avatar"><UserRound size={24}/></div><div><span className="eyebrow">PERFIL DEL MENTOR</span><h2>{selected.full_name}</h2><p>{selected.areas?.join(' · ') || 'Áreas por definir'}</p></div></div>
          <p className="mentor-description">{selected.description || 'Este mentor aún no ha agregado una descripción.'}</p>
          <div className="section-divider"/><div className="panel-title"><h3><CalendarDays size={17}/> Disponibilidad publicada</h3></div>
          <div className="availability-chips">{availability.map((item) => <span className="availability-chip" key={item.id}><Clock3 size={13}/>{item.specific_date ? item.specific_date : `${dayLabels[item.weekday]} · semanal`} · {item.start_time}–{item.end_time}</span>)}{!availability.length && <p className="empty-state">Este mentor todavía no ha publicado horarios.</p>}</div>
          <div className="section-divider"/><div className="panel-title"><h3>Solicitar mentoría</h3></div>
          <form className="form-grid" onSubmit={book}>
            <label>Fecha<input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required/></label>
            <label>Hora de inicio<input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required/></label>
            <label>Hora de fin<input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required/></label>
            <label>Modalidad<select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })}><option value="en_linea">En línea</option><option value="presencial">Presencial</option></select></label>
            <label className="field-full">Tema de la mentoría<input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} required maxLength={180} placeholder="¿Qué te gustaría revisar?"/></label>
            <label className="field-full">Lugar o enlace (opcional)<input value={form.location_or_link} onChange={(e) => setForm({ ...form, location_or_link: e.target.value })} placeholder="Se puede completar después de confirmar"/></label>
            {message && <div className="form-success field-full">{message}</div>}{error && <div className="form-error field-full">{error}</div>}
            <div className="field-full form-actions"><button className="button button-primary" disabled={busy || !availability.length}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button></div>
          </form>
        </>}
      </section>
    </div>
  </>;
}
