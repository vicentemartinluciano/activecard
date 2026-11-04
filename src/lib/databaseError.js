export function databaseErrorMessage(error, fallback = 'No pudimos acceder a tus datos.') {
  const detail = String(error?.message || error);
  return /Access Handle|Invalid VFS state|NoModificationAllowedError|Otra pestaña de ActiveCard/i.test(detail)
    ? 'Otra pestaña de ActiveCard está usando la biblioteca. Cerrala y tocá Reintentar acá. Tus datos se conservan.'
    : fallback;
}
