import { useState } from 'react';
import { Text, View } from 'react-native';
import { locationLabel } from '../lib/libraryLocation';
import { colors, spacing, type } from '../theme';
import LocationBrowser from './LocationBrowser';
import { Button } from './ui';

export default function FolderPicker({ folders, value, onChange, disabled = false, label = 'Se creará en', allowed = () => true }) {
  const [expanded, setExpanded] = useState(false);
  const [candidate, setCandidate] = useState(value);
  const missing = value != null && !folders.some((f) => f.id === value);
  return <View style={{ gap: spacing.sm }}>
    {!expanded ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={type.small}>{label}</Text><Text style={[type.body, missing && { color: colors.danger }]}>{missing ? 'La carpeta ya no existe. Elegí otra ubicación.' : locationLabel(folders, value)}</Text></View>
      <Button label="Cambiar" kind="ghost" disabled={disabled} onPress={() => { setCandidate(value); setExpanded(true); }} />
    </View> : <>
      <LocationBrowser folders={folders} value={candidate} onChange={setCandidate} disabled={disabled} allowed={allowed} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label="Cancelar cambio" disabled={disabled} onPress={() => setExpanded(false)} />
        <Button label="Usar esta carpeta" kind="primary" disabled={disabled || !allowed(candidate) || candidate != null && !folders.some((folder) => folder.id === candidate)} onPress={() => { onChange(candidate); setExpanded(false); }} />
      </View>
    </>}
  </View>;
}
