import { databaseErrorMessage } from '../databaseError';
test.each(['Access Handles cannot be created', 'Invalid VFS state', 'NoModificationAllowedError'])('un bloqueo %s ofrece cerrar la otra pestaña y reintentar', (message) => {
  expect(databaseErrorMessage(new Error(message))).toContain('Otra pestaña de ActiveCard');
  expect(databaseErrorMessage(new Error(message))).toContain('Reintentar');
});
test('otros errores conservan el contexto de la pantalla', () => {
  expect(databaseErrorMessage(new Error('SQL'), 'No pudimos cargar este mazo.')).toBe('No pudimos cargar este mazo.');
});
