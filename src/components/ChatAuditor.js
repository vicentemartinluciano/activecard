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
import { createDeck, deleteDeck, getDeck, listDecks, renameDeck, setDeckFolder } from "../db/decks";
import { createFolder, deleteFolder, getFolder, renameFolder } from "../db/folders";
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
import { pickGymFiles } from "../lib/files";
import { toPlainText } from "../lib/richtext";
import { colors, font, radius, spacing, type } from "../theme";
import BrainMark from "./BrainMark";
import CardAttachmentSheet from "./CardAttachmentSheet";
import ActionSheet from "./ActionSheet";
import RichText from "./RichText";
import StarField from "./StarField";
import VoiceInput from "./VoiceInput";
import { Button, confirmAsync, Field } from "./ui";

const titleFrom = (text) => {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 44 ? `${clean.slice(0, 44)}…` : clean || "Nueva charla";
};

function AttachmentPills({ items = [], onRemove }) {
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentRow}>
      {items.map((item) => {
        const id = item.cardId || item.id;
        return (
          <View key={id} style={styles.attachmentPill}>
            <Feather name="file-text" size={14} color="#00F2FE" />
            <View style={styles.attachmentCopy}>
              <Text style={styles.attachmentTitle} numberOfLines={1}>{toPlainText(item.front)}</Text>
              <Text style={styles.attachmentDeck} numberOfLines={1}>{item.deckName || "Tarjeta"}</Text>
            </View>
            {onRemove ? (
              <Pressable onPress={() => onRemove(id)} hitSlop={8}>
                <Feather name="x" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

function SourcePills({ items = [], onRemove }) {
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentRow}>
      {items.map((item, index) => (
        <View key={`${item.name}-${index}`} style={styles.sourcePill}>
          <Feather name={item.mimeType?.startsWith("image/") ? "image" : "file"} size={14} color="#42DCE7" />
          <Text style={styles.attachmentTitle} numberOfLines={1}>{item.name}</Text>
          {onRemove ? (
            <Pressable onPress={() => onRemove(index)} hitSlop={8}>
              <Feather name="x" size={15} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const ACTION_LABELS = {
  edit_card: "CAMBIO PROPUESTO",
  create_card: "TARJETA PROPUESTA",
  delete_card: "ELIMINACIÓN PROPUESTA",
  create_cards: "TARJETAS PROPUESTAS",
  create_deck: "MAZO PROPUESTO",
  rename_deck: "CAMBIO DE MAZO",
  move_deck: "UBICACIÓN PROPUESTA",
  delete_deck: "ELIMINACIÓN DE MAZO",
  create_folder: "CARPETA PROPUESTA",
  rename_folder: "CAMBIO DE CARPETA",
  delete_folder: "ELIMINACIÓN DE CARPETA",
};

function ActionPreview({ message, onConfirm, onChoose, onToggleDeleteDeck, busy }) {
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
  if (!ACTION_LABELS[action.type]) return null;
  const done = action.status === "done";
  const destructive = ["delete_card", "delete_deck", "delete_folder"].includes(action.type);
  const cards = action.cards || [];
  return (
    <View style={styles.actionCard}>
      <Text style={styles.actionEyebrow}>{ACTION_LABELS[action.type]}</Text>
      {action.before ? (
        <View style={styles.beforeBox}>
          <Text style={styles.miniLabel}>ANTES</Text>
          <Text style={styles.previewText}>{toPlainText(action.before.front || action.before.name)}</Text>
          {action.before.back ? <Text style={styles.previewMuted}>{toPlainText(action.before.back)}</Text> : null}
        </View>
      ) : null}
      {["edit_card", "create_card"].includes(action.type) ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.miniLabel}>{action.type === "edit_card" ? "DESPUÉS" : "FRENTE"}</Text>
          <Text style={styles.previewText}>{toPlainText(action.front)}</Text>
          <Text style={styles.previewMuted}>{toPlainText(action.back)}</Text>
        </View>
      ) : null}
      {action.name ? (
        <View style={{ gap: 3 }}>
          <Text style={styles.miniLabel}>NOMBRE FINAL</Text>
          <Text style={styles.previewText}>{action.name}</Text>
          {action.locationLabel ? <Text style={styles.previewMuted}>{action.locationLabel}</Text> : null}
        </View>
      ) : null}
      {action.type === "move_deck" ? (
        <Text style={styles.previewText}>{action.locationLabel || "Sin carpeta"}</Text>
      ) : null}
      {action.locationLabel && !action.name && action.type !== "move_deck" ? (
        <Text style={styles.previewMuted}>{action.locationLabel}</Text>
      ) : null}
      {cards.length ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.miniLabel}>{cards.length} {cards.length === 1 ? "TARJETA" : "TARJETAS"}</Text>
          {cards.slice(0, 6).map((card, index) => (
            <View key={`${card.front}-${index}`} style={styles.proposedCard}>
              <Text style={styles.previewText}>{toPlainText(card.front)}</Text>
              <Text style={styles.previewMuted} numberOfLines={3}>{toPlainText(card.back)}</Text>
            </View>
          ))}
          {cards.length > 6 ? <Text style={styles.previewMuted}>Y {cards.length - 6} más…</Text> : null}
        </View>
      ) : null}
      {action.type === "delete_deck" ? (
        <Text style={styles.previewMuted}>
          {action.before?.card_count || 0} tarjetas · {action.before?.idea_count || 0} ideas
        </Text>
      ) : null}
      {action.type === "delete_folder" ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={styles.previewMuted}>Marcá los mazos que también querés eliminar. Los demás quedarán sueltos.</Text>
          {(action.decks || []).map((deck) => {
            const selected = (action.deleteDeckIds || []).includes(deck.id);
            return (
              <Pressable key={deck.id} disabled={done || busy} onPress={() => onToggleDeleteDeck(message, deck.id)} style={styles.deleteChoice}>
                <View style={[styles.deleteCheck, selected && styles.deleteCheckActive]}>
                  {selected ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{deck.name}</Text>
                  <Text style={styles.previewMuted}>{deck.card_count || 0} tarjetas · {deck.idea_count || 0} ideas</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Button
        label={done ? "Aplicado" : destructive ? "Revisar eliminación" : "Confirmar"}
        kind={destructive ? "danger" : "primary"}
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [sourceAttachments, setSourceAttachments] = useState([]);
  const [destructiveMessage, setDestructiveMessage] = useState(null);
  const [destructiveText, setDestructiveText] = useState("");
  const scrollRef = useRef(null);
  const saveTimer = useRef(null);

  const hydrateAction = useCallback(async (turn) => {
    const action = turn.action;
    if (!action) return action;
    if (["edit_card", "delete_card"].includes(action.type) && action.cardId) {
      const before = await getCard(action.cardId);
      return before ? { ...action, before: { front: before.front, back: before.back, deck_id: before.deck_id } } : action;
    }
    if (["rename_deck", "move_deck", "delete_deck"].includes(action.type) && action.deckId) {
      const [before, allDecks, folder] = await Promise.all([
        getDeck(action.deckId),
        listDecks(),
        action.folderId ? getFolder(action.folderId) : null,
      ]);
      const summary = allDecks.find((deck) => deck.id === action.deckId);
      return {
        ...action,
        before: before ? { ...before, card_count: summary?.card_count || 0, idea_count: summary?.idea_count || 0 } : null,
        locationLabel: action.type === "move_deck" ? (folder ? `Carpeta: ${folder.name}` : "Sin carpeta") : undefined,
      };
    }
    if (["rename_folder", "delete_folder"].includes(action.type) && action.folderId) {
      const [before, allDecks] = await Promise.all([getFolder(action.folderId), listDecks()]);
      const children = allDecks.filter((deck) => Number(deck.folder_id) === action.folderId);
      return { ...action, before, decks: children };
    }
    if (action.type === "create_deck" && action.folderId) {
      const folder = await getFolder(action.folderId);
      return { ...action, locationLabel: folder ? `Carpeta: ${folder.name}` : "Sin carpeta" };
    }
    if (action.type === "create_cards" && action.deckId) {
      const deck = await getDeck(action.deckId);
      return { ...action, locationLabel: deck ? `Mazo: ${deck.name}` : "Mazo" };
    }
    return action;
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (persistentChatId) {
        const [chat, savedMessages] = await Promise.all([
          getGymChat(persistentChatId),
          listGymMessages(persistentChatId),
        ]);
        if (!alive) return;
        if (!chat) throw new Error("Esta conversación ya no existe.");
        setSession(chat);
        setMessages(savedMessages);
        setInput(chat?.draft_text || "");
        return;
      }
      if (!alive) return;
      // La charla todavía es efímera. Se crea en SQLite recién con el primer
      // envío, así abrir y cerrar el Gimnasio no ensucia el historial.
      setMessages([]);
      setInput("");
      setAttachments([]);
      setSourceAttachments([]);
      setSession({
        id: null,
        title: "Nueva charla",
        origin_card_id: originCardId,
        origin_front: card?.front || null,
        origin_back: card?.back || null,
        draft_text: "",
      });
    })().catch((e) => setError(e.message || String(e)));
    return () => {
      alive = false;
      clearTimeout(saveTimer.current);
    };
  }, [card?.back, card?.front, originCardId, persistentChatId]);

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

  const ensureSession = async () => {
    if (session?.id) return session;
    const id = await createGymChat({ originCardId: session?.origin_card_id || originCardId });
    const chat = await getGymChat(id);
    if (!chat) throw new Error("No pudimos crear la conversación.");
    setSession(chat);
    if (!hasEmbeddedCard) router.setParams({ chatId: String(id) });
    return chat;
  };

  const appendAssistant = async (turn, chat = session) => {
    const action = await hydrateAction(turn);
    const id = await addGymMessage(chat.id, "assistant", turn.message, action ? { action } : null);
    const row = { id, chat_id: chat.id, role: "assistant", text: turn.message, metadata: action ? { action } : null };
    setMessages((current) => [...current, row]);
    return row;
  };

  const send = async () => {
    const typedText = input.trim();
    if ((!typedText && attachments.length === 0 && sourceAttachments.length === 0) || busy || !session) return;
    setBusy(true);
    setError("");
    try {
      const chat = await ensureSession();
      const text = typedText || (sourceAttachments.length
        ? `Adjunté ${sourceAttachments.length} ${sourceAttachments.length === 1 ? "fuente" : "fuentes"}.`
        : `Adjunté ${attachments.length} ${attachments.length === 1 ? "tarjeta" : "tarjetas"}.`);
      const metadata = attachments.length || sourceAttachments.length
        ? {
            attachments: attachments.map((item) => ({
              cardId: item.id,
              deckId: item.deck_id,
              deckName: item.deckName,
              front: toPlainText(item.front).slice(0, 220),
            })),
            sources: sourceAttachments,
          }
        : null;
      clearTimeout(saveTimer.current);
      const id = await addGymMessage(chat.id, "user", text, metadata);
      const userMessage = { id, chat_id: chat.id, role: "user", text, metadata };
      const next = [...messages, userMessage];
      setMessages(next);
      setInput("");
      setAttachments([]);
      setSourceAttachments([]);
      await setGymChatDraft(chat.id, "");
      if (messages.length === 0 && chat.title === "Nueva charla") {
        const title = titleFrom(typedText || sourceAttachments[0]?.name || toPlainText(attachments[0]?.front || "Tarjetas adjuntas"));
        await renameGymChat(chat.id, title);
        setSession((current) => ({ ...current, title }));
      }
      const origin = card || (chat.origin_card_id ? await getCard(chat.origin_card_id) : null);
      const turn = await runGymAssistant({ originCard: origin, messages: next });
      await appendAssistant(turn, chat);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const addSources = async () => {
    setError("");
    try {
      const picked = await pickGymFiles();
      if (picked.length) {
        setSourceAttachments((current) => [...current, ...picked].slice(0, 6));
      }
    } catch (e) {
      setError(e.message || String(e));
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

  const saveAction = async (message, action) => {
    await updateGymMessageMetadata(message.id, { action });
    setMessages((current) => current.map((item) =>
      item.id === message.id ? { ...item, metadata: { action } } : item
    ));
  };

  const toggleDeleteDeck = async (message, deckId) => {
    const action = message.metadata.action;
    const selected = action.deleteDeckIds || [];
    const next = selected.includes(deckId)
      ? selected.filter((id) => id !== deckId)
      : [...selected, deckId];
    await saveAction(message, { ...action, deleteDeckIds: next });
  };

  const executeAction = async (message, { destructiveConfirmed = false } = {}) => {
    const action = message.metadata.action;
    if (!action || action.status === "done") return;
    if (["delete_deck", "delete_folder"].includes(action.type) && !destructiveConfirmed) {
      setDestructiveText("");
      setDestructiveMessage(message);
      return;
    }
    setBusy(true);
    try {
      const completedFields = {};
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
        completedFields.createdCardId = createdId;
        if (action.source === "hybrid" && (action.originCardId || session.origin_card_id)) {
          await saveConnection({
            cardId: action.originCardId || session.origin_card_id,
            finalText: toPlainText(action.back),
            transcript: messages.map((item) => ({ role: item.role, text: item.text })),
            hybridCardId: createdId,
          });
        }
      } else if (action.type === "create_cards") {
        if (!(await getDeck(action.deckId))) throw new Error("El mazo elegido ya no existe.");
        completedFields.createdCardIds = [];
        for (const proposal of action.cards) {
          completedFields.createdCardIds.push(await createCard({
            deckId: action.deckId,
            front: proposal.front,
            back: proposal.back,
            source: "manual",
          }));
        }
      } else if (action.type === "create_deck") {
        if (action.folderId && !(await getFolder(action.folderId))) throw new Error("La carpeta elegida ya no existe.");
        const deckId = await createDeck(action.name);
        if (action.folderId) await setDeckFolder(deckId, action.folderId);
        completedFields.createdDeckId = deckId;
        completedFields.createdCardIds = [];
        for (const proposal of action.cards || []) {
          completedFields.createdCardIds.push(await createCard({
            deckId,
            front: proposal.front,
            back: proposal.back,
            source: "manual",
          }));
        }
      } else if (action.type === "rename_deck") {
        if (!(await getDeck(action.deckId))) throw new Error("El mazo ya no existe.");
        await renameDeck(action.deckId, action.name);
      } else if (action.type === "move_deck") {
        if (!(await getDeck(action.deckId))) throw new Error("El mazo ya no existe.");
        if (action.folderId && !(await getFolder(action.folderId))) throw new Error("La carpeta elegida ya no existe.");
        await setDeckFolder(action.deckId, action.folderId || null);
      } else if (action.type === "create_folder") {
        completedFields.createdFolderId = await createFolder(action.name);
      } else if (action.type === "rename_folder") {
        if (!(await getFolder(action.folderId))) throw new Error("La carpeta ya no existe.");
        await renameFolder(action.folderId, action.name);
      } else if (action.type === "delete_card") {
        if (!(await getCard(action.cardId))) throw new Error("La tarjeta ya no existe.");
        const ok = await confirmAsync("Eliminar esta tarjeta", "Esta acción no se puede deshacer.");
        if (!ok) return;
        await deleteCard(action.cardId);
      } else if (action.type === "delete_deck") {
        if (!(await getDeck(action.deckId))) throw new Error("El mazo ya no existe.");
        await deleteDeck(action.deckId);
      } else if (action.type === "delete_folder") {
        if (!(await getFolder(action.folderId))) throw new Error("La carpeta ya no existe.");
        const children = await listDecks();
        const childIds = new Set(children.filter((deck) => Number(deck.folder_id) === action.folderId).map((deck) => deck.id));
        const selected = (action.deleteDeckIds || []).filter((deckId) => childIds.has(deckId));
        for (const deckId of selected) await deleteDeck(deckId);
        await deleteFolder(action.folderId);
      }
      await saveAction(message, { ...action, ...completedFields, status: "done" });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmAction = (message) => executeAction(message);

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

  const destructiveAction = destructiveMessage?.metadata?.action;
  const destructiveName = destructiveAction?.before?.name || "";
  const destructiveDecks = destructiveAction?.type === "delete_folder"
    ? (destructiveAction.decks || []).filter((deck) => (destructiveAction.deleteDeckIds || []).includes(deck.id))
    : [];
  const destructiveCounts = destructiveAction?.type === "delete_deck"
    ? {
        cards: destructiveAction.before?.card_count || 0,
        ideas: destructiveAction.before?.idea_count || 0,
      }
    : destructiveDecks.reduce((totals, deck) => ({
        cards: totals.cards + (deck.card_count || 0),
        ideas: totals.ideas + (deck.idea_count || 0),
      }), { cards: 0, ideas: 0 });

  const confirmDestructive = async () => {
    if (!destructiveMessage || destructiveText.trim() !== destructiveName) return;
    const message = destructiveMessage;
    setDestructiveMessage(null);
    setDestructiveText("");
    await executeAction(message, { destructiveConfirmed: true });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, keyboardOpen && styles.rootKeyboard]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 16 : 0}
    >
      <StarField />
      <View style={styles.header}>
        <Pressable onPress={close} style={styles.backButton} hitSlop={8}>
          <Feather name="arrow-left" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gimnasio Mental</Text>
          <Text style={styles.saved}>Conversá, investigá y trabajá con tus tarjetas</Text>
        </View>
        <Pressable onPress={() => router.push("/gimnasio/historial")} style={styles.iconButton}>
          <Feather name="clock" size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push("/gimnasio/chat")} style={styles.iconButton}>
          <Feather name="edit-3" size={20} color={colors.text} />
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
            <View style={styles.avatar}><BrainMark size={34} /></View>
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.welcomeText}>Podemos pensar cualquier tema o trabajar con tus tarjetas. Decime qué necesitás.</Text>
            </View>
          </View>
        ) : null}
        {messages.map((message, index) => {
          const startsAssistantGroup = message.role === "assistant" && messages[index - 1]?.role !== "assistant";
          return (
            <View key={message.id} style={message.role === "user" ? styles.userWrap : styles.assistantWrap}>
              {startsAssistantGroup ? <View style={styles.avatar}><BrainMark size={32} /></View> : null}
              <View style={message.role === "user" ? styles.userMessageContent : styles.assistantMessageContent}>
                <AttachmentPills items={message.metadata?.attachments || []} />
                <SourcePills items={message.metadata?.sources || []} />
                <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                  {message.role === "assistant" ? (
                    <RichText text={message.text} style={styles.bubbleText} containerStyle={styles.richBubble} />
                  ) : (
                    <Text style={styles.bubbleText}>{message.text}</Text>
                  )}
                </View>
                <ActionPreview
                  message={message}
                  onConfirm={confirmAction}
                  onChoose={chooseCard}
                  onToggleDeleteDeck={toggleDeleteDeck}
                  busy={busy}
                />
              </View>
            </View>
          );
        })}
        {busy ? (
          <View style={styles.assistantWrap}>
            {messages[messages.length - 1]?.role !== "assistant" ? <View style={styles.avatar}><BrainMark size={32} /></View> : null}
            <View style={[styles.bubble, styles.assistantBubble, styles.busyBubble]}>
              <ActivityIndicator color="#42DCE7" />
            </View>
          </View>
        ) : null}
      </ScrollView>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AttachmentPills
        items={attachments}
        onRemove={(id) => setAttachments((current) => current.filter((item) => item.id !== id))}
      />
      <SourcePills
        items={sourceAttachments}
        onRemove={(index) => setSourceAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
      />
      <VoiceInput value={input} onChangeText={changeInput}>
        {({ micButton, active }) => (
          <View style={styles.composer}>
            <Pressable
              onPress={() => setAddMenuOpen(true)}
              disabled={active || busy}
              style={[styles.attachButton, (active || busy) && { opacity: 0.35 }]}
              hitSlop={6}
            >
              <Feather name="plus" size={21} color={colors.text} />
            </Pressable>
            <Field value={input} onChangeText={changeInput} placeholder="" multiline editable={!active} style={styles.field} />
            {micButton}
            <Pressable onPress={send} disabled={(!input.trim() && attachments.length === 0 && sourceAttachments.length === 0) || busy || active} style={[styles.send, ((!input.trim() && attachments.length === 0 && sourceAttachments.length === 0) || busy || active) && { opacity: 0.35 }]}>
              <Feather name="send" size={19} color="#fff" />
            </Pressable>
          </View>
        )}
      </VoiceInput>
      <ActionSheet
        visible={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title="Añadir al chat"
        options={[
          { label: "Añadir fuente", icon: "paperclip", onPress: addSources },
          { label: "Referenciar tarjetas", icon: "layers", onPress: () => setAttachmentSheetOpen(true) },
        ]}
      />
      <ActionSheet
        visible={!!destructiveMessage}
        onClose={() => {
          setDestructiveMessage(null);
          setDestructiveText("");
        }}
        title="Confirmación necesaria"
      >
        <View style={styles.dangerSummary}>
          <Feather name="alert-triangle" size={20} color={colors.danger} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.previewText}>
              {destructiveAction?.type === "delete_folder"
                ? `Se borrará la carpeta y ${destructiveDecks.length} ${destructiveDecks.length === 1 ? "mazo" : "mazos"}.`
                : "Se borrará el mazo completo."}
            </Text>
            <Text style={styles.previewMuted}>
              Esto elimina {destructiveCounts.cards} tarjetas, incluidas {destructiveCounts.ideas} ideas. No se puede deshacer.
            </Text>
          </View>
        </View>
        <Text style={styles.previewMuted}>Para confirmar, escribí exactamente: <Text style={styles.confirmName}>{destructiveName}</Text></Text>
        <Field value={destructiveText} onChangeText={setDestructiveText} placeholder={destructiveName} autoCapitalize="none" />
        <Button
          label="Eliminar definitivamente"
          kind="danger"
          disabled={destructiveText.trim() !== destructiveName || busy}
          onPress={confirmDestructive}
        />
      </ActionSheet>
      <CardAttachmentSheet
        visible={attachmentSheetOpen}
        onClose={() => setAttachmentSheetOpen(false)}
        selected={attachments}
        onConfirm={setAttachments}
      />
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
  welcome: { alignItems: "flex-start", gap: spacing.sm, width: "100%" },
  welcomeText: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  assistantWrap: { alignItems: "flex-start", gap: spacing.xs, alignSelf: "stretch" },
  userWrap: { alignSelf: "stretch", alignItems: "flex-end" },
  assistantMessageContent: { width: "100%", gap: spacing.xs },
  userMessageContent: { maxWidth: "88%", gap: spacing.xs, alignItems: "stretch" },
  avatar: { width: 34, height: 34, marginLeft: 5, alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: 12, borderRadius: radius.md },
  assistantBubble: { width: "100%", backgroundColor: "rgba(20,22,29,0.94)", borderWidth: 1, borderColor: "rgba(91,104,151,0.23)", borderTopLeftRadius: radius.md, borderBottomLeftRadius: 6 },
  userBubble: { backgroundColor: "rgba(28,37,72,0.9)", borderWidth: 1, borderColor: "rgba(92,116,209,0.34)", borderBottomRightRadius: 5 },
  bubbleText: { ...type.body, fontSize: 15, lineHeight: 22 },
  richBubble: { gap: 7 },
  busyBubble: { width: 54, minHeight: 44, alignItems: "center", justifyContent: "center" },
  actionCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: "rgba(15,20,29,0.94)" },
  actionEyebrow: { ...type.small, ...font(700), color: "#00F2FE", fontSize: 10, letterSpacing: 0.8 },
  beforeBox: { gap: 3, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.025)" },
  proposedCard: { gap: 2, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: "rgba(255,255,255,0.025)" },
  miniLabel: { ...type.small, ...font(700), fontSize: 9, color: colors.textMuted },
  previewText: { ...type.body, ...font(600), fontSize: 14 },
  previewMuted: { ...type.small, color: colors.textMuted },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  optionTitle: { ...type.body, ...font(600), fontSize: 14 },
  deleteChoice: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  deleteCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: colors.pillBorder, alignItems: "center", justifyContent: "center" },
  deleteCheckActive: { backgroundColor: colors.danger, borderColor: colors.danger },
  dangerSummary: { flexDirection: "row", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: "rgba(229,72,77,0.08)", borderWidth: 1, borderColor: "rgba(229,72,77,0.25)" },
  confirmName: { ...font(700), color: colors.text },
  error: { color: colors.danger, fontSize: 12 },
  attachmentRow: { gap: spacing.xs, paddingHorizontal: 1 },
  attachmentPill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, width: 190, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(65,190,240,0.28)", backgroundColor: "rgba(12,21,33,0.94)" },
  sourcePill: { flexDirection: "row", alignItems: "center", gap: spacing.xs, maxWidth: 220, paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(62,99,221,0.38)", backgroundColor: "rgba(18,24,48,0.9)" },
  attachmentCopy: { flex: 1, gap: 1 },
  attachmentTitle: { ...type.small, ...font(600), color: colors.text, fontSize: 11 },
  attachmentDeck: { ...type.small, fontSize: 9, color: colors.textMuted },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: 1, padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: "rgba(20,24,34,0.96)" },
  attachButton: { width: 34, height: 38, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  field: { flex: 1, minHeight: 38, maxHeight: 96, borderWidth: 0, backgroundColor: "transparent", paddingVertical: 6 },
  send: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
