import { useEffect, useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { listRecoveries } from "../lib/syncLocal";
import { colors, spacing, type } from "../theme";
import { useCloudSync } from "./CloudSyncProvider";
import { Button, Card, confirmAsync, Field } from "./ui";

export default function AccountPanel() {
  const { status, engine } = useCloudSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const [copies, setCopies] = useState([]);
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
