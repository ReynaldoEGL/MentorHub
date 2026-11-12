const sessions = [
  { day: '12', month: 'NOV', time: '10:00 – 10:45', title: 'Introducción a bases de datos', mentor: 'Dra. Andrea Morales', state: 'Confirmada', initials: 'AM', tone: 'blue' },
  { day: '14', month: 'NOV', time: '16:00 – 16:45', title: 'Estructuras de datos', mentor: 'Ing. Luis Herrera', state: 'Pendiente', initials: 'LH', tone: 'violet' },
];
const activities = [
  ['AM', 'Andrea Morales', 'Mentora · Bases de datos', 'blue'],
  ['LH', 'Luis Herrera', 'Mentor · Programación', 'violet'],
  ['CR', 'Carolina Ríos', 'Mentora · Matemáticas', 'gold'],
];

function App() {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">M</span><span>Mentor<span>Hub</span></span></div>
      <p className="nav-caption">ESPACIO ACADÉMICO</p>
      <a className="nav-item active"><span>▦</span> Resumen</a>
      <a className="nav-item"><span>◷</span> Mis mentorías <i>2</i></a>
      <a className="nav-item"><span>⌕</span> Explorar mentores</a>
      <div className="sidebar-bottom"><div className="avatar avatar-user">EG</div><div><strong>Estudiante Gaspar</strong><small>Mentorado</small></div><span className="dots">···</span></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><small>PLATAFORMA ACADÉMICA</small><strong>Mi espacio de mentoría</strong></div><div className="topbar-right"><span className="prototype">V1 · PROTOTIPO</span><span className="bell">♧</span><span className="avatar avatar-small">EG</span></div></header>
      <section className="content">
        <div className="welcome-row"><div><p className="eyebrow">MARTES, 10 DE NOVIEMBRE DE 2026</p><h1>¡Hola, Emmanuel! <span>✦</span></h1><p className="muted">Organiza tus sesiones y sigue avanzando en tus objetivos académicos.</p></div><button className="primary-button">＋ Solicitar mentoría</button></div>
        <div className="stat-grid">
          <article className="stat-card"><div className="stat-top"><span>Sesiones programadas</span><span className="stat-icon blue-bg">▦</span></div><strong>02</strong><small>En los próximos 7 días</small></article>
          <article className="stat-card"><div className="stat-top"><span>Sesiones realizadas</span><span className="stat-icon green-bg">✓</span></div><strong>08</strong><small>Este semestre</small></article>
          <article className="stat-card"><div className="stat-top"><span>Mentores conectados</span><span className="stat-icon violet-bg">♙</span></div><strong>03</strong><small>En distintas áreas</small></article>
        </div>
        <div className="section-heading"><div><p className="eyebrow">TU AGENDA</p><h2>Próximas mentorías</h2></div><a>Ver todas <span>→</span></a></div>
        <div className="session-list">{sessions.map((s) => <article className="session-card" key={s.title}><div className="date-tile"><strong>{s.day}</strong><small>{s.month}</small></div><div className="session-info"><strong>{s.title}</strong><small>{s.time} · {s.mentor}</small></div><div className="session-end"><span className={`status ${s.state === 'Confirmada' ? 'confirmed' : 'pending'}`}>{s.state}</span><span className={`avatar ${s.tone}`}>{s.initials}</span></div></article>)}</div>
        <div className="bottom-grid"><article className="panel"><div className="section-heading compact"><div><p className="eyebrow">RECOMENDADOS</p><h2>Mentores destacados</h2></div><a>Explorar →</a></div><div className="mentor-list">{activities.map((a) => <div className="mentor-row" key={a[0]}><span className={`avatar ${a[3]}`}>{a[0]}</span><div><strong>{a[1]}</strong><small>{a[2]}</small></div><span className="arrow">↗</span></div>)}</div></article><article className="help-panel"><span className="help-symbol">✧</span><p className="eyebrow">UN PASO A LA VEZ</p><h2>Tu siguiente logro empieza con una conversación.</h2><p>Encuentra acompañamiento académico y convierte tus dudas en nuevos aprendizajes.</p><button className="light-button">Conocer MentorHub <span>→</span></button></article></div>
        <footer>MentorHub <span>·</span> Prototipo de gestión de mentorías académicas</footer>
      </section>
    </main>
  </div>;
}

export default App;
