import { HttpError } from './httpError.js';

// Las cuentas administrativas no pueden perder su rol mediante la API.
// Se valida el rol actual desde la fila bloqueada en PostgreSQL, no desde el cliente.
export function assertRoleChangeAllowed(actor, target, nextRole) {
  if (target.role !== 'admin' || nextRole === 'admin') return;
  const message = actor.id === target.id
    ? 'No puedes quitarte tu propio rol de administrador.'
    : 'No puedes quitarle el rol de administrador a otra cuenta administradora.';
  throw new HttpError(403, message);
}

// Desactivar un administrador también le retiraría el acceso; se protege esa operación.
// Es posible reactivar administradores previamente desactivados.
export function assertAccountStatusChangeAllowed(actor, target, nextActive) {
  if (nextActive !== false) return;
  if (actor.id === target.id) {
    throw new HttpError(403, 'No puedes desactivar tu propia cuenta.');
  }
  if (target.role === 'admin') {
    throw new HttpError(403, 'No puedes desactivar la cuenta de otro administrador.');
  }
}
