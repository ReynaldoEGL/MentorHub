import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, FileText, Paperclip, Upload } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const labels = { solicitada: 'Solicitada', confirmada: 'Confirmada', rechazada: 'Rechazada', cancelada: 'Cancelada', realizada: 'Realizada' };
const prettyDate = (value) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));

export default function AppointmentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [appointment, setAppointment] = useState(null);
  const [evidences, setEvidences] = useState([]);
  const [requests, setRequests] = useState([]);
  const [file, setFile] = useState(null);
  const [description, setDescription] = useState('');
  const [documentForm, setDocumentForm] = useState({ title: '', description: '', due_at: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [appointmentResult, evidenceResult, requestResult] = await Promise.all([
      api.get(`/citas/${id}`), api.get(`/citas/${id}/evidencias`), api.get('/solicitudes-documentos'),
    ]);
    setAppointment(appointmentResult.data.appointment);
    setEvidences(evidenceResult.data.evidences);
    setRequests(requestResult.data.requests.filter((item) => item.appointment_id === id));
  };
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, [id]);

  const uploadEvidence = async (event) => {
    event.preventDefault();
    if (!file) return setError('Selecciona un archivo.');
    const body = new FormData(); body.append('file', file); body.append('description', description);
    setBusy(true); setError(''); setMessage('');
    try { await api.post(`/citas/${id}/evidencias`, body); setFile(null); setDescription(''); setMessage('Evidencia cargada correctamente.'); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  const requestDocument = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { await api.post(`/citas/${id}/solicitudes-documentos`, { ...documentForm, due_at: new Date(documentForm.due_at).toISOString() }); setDocumentForm({ title: '', description: '', due_at: '' }); setMessage('Solicitud de documento enviada.'); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusy(false); }
  };

  const reviewEvidence = async (evidenceId, status) => {
    const comment = status === 'correccion' ? window.prompt('Indica qué debe corregirse:') : '';
    if (status === 'correccion' && !comment) return;
    try { await api.patch(`/evidencias/${evidenceId}/revision`, { status, comment }); await load(); }
    catch (err) { setError(getApiError(err)); }
  };

  const download = async (url, name) => {
    try {
      const { data } = await api.get(url, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(data);
      const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = name; anchor.click(); URL.revokeObjectURL(objectUrl);
    } catch (err) { setError(getApiError(err)); }
  };

  if (!appointment) return <div className="screen-center">{error || 'Cargando mentoría…'}</div>;
  const canUpload = ['confirmada', 'realizada'].includes(appointment.status);
  return <>
    <div className="page-heading"><div><Link to="/app/citas" className="back-link"><ArrowLeft size={15}/> Regresar a mis mentorías</Link><span className="eyebrow">DETALLE DE SESIÓN</span><h1>{appointment.topic}</h1><p>{prettyDate(appointment.start_at)} · {appointment.modality === 'en_linea' ? 'En línea' : 'Presencial'}</p></div><span className={`status status-${appointment.status}`}>{labels[appointment.status]}</span></div>
    {error && <div className="form-error detail-alert">{error}</div>}{message && <div className="form-success detail-alert">{message}</div>}
    <div className="two-column-layout detail-layout">
      <div className="detail-column">
        <section className="panel"><div className="panel-title"><h2>Información de la mentoría</h2></div><div className="detail-grid"><div><span>Mentor</span><strong>{appointment.mentor_name}</strong></div><div><span>Mentorado</span><strong>{appointment.mentee_name}</strong></div><div><span>Inicio</span><strong>{prettyDate(appointment.start_at)}</strong></div><div><span>Fin</span><strong>{new Date(appointment.end_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</strong></div><div className="detail-wide"><span>Lugar o enlace</span><strong>{appointment.location_or_link || 'Por definir'}</strong></div><div className="detail-wide"><span>Notas o acuerdos</span><p>{appointment.notes || 'El mentor puede registrar aquí los acuerdos de la sesión.'}</p></div></div></section>
        <section className="panel"><div className="panel-title"><h2><Paperclip size={17}/> Evidencias de la sesión</h2><span className="count-pill">{evidences.length}</span></div>
          <div className="file-list">{evidences.map((item) => <div className="file-row" key={item.id}><div className="file-icon"><FileText size={17}/></div><div className="file-copy"><strong>{item.original_name}</strong><span>{item.uploaded_by_name} · {item.description || 'Sin descripción'}</span><span className={`status status-${item.review_status === 'aprobada' ? 'realizada' : item.review_status === 'correccion' ? 'rechazada' : 'solicitada'}`}>{item.review_status}</span>{item.review_comment && <em>{item.review_comment}</em>}</div><button className="icon-button" onClick={() => download(`/archivos/evidencias/${item.id}`, item.original_name)} title="Descargar"><Download size={15}/></button>{user?.role === 'mentor' && item.uploaded_by !== user.id && item.review_status === 'pendiente' && <><button className="icon-button success" onClick={() => reviewEvidence(item.id, 'aprobada')} title="Aprobar"><Check size={15}/></button><button className="icon-button danger" onClick={() => reviewEvidence(item.id, 'correccion')} title="Solicitar corrección">!</button></>}</div>)}{!evidences.length && <p className="empty-state">Aún no se han agregado evidencias.</p>}</div>
          {canUpload && <form className="inline-upload" onSubmit={uploadEvidence}><label>Agregar evidencia<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} required/></label><label>Descripción<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe brevemente el archivo"/></label><button className="button button-primary" disabled={busy}><Upload size={15}/> Cargar</button><span className="hint">PDF, JPG, PNG o DOCX · Máximo 10 MB</span></form>}
        </section>
      </div>
      <div className="detail-column">
        <section className="panel"><div className="panel-title"><h2>Solicitudes de documentos</h2><span className="count-pill">{requests.length}</span></div>
          <div className="request-list">{requests.map((item) => <div className="request-card" key={item.id}><div className="request-head"><strong>{item.title}</strong><span className={`status status-${item.status === 'aceptado' ? 'realizada' : item.status === 'rechazado' || item.status === 'vencido' ? 'rechazada' : item.status === 'entregado' ? 'confirmada' : 'solicitada'}`}>{item.status}</span></div><p>{item.description}</p><span>Solicita: {item.requester_name} · Entrega: {new Date(item.due_at).toLocaleDateString('es-MX')}</span>{item.delivery_name && <button className="text-action" onClick={() => download(`/archivos/documentos/${item.delivery_id}`, item.delivery_name)}><Download size={14}/> {item.delivery_name}</button>}</div>)}{!requests.length && <p className="empty-state">No hay solicitudes asociadas a esta cita.</p>}</div>
          <div className="section-divider"/><form className="form-grid" onSubmit={requestDocument}><div className="field-full"><span className="eyebrow">NUEVA SOLICITUD</span></div><label className="field-full">Título<input value={documentForm.title} onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })} required maxLength={180} placeholder="Ej. Avance del proyecto"/></label><label className="field-full">Descripción<textarea value={documentForm.description} onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })} rows="3" placeholder="Qué se necesita entregar"/></label><label className="field-full">Fecha límite<input type="datetime-local" min={new Date().toISOString().slice(0, 16)} value={documentForm.due_at} onChange={(e) => setDocumentForm({ ...documentForm, due_at: e.target.value })} required/></label><div className="field-full"><button className="button button-primary" disabled={busy}>Solicitar documento</button></div></form>
        </section>
      </div>
    </div>
  </>;
}
