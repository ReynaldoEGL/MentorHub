import test from 'node:test';
import assert from 'node:assert/strict';
import { canCancelAppointment, canTransitionAppointment } from '../src/utils/appointmentRules.js';

test('solo permite las transiciones válidas del ciclo de una mentoría', () => {
  assert.equal(canTransitionAppointment('solicitada', 'confirmada'), true);
  assert.equal(canTransitionAppointment('solicitada', 'rechazada'), true);
  assert.equal(canTransitionAppointment('confirmada', 'realizada'), true);
  assert.equal(canTransitionAppointment('realizada', 'confirmada'), false);
  assert.equal(canTransitionAppointment('cancelada', 'confirmada'), false);
});

test('permite cancelar con al menos 24 horas de anticipación', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  assert.equal(canCancelAppointment('2026-11-11T12:00:00.000Z', now), true);
  assert.equal(canCancelAppointment('2026-11-11T11:59:59.000Z', now), false);
});
