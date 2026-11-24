import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRoleChangeAllowed, assertAccountStatusChangeAllowed } from '../src/utils/adminAccountPolicy.js';

const alice = { id: 'alice-admin', role: 'admin' };
const bob = { id: 'bob-admin', role: 'admin' };
const carlos = { id: 'carlos-mentor', role: 'mentor' };
const dana = { id: 'dana-mentee', role: 'mentorado' };

function forbidden(callback, expected) {
  assert.throws(callback, (error) => error.status === 403 && error.message.includes(expected));
}

test('un administrador no puede degradar su propio rol', () => {
  forbidden(() => assertRoleChangeAllowed(alice, alice, 'mentor'), 'propio rol');
  forbidden(() => assertRoleChangeAllowed(alice, alice, 'mentorado'), 'propio rol');
});

test('un administrador no puede degradar a otro administrador', () => {
  forbidden(() => assertRoleChangeAllowed(alice, bob, 'mentor'), 'otra cuenta administradora');
  forbidden(() => assertRoleChangeAllowed(alice, bob, 'mentorado'), 'otra cuenta administradora');
});

test('confirmar sin cambios el rol de un administrador está permitido', () => {
  assert.doesNotThrow(() => assertRoleChangeAllowed(alice, alice, 'admin'));
  assert.doesNotThrow(() => assertRoleChangeAllowed(alice, bob, 'admin'));
});

test('un administrador conserva la capacidad de gestionar roles de mentores y tutorados', () => {
  for (const role of ['admin', 'mentor', 'mentorado']) {
    assert.doesNotThrow(() => assertRoleChangeAllowed(alice, carlos, role));
    assert.doesNotThrow(() => assertRoleChangeAllowed(alice, dana, role));
  }
});

test('nadie puede desactivar su propia cuenta administrativa', () => {
  forbidden(() => assertAccountStatusChangeAllowed(alice, alice, false), 'propia cuenta');
});

test('un administrador no puede desactivar a otro administrador', () => {
  forbidden(() => assertAccountStatusChangeAllowed(alice, bob, false), 'otro administrador');
});

test('se permite reactivar un administrador previamente desactivado', () => {
  assert.doesNotThrow(() => assertAccountStatusChangeAllowed(alice, bob, true));
});

test('se conservan los controles de activar y desactivar cuentas no administrativas', () => {
  assert.doesNotThrow(() => assertAccountStatusChangeAllowed(alice, carlos, false));
  assert.doesNotThrow(() => assertAccountStatusChangeAllowed(alice, dana, false));
  assert.doesNotThrow(() => assertAccountStatusChangeAllowed(alice, carlos, true));
});
