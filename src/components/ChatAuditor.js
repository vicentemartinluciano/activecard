// Gimnasio Mental: charla iterativa con el Socio Exigente.
// El usuario construye una conexión CON el socio (texto o dictado). Cuando la
// conexión está madura, el socio propone una síntesis (o el usuario la fuerza
// con "Sintetizar") → se muestra la tarjeta en un preview editable → al guardar
// se crea la conexión y nace la tarjeta híbrida (una tarjeta más, entra a FSRS).

import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { createCard } from "../db/cards";
import { saveConnection } from "../db/connections";
import { auditConnection } from "../lib/auditor";
import { toPlainText } from "../lib/richtext";
import { colors, radius, spacing, type } from "../theme";
import MicButton from "./MicButton";
import NotionField from "./NotionField";
import { Button, Field } from "./ui";

export default function ChatAuditor({ card, onDone }) {
  // stage: 'chat' (charla) | 'preview' (tarjeta editable) | 'saved' (guardada)
  const [stage, setStage] = useState("chat");
  const [transcript, setTranscript] = useState([]); // [{role:'user'|'auditor', text, card?}]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({ front: "", back: "" }); // tarjeta en preview
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null); // {hybridCardId, front} tras guardar
  const scrollRef = useRef(null);
  const baseInputRef = useRef(""); // texto previo al dictado en curso

  // Un turno de charla. forceSynthesis lo dispara el botón "Sintetizar": puede
  // ir sin texto nuevo (solo pide cerrar con lo que ya hay).
  const send = async ({ forceSynthesis = false } = {}) => {
    const text = input.trim();
    if (busy) return;
    if (!text && !forceSynthesis) return;
    const nextTranscript = text ? [...transcript, { role: "user", text }] : transcript;
    setTranscript(nextTranscript);
    setInput("");
    baseInputRef.current = "";
    setBusy(true);
    setError(null);
    try {
      const turn = await auditConnection(card, nextTranscript, { forceSynthesis });
      const auditorMsg = turn.card
        ? { role: "auditor", text: turn.message, card: turn.card }
        : { role: "auditor", text: turn.message };
      setTranscript([...nextTranscript, auditorMsg]);
      if (turn.mode === "sintesis") {
        setDraft({ ...turn.card });
        setStage("preview");
      }
    } catch (e) {
      setError(e.message || String(e));
      // Restaurar el estado previo para no perder lo escrito.
      setTranscript(transcript);
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  // Guardar la tarjeta editada: crea la híbrida y registra la conexión.
  const confirmSave = async () => {
    if (!draft.front.trim() || !draft.back.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const hybridCardId = await createCard({
        deckId: card.deck_id,
        front: draft.front,
        back: draft.back,
        source: "hybrid",
        originCardId: card.id,
      });
      await saveConnection({
        cardId: card.id,
        finalText: toPlainText(draft.back),
        transcript,
        hybridCardId,
      });
      setSaved({ hybridCardId, front: draft.front });
      setStage("saved");
    } catch (e) {
      setError(e.message || String(e)); // queda en preview, se puede reintentar
    } finally {
      setSaving(false);
    }
  };

  const onMicTranscript = (text, isFinal) => {
    // Mientras dicta: base + parcial. Al finalizar, queda fijado.
    setInput(`${baseInputRef.current}${baseInputRef.current ? " " : ""}${text}`);
    if (isFinal) {
      baseInputRef.current = `${baseInputRef.current}${baseInputRef.current ? " " : ""}${text}`;
    }
  };

  // --- Preview: la tarjeta propuesta, editable como cualquier otra ---
  if (stage === "preview") {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Tarjeta propuesta</Text>
        <Text style={type.small}>Ajustala como quieras antes de guardarla.</Text>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.sm }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={type.small}>Frente (pregunta)</Text>
            <NotionField
              value={draft.front}
              onChangeText={(v) => setDraft((d) => ({ ...d, front: v }))}
              defaultAlign="center"
            />
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text style={type.small}>Dorso (síntesis)</Text>
            <NotionField
              value={draft.back}
              onChangeText={(v) => setDraft((d) => ({ ...d, back: v }))}
            />
          </View>
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={saving ? "Guardando…" : "Guardar tarjeta"}
          kind="primary"
          onPress={confirmSave}
          disabled={!draft.front.trim() || !draft.back.trim() || saving}
        />
        <View style={styles.actions}>
          <Button
            label="Seguir charlando"
            kind="ghost"
            style={{ flex: 1 }}
            onPress={() => {
              setError(null);
              setStage("chat");
            }}
          />
          <Button label="Saltar" kind="ghost" onPress={() => onDone({ skipped: true })} />
        </View>
      </View>
    );
  }

  // --- Charla ---
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gimnasio Mental</Text>
      <Text style={type.small}>
        Charlá con tu socio: ¿con qué otra idea, libro, materia o vivencia conectás este concepto?
      </Text>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}
        onContentSizeChange={() => scrollRef.current && scrollRef.current.scrollToEnd()}
      >
        {transcript.map((m, i) => (
          <View
            key={i}
            style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleAuditor]}
          >
            <Text style={styles.bubbleText}>{m.text}</Text>
          </View>
        ))}
        {busy ? (
          <View style={[styles.bubble, styles.bubbleAuditor]}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {saved ? (
        <View style={styles.validatedBox}>
          <Text style={styles.validatedTitle}>Conexión validada</Text>
          <Text style={type.small}>Nueva tarjeta híbrida: “{saved.front}”</Text>
          <Button label="Continuar" kind="primary" onPress={() => onDone({ validated: true })} />
        </View>
      ) : (
        <>
          <View style={styles.inputRow}>
            <Field
              value={input}
              onChangeText={(v) => {
                setInput(v);
                baseInputRef.current = v;
              }}
              placeholder="Escribí tu conexión…"
              multiline
              style={{ flex: 1, minHeight: 60 }}
            />
            <MicButton onTranscript={onMicTranscript} />
          </View>
          <View style={styles.actions}>
            <Button label="Saltar" kind="ghost" onPress={() => onDone({ skipped: true })} />
            <Button
              label="Sintetizar"
              onPress={() => send({ forceSynthesis: true })}
              disabled={busy || !transcript.some((m) => m.role === "user")}
            />
            <Button
              label="Enviar"
              kind="primary"
              style={{ flex: 1 }}
              onPress={() => send()}
              disabled={!input.trim() || busy}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  title: {
    ...type.body,
    fontWeight: "700",
    color: colors.accent,
  },
  chat: {
    flex: 1,
  },
  bubble: {
    borderRadius: radius.md,
    padding: spacing.md,
    maxWidth: "88%",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentSoft,
  },
  bubbleAuditor: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    ...type.body,
    fontSize: 15,
    lineHeight: 21,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  inputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-end",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  validatedBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.successBright,
    backgroundColor: colors.surfaceCard,
  },
  validatedTitle: {
    ...type.body,
    fontWeight: "700",
    color: colors.successBright,
  },
});
