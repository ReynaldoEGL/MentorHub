export const APPOINTMENT_TRANSITIONS = Object.freeze({
  solicitada: ['confirmada', 'rechazada', 'cancelada'],
  confirmada: ['realizada', 'cancelada'],
  rechazada: [],
  cancelada: [],
  realizada: [],
});

export function canTransitionAppointment(currentStatus, nextStatus) {
  return (APPOINTMENT_TRANSITIONS[currentStatus] || []).includes(nextStatus);
}

export function canCancelAppointment(startAt, now = new Date(), minimumHours = 24) {
  const start = new Date(startAt).getTime();
  const current = new Date(now).getTime();
  return Number.isFinite(start) && Number.isFinite(current) && start - current >= minimumHours * 60 * 60 * 1000;
}
