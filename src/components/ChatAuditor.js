// Gimnasio Mental: conversación iterativa con el Auditor Exigente.
// El usuario propone una conexión (texto o dictado), Claude la audita.
// Si la critica → puede replantearla acá mismo, las veces que quiera.
// Si la valida → se guarda la conexión y nace una tarjeta híbrida.

import { useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { createCard } from "../db/cards";
import { saveConnection } from "../db/connections";
import { auditConnection } from "../lib/auditor";
import { colors, radius, spacing, type } from "../theme";
import MicButton from "./MicButton";
import { Button, Field } from "./ui";

export default function ChatAuditor({ card, onDone }) {
  const [transcript, setTranscript] = useState([]); // [{role: 'user'|'auditor', text}]
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [validated, setValidated] = useState(null); // {hybridCardId} al validar
  const scrollRef = useRef(null);
  const baseInputRef = useRef(""); // texto previo al dictado en curso

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const nextTranscript = [...transcript, { role: "user", text }];
    setTranscript(nextTranscript);
    setInput("");
    baseInputRef.current = "";
    setBusy(true);
    setError(null);
    try {
      const result = await auditConnection(card, nextTranscript);
      setTranscript([...nextTranscript, { role: "auditor", text: result.feedback }]);
      if (result.validated) {
        const hybridCardId = await createCard({
          deckId: card.deck_id,
          front: result.hybrid.front,
          back: result.hybrid.back,
          source: "hybrid",
          originCardId: card.id,
        });
        await saveConnection({
          cardId: card.id,
          finalText: text,
          transcript: [...nextTranscript, { role: "auditor", text: result.feedback }],
          hybridCardId,
        });
        setValidated({ hybridCardId, front: result.hybrid.front });
      }
    } catch (e) {
      setError(e.message || String(e));
      // Devolver el texto al input para no perder lo escrito.
      setTranscript(transcript);
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  const onMicTranscript = (text, isFinal) => {
    // Mientras dicta: base + parcial. Al finalizar, queda fijado.
    setInput(`${baseInputRef.current}${baseInputRef.current ? " " : ""}${text}`);
    if (isFinal) {
      baseInputRef.current = `${baseInputRef.current}${baseInputRef.current ? " " : ""}${text}`;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gimnasio Mental</Text>
      <Text style={type.small}>
        ¿Con qué otra idea, libro, materia o vivencia conectás este concepto?
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

      {validated ? (
        <View style={styles.validatedBox}>
          <Text style={styles.validatedTitle}>Conexión validada</Text>
          <Text style={type.small}>Nueva tarjeta híbrida: “{validated.front}”</Text>
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
              label={transcript.length > 0 ? "Replantear" : "Enviar al auditor"}
              kind="primary"
              style={{ flex: 1 }}
              onPress={send}
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
    padding: spacing.sm + 4,
    maxWidth: "88%",
  },
  bubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentSoft,
  },
  bubbleAuditor: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  validatedTitle: {
    ...type.body,
    fontWeight: "700",
    color: colors.success,
  },
});
