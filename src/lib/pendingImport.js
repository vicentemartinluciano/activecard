let pendingImport = null;

export function setPendingImport(value) {
  pendingImport = value;
}

export function getPendingImport() {
  return pendingImport;
}

export function clearPendingImport() {
  pendingImport = null;
}
