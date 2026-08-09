import Feather from "@expo/vector-icons/Feather";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createCard, deleteCard, getCard, updateCardText } from "../db/cards";
import { saveConnection } from "../db/connections";
import { getDeck } from "../db/decks";
import {
  addGymMessage,
  createGymChat,
  getGymChat,
  listGymMessages,
  renameGymChat,
  setGymChatDraft,
  updateGymMessageMetadata,
} from "../db/gymChats";
import { resolveGymCardChoice, runGymAssistant } from "../lib/gymAssistant";
import { toPlainText } from "../lib/richtext";
import { colors, font, radius, spacing, type } from "../theme";
import StarField from "./StarField";
import VoiceInput from "./VoiceInput";
import { Button, confirmAsync, Field } from "./ui";

const titleFrom = (text) => {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 44 ? `${clean.slice(0, 44)}…` : clean || "Nueva charla";
};

function ActionPreview({ message, onConfirm, onChoose, busy }) {
  const action = message.metadata?.action;
  if (!action) return null;
  if (action.type === "choose_card") {
    const options = Array.isArray(action.options) ? action.options : [];
    const selectedCardId = action.selectedCardId;
    return (
      <View style={styles.actionCard}>
        {options.map((option) => (
          <Pressable
            key={option.cardId}
            disabled={selectedCardId != null || busy}
            onPress={() => onChoose(message, option.cardId)}
            style={[styles.optionRow, selectedCardId != null && option.cardId !== selectedCardId && { opacity: 0.45 }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.optionTitle} numberOfLines={2}>{option.front}</Text>
              <Text style={type.small}>{option.deckName}</Text>
            </View>
            <Feather name={selectedCardId === option.cardId ? "check" : "chevron-right"} size={18} color={selectedCardId === option.cardId ? "#00F2FE" : colors.textMuted} />
          </Pressable>
        ))}
      </View>
    );
  }
  if (!["edit_card", "create_card", "delete_card"].includes(action.type)) return null;
  const done = action.status === "done";
  return (
    <View style={styles.actionCard}>
      <Text style={styles.actionEyebrow}>
        {action.type === "edit_card" ? "CAMBIO PROPUESTO" : action.type === "create_card" ? "TARJETA PROPUESTA" : "ELIMINACIÓN PROPUESTA"}
      </Text>
      {action.before ? (
        <View style={styles.beforeBox}>
          <Text style={styles.miniLabel}>ANTES</Text>
          <Text style={styles.previewText}>{toPlainText(action.before.front)}</Text>
          <Text style={styles.previewMuted}>{toPlainText(action.before.back)}</Text>
        </View>
      ) : null}
      {action.type !== "delete_card" ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.miniLabel}>{action.type === "edit_card" ? "DESPUÉS" : "FRENTE"}</Text>
          <Text style={styles.previewText}>{toPlainText(action.front)}</Text>
          <Text style={styles.previewMuted}>{toPlainText(action.back)}</Text>
        </View>
      ) : null}
      <Button
        label={done ? "Aplicado" : action.type === "delete_card" ? "Revisar eliminación" : "Confirmar"}
        kind={action.type === "delete_card" ? "ghost" : "primary"}
        disabled={done || busy}
        onPress={() => onConfirm(message)}
      />
    </View>
  );
}

export default function ChatAuditor({ card = null, chatId = null, onDone = null }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const routeChatId = params.chatId ? Number(params.chatId) : null;
  const originCardId = card?.id || null;
  const hasEmbeddedCard = originCardId != null;
  // El repaso vive en la misma ruta mientras cambia de tarjeta. No tomamos un
  // chatId viejo de sus params: cada rayo abre su propia charla y su propia
  // referencia de origen. En la pantalla independiente sí hidratamos por URL.
  const persistentChatId = chatId || (!hasEmbeddedCard ? routeChatId : null) || null;
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef(null);
  const saveTimer = useRef(null);

  const hydrateAction = useCallback(async (turn) => {
    const action = turn.action;
    if (!action || !["edit_card", "delete_card"].includes(action.type) || !action.cardId) return action;
    const before = await getCard(action.cardId);
    return before ? { ...action, before: { front: before.front, back: before.back, deck_id: before.deck_id } } : action;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = persistentChatId || await createGymChat({ originCardId });
      const [chat, savedMessages] = await Promise.all([getGymChat(id), listGymMessages(id)]);
      if (!alive) return;
      if (!chat) throw new Error("Esta conversación ya no existe.");
      setSession(chat);
      setMessages(savedMessages);
      setInput(chat?.draft_text || "");
      if (!persistentChatId && !hasEmbeddedCard) router.setParams({ chatId: String(id) });
    })().catch((e) => setError(e.message || String(e)));
    return () => {
      alive = false;
      clearTimeout(saveTimer.current);
    };
  }, [hasEmbeddedCard, originCardId, persistentChatId, router]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardOpen(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardOpen(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const changeInput = (value) => {
    setInput(value);
    clearTimeout(saveTimer.current);
    if (session?.id) saveTimer.current = setTimeout(() => setGymChatDraft(session.id, value).catch(() => {}), 250);
  };

  const appendAssistant = async (turn) => {
    const action = await hydrateAction(turn);
    const id = await addGymMessage(session.id, "assistant", turn.message, action ? { action } : null);
    const row = { id, chat_id: session.id, role: "assistant", text: turn.message, metadata: action ? { action } : null };
    setMessages((current) => [...current, row]);
    return row;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !session) return;
    setBusy(true);
    setError("");
    try {
      clearTimeout(saveTimer.current);
      const id = await addGymMessage(session.id, "user", text);
      const userMessage = { id, chat_id: session.id, role: "user", text, metadata: null };
      const next = [...messages, userMessage];
      setMessages(next);
      setInput("");
      await setGymChatDraft(session.id, "");
      if (messages.length === 0 && session.title === "Nueva charla") {
        const title = titleFrom(text);
        await renameGymChat(session.id, title);
        setSession((current) => ({ ...current, title }));
      }
      const origin = card || (session.origin_card_id ? await getCard(session.origin_card_id) : null);
      const turn = await runGymAssistant({ originCard: origin, messages: next });
      await appendAssistant(turn);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseCard = async (message, cardId) => {
    if (busy) return;
    setBusy(true);
    try {
      const action = message.metadata.action;
      const origin = card || (session.origin_card_id ? await getCard(session.origin_card_id) : null);
      const turn = await resolveGymCardChoice({
        originCard: origin,
        messages,
        cardId,
        intent: action.intent,
        instruction: action.instruction,
      });
      await appendAssistant(turn);
      const completedChoice = { ...action, selectedCardId: cardId };
      await updateGymMessageMetadata(message.id, { action: completedChoice });
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, metadata: { action: completedChoice } } : item));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = async (message) => {
    const action = message.metadata.action;
    if (!action || action.status === "done") return;
    setBusy(true);
    try {
      if (action.type === "edit_card") {
        if (!(await getCard(action.cardId))) throw new Error("La tarjeta ya no existe.");
        await updateCardText(action.cardId, action.front, action.back);
      } else if (action.type === "create_card") {
        if (!(await getDeck(action.deckId))) throw new Error("El mazo elegido ya no existe.");
        const createdId = await createCard({
          deckId: action.deckId,
          front: action.front,
          back: action.back,
          source: action.source === "hybrid" ? "hybrid" : "manual",
          originCardId: action.source === "hybrid" ? action.originCardId || session.origin_card_id : null,
        });
        action.createdCardId = createdId;
        if (action.source === "hybrid" && (action.originCardId || session.origin_card_id)) {
          await saveConnection({
            cardId: action.originCardId || session.origin_card_id,
            finalText: toPlainText(action.back),
            transcript: messages.map((item) => ({ role: item.role, text: item.text })),
            hybridCardId: createdId,
          });
        }
      } else if (action.type === "delete_card") {
        if (!(await getCard(action.cardId))) throw new Error("La tarjeta ya no existe.");
        const ok = await confirmAsync("Eliminar esta tarjeta", "Esta acción no se puede deshacer.");
        if (!ok) return;
        await deleteCard(action.cardId);
      }
      const completed = { ...action, status: "done" };
      await updateGymMessageMetadata(message.id, { action: completed });
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, metadata: { action: completed } } : item));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!session) return <ActivityIndicator color={colors.accent} style={{ flex: 1 }} />;

  const result = () => ({
    chatted: messages.length > 0,
    validated: messages.some(
      (message) =>
        message.metadata?.action?.type === "create_card" &&
        message.metadata.action.source === "hybrid" &&
        message.metadata.action.status === "done"
    ),
  });

  const close = () => {
    if (onDone) onDone(result());
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, keyboardOpen && styles.rootKeyboard]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? -64 : 0}
    >
      <StarField />
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.backButton} hitSlop={8}>
          <Feather name="arrow-left" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gimnasio Mental</Text>
          <Text style={styles.saved}>Tu conversación se guarda automáticamente</Text>
        </View>
        <Pressable onPress={() => router.push("/gimnasio/historial")} style={styles.iconButton}>
          <Feather name="clock" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push("/gimnasio/chat")} style={styles.iconButton}>
          <Feather name="plus" size={21} color={colors.text} />
        </Pressable>
      </View>
      {(card || session.origin_front) ? (
        <View style={styles.contextPill}>
          <Feather name="book-open" size={15} color="#00F2FE" />
          <Text style={styles.contextText} numberOfLines={1}>{toPlainText(card?.front || session.origin_front)}</Text>
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <View style={styles.avatar}><Feather name="aperture" size={22} color="#00F2FE" /></View>
            <Text style={styles.welcomeText}>Podemos pensar cualquier tema o trabajar con tus tarjetas. Decime qué necesitás.</Text>
          </View>
        ) : null}
        {messages.map((message) => (
          <View key={message.id} style={message.role === "user" ? styles.userWrap : styles.assistantWrap}>
            {message.role === "assistant" ? <View style={styles.avatar}><Feather name="aperture" size={18} color="#00F2FE" /></View> : null}
            <View style={{ maxWidth: message.role === "user" ? "86%" : "88%", gap: spacing.xs }}>
              <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.bubbleText}>{message.text}</Text>
              </View>
              <ActionPreview message={message} onConfirm={confirmAction} onChoose={chooseCard} busy={busy} />
            </View>
          </View>
        ))}
        {busy ? <View style={[styles.assistantWrap, { alignItems: "center" }]}><View style={styles.avatar}><Feather name="aperture" size={18} color="#00F2FE" /></View><ActivityIndicator color="#00F2FE" /></View> : null}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.draftStatus}>{input ? "Borrador guardado" : "Guardado"}</Text>
      <View style={styles.composer}>
        <Field value={input} onChangeText={changeInput} placeholder="Preguntá, dictá o pedí un cambio…" multiline style={styles.field} />
        <VoiceInput value={input} onChangeText={changeInput} />
        <Pressable onPress={send} disabled={!input.trim() || busy} style={[styles.send, (!input.trim() || busy) && { opacity: 0.35 }]}>
          <Feather name="send" size={19} color="#fff" />
        </Pressable>
      </View>
      {onDone && !keyboardOpen ? (
        <Button
          label="Continuar el repaso"
          kind="ghost"
          onPress={close}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm, overflow: "hidden" },
  rootKeyboard: { paddingBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.xs },
  backButton: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
  title: { ...type.heading, fontSize: 23 },
  saved: { ...type.small, fontSize: 11 },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.cardBorder, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(21,21,24,0.7)" },
  contextPill: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(62,99,221,0.42)", backgroundColor: "rgba(12,18,31,0.78)" },
  contextText: { ...type.small, ...font(600), color: colors.text, flexShrink: 1 },
  chat: { flex: 1 },
  chatContent: { gap: spacing.md, paddingVertical: spacing.sm },
  welcome: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, maxWidth: "92%" },
  welcomeText: { ...type.body, flex: 1, color: colors.textMuted, lineHeight: 22 },
  assistantWrap: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, alignSelf: "stretch" },
  userWrap: { alignSelf: "stretch", alignItems: "flex-end" },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(65,190,240,0.3)", backgroundColor: "rgba(8,22,38,0.82)", alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.md },
  assistantBubble: { backgroundColor: "rgba(21,25,33,0.9)", borderTopWidth: 1, borderTopColor: "rgba(65,190,240,0.4)" },
  userBubble: { backgroundColor: "rgba(24,33,58,0.94)", borderWidth: 1, borderColor: "rgba(62,99,221,0.55)", borderBottomRightRadius: 5 },
  bubbleText: { ...type.body, fontSize: 15, lineHeight: 22 },
  actionCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: "rgba(15,20,29,0.94)" },
  actionEyebrow: { ...type.small, ...font(700), color: "#00F2FE", fontSize: 10, letterSpacing: 0.8 },
  beforeBox: { gap: 3, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.025)" },
  miniLabel: { ...type.small, ...font(700), fontSize: 9, color: colors.textMuted },
  previewText: { ...type.body, ...font(600), fontSize: 14 },
  previewMuted: { ...type.small, color: colors.textMuted },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  optionTitle: { ...type.body, ...font(600), fontSize: 14 },
  error: { color: colors.danger, fontSize: 12 },
  draftStatus: { ...type.small, fontSize: 10, color: "#00F2FE", marginLeft: spacing.sm },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: 1, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: "rgba(20,24,34,0.96)" },
  field: { flex: 1, minHeight: 38, maxHeight: 96, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 6 },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
