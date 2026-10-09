import { useEffect, useState } from "react";
import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Platform, Pressable, Switch, Text, View } from "react-native";
import { listRecoveries } from "../lib/syncLocal";
import { colors, font, spacing, type } from "../theme";
import { useCloudSync } from "./CloudSyncProvider";
import { Button, Card, confirmAsync, Field, Pill } from "./ui";

export default function AccountPanel() {
  const { status, engine } = useCloudSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [copies, setCopies] = useState([]);
  const [showRecovery, setShowRecovery] = useState(false);
  const busy = working || status.busy;
  useEffect(() => {
    let active = true;
    if (status.user) listRecoveries(status.user.id).then((rows) => { if (active) setCopies(rows); }).catch(() => { if (active) setError("No pudimos leer las copias de recuperación."); });
    else setCopies([]);
    return () => { active = false; };
  }, [status.user, status.syncedAt]);
  const run = async (action) => {
    setWorking(true); setError(null);
    try { await action(); }
    catch (failure) { setError(failure.message); }
    finally { setPassword(""); setWorking(false); }
  };
  if (Platform.OS === 'web') {
    const failure = error || status.error;
    const badge = failure ? 'Revisar conexión' : busy ? 'Sincronizando' : status.user ? (status.pending ? 'Cambios pendientes' : status.message === 'Al día' ? 'Al día' : 'Conectada') : 'Sin conectar';
    const stateColor = failure ? colors.danger : status.user && !busy && !status.pending ? colors.successBright : colors.accentText;
    return <Card style={{ padding: 28, gap: 24 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Feather name="cloud" size={26} color={colors.accentText} /><Text style={[type.heading, { fontSize: 24 }]}>Cuenta privada</Text></View>
        <Pill label={badge} color={stateColor} labelStyle={{ fontSize: 14 }} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 32 }}>
        <View style={{ flexGrow: 1, flexBasis: 280, minWidth: 0, gap: 16 }}>
          <Text style={[type.body, { fontSize: 20, lineHeight: 29, ...font(600) }]}>{status.user ? 'Tu biblioteca en ambos dispositivos' : 'Conectá tu PC y tu celular'}</Text>
          <Text style={[type.small, { fontSize: 15, lineHeight: 24 }]}>Mazos, tarjetas, imágenes, repasos, límites diarios y conversaciones del Gimnasio.</Text>
          {!status.user && <Text style={[type.small, { fontSize: 15, lineHeight: 24 }]}>Usá tu acceso de REANCLA. Los datos de cada app se guardan por separado.</Text>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Feather name="key" size={16} color={colors.textMuted} /><Text style={[type.small, { fontSize: 13 }]}>Las claves de OpenAI y Notion quedan en este dispositivo.</Text></View>
        </View>
        <View style={{ flexGrow: 2, flexBasis: 420, minWidth: 0, gap: 14 }}>
          {status.user ? <>
            <Text style={[type.body, { fontSize: 18, ...font(600) }]}>{status.user.email}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 18, borderRadius: 14, backgroundColor: colors.surfaceHigh }}>
              {busy ? <ActivityIndicator size="small" color={colors.accentText} /> : <Feather name={failure ? 'alert-circle' : status.pending ? 'clock' : 'check-circle'} size={22} color={stateColor} />}
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[type.body, { fontSize: 15, lineHeight: 23, color: failure ? colors.danger : colors.text }]} accessibilityLiveRegion="polite">{error || status.message}</Text>
                {status.syncedAt && <Text style={[type.small, { fontSize: 13 }]}>Última sincronización · {new Date(status.syncedAt).toLocaleString()}</Text>}
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <Button label={busy ? 'Sincronizando…' : 'Sincronizar ahora'} size="lg" kind="primary" disabled={busy} onPress={() => run(() => engine.sync())} />
              <Button label="Cerrar sesión" disabled={busy} onPress={() => run(() => engine.logout())} />
            </View>
          </> : <>
            <Text style={[type.small, { fontSize: 13, ...font(600) }]}>Correo</Text>
            <Field accessibilityLabel="Correo de la cuenta" placeholder="tu@correo.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} style={{ minHeight: 54, fontSize: 16 }} />
            <Text style={[type.small, { fontSize: 13, ...font(600) }]}>Contraseña</Text>
            <Field accessibilityLabel="Contraseña de la cuenta" placeholder="Contraseña de REANCLA" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} style={{ minHeight: 54, fontSize: 16 }} onSubmitEditing={() => email.trim() && password && !busy && run(() => engine.login(email, password, remember))} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Switch accessibilityLabel="Recordar sesión en esta PC" value={remember} onValueChange={setRemember} disabled={busy} /><Text style={[type.small, { fontSize: 14 }]}>Recordar sesión en esta PC</Text></View>
            {failure && <Text accessibilityLiveRegion="polite" style={[type.small, { color: colors.danger, fontSize: 14 }]}>{failure}</Text>}
            <Button label={working ? 'Conectando…' : 'Conectar cuenta'} size="lg" kind="primary" disabled={busy || !email.trim() || !password} onPress={() => run(() => engine.login(email, password, remember))} />
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => run(() => engine.restore())} style={{ alignSelf: 'flex-start', paddingVertical: 8, opacity: busy ? 0.4 : 1 }}><Text style={[type.small, { color: colors.accentText, fontSize: 14 }]}>Reconectar sesión guardada</Text></Pressable>
          </>}
        </View>
      </View>
      {status.user && copies.length > 0 && <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 20, gap: 16 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={showRecovery ? 'Ocultar copias de recuperación' : 'Ver copias de recuperación'} onPress={() => setShowRecovery((shown) => !shown)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Feather name={showRecovery ? 'chevron-down' : 'chevron-right'} size={18} color={colors.textMuted} /><Text style={[type.body, { fontSize: 15 }]}>Recuperación · {copies.length} copias</Text></Pressable>
        {showRecovery && <>
          <Text style={[type.small, { fontSize: 14, lineHeight: 22 }]}>Restaurar reemplaza la biblioteca y se sincroniza con tu otro dispositivo. Antes guardamos una copia del estado actual.</Text>
          {copies.map((copy) => <View key={copy.id} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.small, { fontSize: 14 }]}>{new Date(copy.created_at).toLocaleString()} · {copy.reason}</Text>
            <Button label="Restaurar esta copia" disabled={busy} onPress={() => run(async () => {
              if (await confirmAsync('Restaurar biblioteca', 'Se reemplazará la biblioteca actual por esta copia. Conservaremos el estado actual en Recuperación antes de sincronizar.')) await engine.restoreCopy(copy.id);
            })} />
          </View>)}
        </>}
      </View>}
    </Card>;
  }
  return <Card style={{ gap: spacing.md }}>
    <Text style={type.heading}>Cuenta privada</Text>
    <Text style={type.small}>Biblioteca, imágenes, repasos, progreso, límites diarios y conversaciones del Gimnasio entre tu PC y Android.</Text>
    {status.user ? <>
      <Text style={type.body}>{status.user.email}</Text>
      <Text style={[type.small, status.error && { color: colors.danger }]} accessibilityLiveRegion="polite">{error || status.message}</Text>
      {status.syncedAt && <Text style={type.small}>Última sincronización: {new Date(status.syncedAt).toLocaleString()}</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Button label={busy ? "Sincronizando…" : "Sincronizar ahora"} kind="primary" disabled={busy} onPress={() => run(() => engine.sync())} />
        <Button label="Cerrar sesión" disabled={busy} onPress={() => run(() => engine.logout())} />
      </View>
      {copies.length > 0 && <>
        <Text style={type.heading}>Recuperación</Text>
        <Text style={type.small}>Estas copias conservan tu biblioteca antes de incorporar cambios. Restaurar una copia reemplaza el contenido actual y se sincroniza con tu otro dispositivo; antes se guarda otra copia.</Text>
        {copies.map((copy) => <View key={copy.id} style={{ gap: spacing.sm }}>
          <Text style={type.small}>{new Date(copy.created_at).toLocaleString()} · {copy.reason}</Text>
          <Button label="Restaurar esta copia" disabled={busy} onPress={() => run(async () => {
            if (await confirmAsync("Restaurar biblioteca", "Se reemplazará la biblioteca actual por esta copia. Conservaremos el estado actual en Recuperación antes de sincronizar.")) await engine.restoreCopy(copy.id);
          })} />
        </View>)}
      </>}
    </> : <>
      <Text style={type.small}>Entrá con el correo y la contraseña de REANCLA. El acceso es solo tuyo y los datos de ambas apps se guardan separados.</Text>
      <Field accessibilityLabel="Correo de la cuenta" placeholder="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
      <Field accessibilityLabel="Contraseña de la cuenta" placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} onSubmitEditing={() => email.trim() && password && !busy && run(() => engine.login(email, password, remember))} />
      {Platform.OS === "web" && <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Switch accessibilityLabel="Recordar sesión en esta PC" value={remember} onValueChange={setRemember} disabled={busy} />
        <Text style={type.small}>Recordar sesión en esta PC</Text>
      </View>}
      <Text style={type.small} accessibilityLiveRegion="polite">{error || status.message}</Text>
      <Button label={working ? "Conectando…" : "Conectar cuenta"} kind="primary" disabled={busy || !email.trim() || !password} onPress={() => run(() => engine.login(email, password, remember))} />
      <Button label="Reconectar sesión guardada" disabled={busy} onPress={() => run(() => engine.restore())} />
    </>}
  </Card>;
}
