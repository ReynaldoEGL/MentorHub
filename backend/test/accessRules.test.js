import test from 'node:test';
import assert from 'node:assert/strict';
import { canViewAppointment, canEditOffering, canAssignMentee } from '../src/utils/accessRules.js';

const appointment = { mentor_id: 'mentor-1', mentee_id: 'mentee-1' };
const offering = { mentor_id: 'mentor-1' };

test('administración puede consultar citas ajenas, pero no es mentor ni tutorado', () => {
  assert.equal(canViewAppointment({ id: 'admin-1', role: 'admin' }, appointment), true);
  assert.equal(canEditOffering({ id: 'admin-1', role: 'admin' }, offering), false);
  assert.equal(canAssignMentee({ id: 'admin-1', role: 'admin' }), true);
});

test('un mentor solo consulta sus citas y modifica sus ofertas', () => {
  assert.equal(canViewAppointment({ id: 'mentor-1', role: 'mentor' }, appointment), true);
  assert.equal(canViewAppointment({ id: 'mentor-2', role: 'mentor' }, appointment), false);
  assert.equal(canEditOffering({ id: 'mentor-1', role: 'mentor' }, offering), true);
  assert.equal(canEditOffering({ id: 'mentor-2', role: 'mentor' }, offering), false);
  assert.equal(canAssignMentee({ id: 'mentor-1', role: 'mentor' }), false);
});

test('un tutorado solo consulta sus propias citas y no asigna estudiantes', () => {
  assert.equal(canViewAppointment({ id: 'mentee-1', role: 'mentorado' }, appointment), true);
  assert.equal(canViewAppointment({ id: 'mentee-2', role: 'mentorado' }, appointment), false);
  assert.equal(canEditOffering({ id: 'mentee-1', role: 'mentorado' }, offering), false);
  assert.equal(canAssignMentee({ id: 'mentee-1', role: 'mentorado' }), false);
});

test('los permisos nunca aceptan usuarios inexistentes', () => {
  assert.equal(canViewAppointment(null, appointment), false);
  assert.equal(canAssignMentee(null), false);
  assert.equal(canEditOffering(null, offering), false);
});
