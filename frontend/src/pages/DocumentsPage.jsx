import { useEffect, useState } from 'react';
import { Download, FileCheck2, UploadCloud } from 'lucide-react';
import api, { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const statusLabel = { pendiente: 'Pendiente', entregado: 'Entregado', aceptado: 'Aceptado', rechazado: 'Requiere corrección', vencido: 'Vencido' };

export default function DocumentsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [comments, setComments] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const load = async () => { const { data } = await api.get('/solicitudes-documentos'); setRequests(data.requests); };
  useEffect(() => { load().catch((err) => setError(getApiError(err))); }, []);

  const deliver = async (item) => {
    const file = selectedFiles[item.id];
    if (!file) return setError('Selecciona el archivo que vas a entregar.');
    const form = new FormData(); form.append('file', file); form.append('comment', comments[item.id] || '');
    setBusyId(item.id); setError(''); setMessage('');
    try { await api.post(`/solicitudes-documentos/${item.id}/entrega`, form); setMessage('Documento entregado correctamente.'); setSelectedFiles((old) => ({ ...old, [item.id]: null })); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const review = async (item, status) => {
    const comment = status === 'rechazado' ? (comments[item.id] || window.prompt('¿Qué debe corregirse?') || '') : '';
    if (status === 'rechazado' && comment.trim().length < 3) return setError('Es necesario indicar qué debe corregirse.');
    setBusyId(item.id); setError('');
    try { await api.patch(`/solicitudes-documentos/${item.id}/revision`, { status, comment }); await load(); }
    catch (err) { setError(getApiError(err)); }
    finally { setBusyId(null); }
  };

  const download = async (item) => {
    try { const { data } = await api.get(`/archivos/documentos/${item.delivery_id}`, { responseType: 'blob' }); const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = item.delivery_name; a.click(); URL.revokeObjectURL(url); }
    catch (err) { setError(getApiError(err)); }
  };

  return <>
    <div className="page-heading"><div><span className="eyebrow">GESTIÓN DOCUMENTAL</span><h1>Documentos</h1><p>Entrega archivos solicitados y revisa los documentos compartidos en tus mentorías.</p></div></div>
    {error && <div className="form-error detail-alert">{error}</div>}{message && <div className="form-success detail-alert">{message}</div>}
    <div className="document-cards">{requests.map((item) => <article className="panel document-card" key={item.id}><div className="request-head"><div className="file-icon"><FileCheck2 size={18}/></div><span className={`status status-${item.status === 'aceptado' ? 'realizada' : item.status === 'rechazado' || item.status === 'vencido' ? 'rechazada' : item.status === 'entregado' ? 'confirmada' : 'solicitada'}`}>{statusLabel[item.status]}</span></div><h2>{item.title}</h2><p>{item.description || 'Sin descripción adicional.'}</p><div className="document-meta"><span>Mentoría: {item.topic}</span><span>Solicita: {item.requester_name}</span><span>Entrega: {new Date(item.due_at).toLocaleString('es-MX')}</span></div>
      {item.delivery_name && <button className="text-action" onClick={() => download(item)}><Download size={14}/> {item.delivery_name}</button>}
      {item.review_comment && <div className="review-note">Comentario de revisión: {item.review_comment}</div>}
      {item.recipient_id === user?.id && ['pendiente','rechazado','vencido'].includes(item.status) && <div className="document-action"><label>Archivo de entrega<input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={(e) => setSelectedFiles((old) => ({ ...old, [item.id]: e.target.files?.[0] || null }))}/></label><input className="field" value={comments[item.id] || ''} onChange={(e) => setComments((old) => ({ ...old, [item.id]: e.target.value }))} placeholder="Comentario opcional"/><button className="button button-primary" disabled={busyId === item.id} onClick={() => deliver(item)}><UploadCloud size={15}/> Entregar documento</button><span className="hint">PDF, JPG, PNG o DOCX · Máximo 10 MB</span></div>}
      {item.requester_id === user?.id && item.status === 'entregado' && <div className="review-actions"><label>Comentario<input className="field" value={comments[item.id] || ''} onChange={(e) => setComments((old) => ({ ...old, [item.id]: e.target.value }))} placeholder="Motivo de rechazo (si aplica)"/></label><button className="button button-primary" disabled={busyId === item.id} onClick={() => review(item, 'aceptado')}>Aceptar</button><button className="button button-outline-danger" disabled={busyId === item.id} onClick={() => review(item, 'rechazado')}>Solicitar corrección</button></div>}
    </article>)}{!requests.length && <div className="panel empty-state">No hay solicitudes de documentos registradas.</div>}</div>
  </>;
}
