import { Redirect, useLocalSearchParams } from 'expo-router';

// Compatibilidad de accesos guardados y enlaces anteriores.
export default function Crear() {
  const { parentId, folderId } = useLocalSearchParams();
  const target = parentId || (folderId !== 'root' ? folderId : null);
  return <Redirect href={{ pathname: target ? '/carpetas/[id]' : '/biblioteca', params: { ...(target ? { id: target } : {}), create: parentId ? 'carpeta' : 'choose' } }} />;
}
