import { useEffect, useState } from 'react';
import { Search, GraduationCap, ArrowUpRight, UserRound } from 'lucide-react';
import api, { getApiError } from '../api/client';

const initials = (name='') => name.split(' ').filter(Boolean).slice(0,2).map((x) => x[0]).join('').toUpperCase();
export default function MentorsPage() {
  const [search, setSearch] = useState('');
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/mentores', { params: { search } }).then(({ data }) => { if (active) setMentors(data.mentors || []); })
      .catch((err) => { if (active) setError(getApiError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search]);
  return <>
    <div className="page-heading"><div><span className="eyebrow">COMUNIDAD MENTORHUB</span><h1>Directorio de mentores</h1><p>Conoce a los mentores disponibles y las áreas en las que pueden orientarte.</p></div><span className="directory-count"><GraduationCap size={17}/> {mentors.length} perfiles</span></div>
    <div className="search-panel"><Search size={18}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, materia o área académica…" aria-label="Buscar mentores"/></div>
    {error && <div className="form-error">{error}</div>}
    {loading ? <div className="empty-state">Cargando perfiles…</div> : mentors.length ? <div className="mentor-grid">{mentors.map((mentor, index) => <article className="mentor-card" key={mentor.id}><div className={`mentor-avatar tone-${index%4}`}>{initials(mentor.full_name)}</div><div className="mentor-card-main"><div className="mentor-name-row"><h2>{mentor.full_name}</h2><span className="online-dot" title="Perfil activo"/></div><p>{mentor.description || 'Mentor académico de la comunidad MentorHub.'}</p><div className="tag-list">{(mentor.areas || []).map((area) => <span key={area}>{area}</span>)}</div></div><div className="mentor-card-footer"><span><UserRound size={14}/> Perfil académico</span><button className="icon-action" title="Ver perfil"><ArrowUpRight size={17}/></button></div></article>)}</div> : <div className="empty-state"><GraduationCap size={25}/><strong>No hay mentores para mostrar</strong><span>Cuando haya perfiles registrados, aparecerán en este directorio.</span></div>}
  </>;
}
