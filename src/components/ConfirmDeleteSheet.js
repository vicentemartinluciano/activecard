import { useEffect, useState } from "react";
import { Text } from "react-native";
import ActionSheet from "./ActionSheet";
import { Button, Field } from "./ui";
import { colors, type } from "../theme";

export default function ConfirmDeleteSheet({ visible, name, description, onClose, onConfirm }) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (visible) { setTyped(""); setError(""); } }, [visible]);
  return <ActionSheet visible={visible} title={`Borrar ${name}`} onClose={() => { if (!busy) onClose(); }}>
    <Text style={type.body}>{description}</Text>
    <Text style={type.small}>Para confirmar, escribí exactamente: {name}</Text>
    <Field accessibilityLabel="Nombre exacto para confirmar el borrado" value={typed} onChangeText={setTyped} autoCapitalize="none" />
    {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
    <Button label={busy ? "Borrando…" : "Borrar"} kind="danger" disabled={busy || typed !== name} onPress={async () => {
      if (busy || typed !== name) return;
      setBusy(true);
      try { await onConfirm(); onClose(); }
      catch (e) { setError(e.message || "No pudimos borrar. Volvé a intentar."); }
      finally { setBusy(false); }
    }} />
  </ActionSheet>;
}
