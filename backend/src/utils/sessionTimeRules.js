import { HttpError } from './httpError.js';

export function localParts(value, timezone = 'America/Mexico_City') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, 'Fecha u hora inválida.');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    weekday: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[map.weekday],
    time: `${map.hour}:${map.minute}`,
  };
}

export function validateSessionWindow(startAt, endAt, timezone = 'America/Mexico_City', now = new Date()) {
  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    throw new HttpError(400, 'Indica un inicio y fin válidos.');
  }
  if (startMs <= now.getTime()) throw new HttpError(400, 'La tutoría debe programarse en una fecha futura.');
  const start = localParts(startAt, timezone);
  const end = localParts(endAt, timezone);
  if (start.date !== end.date || start.time >= end.time) {
    throw new HttpError(400, 'La tutoría debe comenzar y terminar el mismo día.');
  }
  return { start, end };
}
