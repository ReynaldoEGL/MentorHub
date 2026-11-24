// Las decisiones de acceso se basan en el usuario obtenido por JWT y consultado en PostgreSQL.
// Nunca se confía en un rol enviado desde el frontend.
export function canViewAppointment(user, appointment) {
  return Boolean(user && appointment && (user.role === 'admin' ||
    (user.role === 'mentor' && user.id === appointment.mentor_id) ||
    (user.role === 'mentorado' && user.id === appointment.mentee_id)));
}

export function canEditOffering(user, offering) {
  return Boolean(user && offering && user.role === 'mentor' && user.id === offering.mentor_id);
}

export function canAssignMentee(user) {
  return Boolean(user && user.role === 'admin');
}
