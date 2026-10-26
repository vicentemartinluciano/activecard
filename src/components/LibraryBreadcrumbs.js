import { Platform, Pressable, Text, View } from 'react-native';
import { folderPath } from '../lib/folderTree';
import { colors, spacing, type } from '../theme';

export default function LibraryBreadcrumbs({ folders, folderId, deckName, onNavigate }) {
  if (Platform.OS === 'web') return null; // La ruta web vive en DesktopShell.
  const parts = [{ id: null, name: 'Biblioteca' }, ...folderPath(folders, folderId)];
  return <View accessibilityLabel="Ubicación en la biblioteca" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
    {parts.map((part, i) => <View key={part.id ?? 'root'} style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      {i > 0 && <Text style={type.small}> / </Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Ir a ${part.name}`} onPress={() => onNavigate(part.id == null ? '/biblioteca' : `/carpetas/${part.id}`)} style={{ paddingVertical: 10, minHeight: 44, justifyContent: 'center', flexShrink: 1 }}>
        <Text style={[type.small, { color: colors.accentText, flexShrink: 1 }]}>{part.name}</Text>
      </Pressable>
    </View>)}
    {deckName && <Text style={[type.small, { flexShrink: 1 }]}> / {deckName}</Text>}
  </View>;
}
