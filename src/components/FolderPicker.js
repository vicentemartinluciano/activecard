import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { locationLabel } from '../lib/libraryLocation';
import { normalizeSearch } from '../lib/search';
import { colors, spacing, type } from '../theme';
import { Button, Chip, Field } from './ui';

export default function FolderPicker({ folders, value, onChange, disabled = false, label = 'Dentro de', allowed = () => true }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const missing = value != null && !folders.some((f) => f.id === value);
  return <View style={{ gap: spacing.sm }}>
    <Text style={type.label}>{label}</Text>
    <Text style={[type.small, missing && { color: colors.danger }]}>{missing ? 'La carpeta de destino ya no existe. Elegí otra ubicación.' : locationLabel(folders, value)}</Text>
    <Button label={expanded ? 'Cerrar ubicaciones' : 'Cambiar ubicación'} disabled={disabled} onPress={() => setExpanded((v) => !v)} />
    {expanded && <View style={{ gap: spacing.sm }}>
      <Field accessibilityLabel="Buscar ubicación" placeholder="Buscar carpeta…" value={query} onChangeText={setQuery} editable={!disabled} />
      <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
        {allowed(null) && !query.trim() && <Chip label="Biblioteca (raíz)" active={value == null} onPress={() => { if (!disabled) { onChange(null); setExpanded(false); } }} />}
        {folders.filter((f) => allowed(f.id) && normalizeSearch(locationLabel(folders, f.id)).includes(normalizeSearch(query.trim()))).map((f) => <Chip key={f.id} label={locationLabel(folders, f.id)} active={value === f.id} onPress={() => { if (!disabled) { onChange(f.id); setExpanded(false); } }} />)}
      </ScrollView>
    </View>}
  </View>;
}
