import test from 'node:test';
import assert from 'node:assert/strict';
import { localParts, validateSessionWindow } from '../src/utils/sessionTimeRules.js';

const reference = new Date('2026-11-01T00:00:00.000Z');

test('acepta una tutoría futura de una sola sesión', () => {
  const result = validateSessionWindow('2026-11-30T15:00:00Z', '2026-11-30T16:00:00Z', 'America/Mexico_City', reference);
  assert.equal(result.start.time, '09:00');
  assert.equal(result.end.time, '10:00');
  assert.equal(result.start.date, '2026-11-30');
});

test('rechaza una fecha inválida y una hora final anterior', () => {
  assert.throws(() => validateSessionWindow('abc', 'xyz', 'America/Mexico_City', reference), { status: 400 });
  assert.throws(() => validateSessionWindow('2026-11-30T16:00Z', '2026-11-30T15:00Z', 'America/Mexico_City', reference), { status: 400 });
});

test('rechaza una tutoría que abarca dos días locales', () => {
  assert.throws(() => validateSessionWindow('2026-11-30T05:30:00Z', '2026-11-30T07:30:00Z', 'America/Mexico_City', reference), { status: 400 });
});

test('rechaza una tutoría ya iniciada', () => {
  assert.throws(() => validateSessionWindow('2026-10-31T17:00:00Z', '2026-10-31T18:00:00Z', 'America/Mexico_City', reference), { status: 400 });
});

test('interpreta correctamente el día de la semana institucional', () => {
  assert.equal(localParts('2026-11-30T15:00:00Z', 'America/Mexico_City').weekday, 1);
});
