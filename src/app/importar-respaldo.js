import Feather from "@expo/vector-icons/Feather";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, confirmAsync, EmptyState, Pill, Screen } from "../components/ui";
import { mergeParsedBackup } from "../lib/backupIO";
import { clearPendingImport, getPendingImport } from "../lib/pendingImport";
import { toPlainText } from "../lib/richtext";
import { colors, spacing, type } from "../theme";

function Checkbox({ checked, partial, onPress }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[styles.checkbox, (checked || partial) && styles.checkboxActive]}
    >
      {checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
      {!checked && partial ? <View style={styles.partial} /> : null}
    </Pressable>
  );
}

function RenameNote({ node }) {
  if (!node.renamed) return null;
  return <Text style={styles.rename}>Se agregará como “{node.importName}”</Text>;
}

export default function ImportarRespaldo() {
  const router = useRouter();
  const pending = useMemo(() => getPendingImport(), []);
  const plan = pending?.plan;
  const [selectedCards, setSelectedCards] = useState(
    () => new Set(plan?.initialSelection.cardIds || [])
  );
  const [selectedChats, setSelectedChats] = useState(
    () => new Set(plan?.initialSelection.chatIds || [])
  );
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  if (!pending || !plan) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Agregar respaldo" }} />
        <EmptyState icon="archive" text="No hay un respaldo pendiente para revisar." full />
        <Button label="Volver a Ajustes" onPress={() => router.replace("/ajustes")} />
      </Screen>
    );
  }

  const toggleExpanded = (key) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setCards = (ids, include) => {
    setSelectedCards((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (include) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const renderDeck = (deck, indent = false) => {
    const key = `deck-${deck.id}`;
    const ids = deck.cards.map((card) => card.id);
    const selectedCount = ids.filter((id) => selectedCards.has(id)).length;
    const checked = selectedCount === ids.length;
    const isOpen = expanded.has(key);
    return (
      <View key={key} style={[styles.branch, indent && styles.indented]}>
        <View style={styles.treeRow}>
          <Checkbox
            checked={checked}
            partial={selectedCount > 0 && !checked}
            onPress={() => setCards(ids, !checked)}
          />
          <Pressable style={styles.treeText} onPress={() => toggleExpanded(key)}>
            <Text style={type.body}>{deck.importName}</Text>
            <Text style={type.small}>
              {selectedCount} de {ids.length} tarjetas
              {deck.duplicateCount ? ` · ${deck.duplicateCount} repetidas omitidas` : ""}
            </Text>
            <RenameNote node={deck} />
          </Pressable>
          <Pressable onPress={() => toggleExpanded(key)} style={styles.expandButton}>
            <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        {isOpen ? deck.cards.map((card) => (
          <View key={`card-${card.id}`} style={styles.cardRow}>
            <Checkbox
              checked={selectedCards.has(card.id)}
              onPress={() => setCards([card.id], !selectedCards.has(card.id))}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.cardFront} numberOfLines={2}>{toPlainText(card.front)}</Text>
              <Text style={type.small} numberOfLines={2}>{toPlainText(card.back)}</Text>
            </View>
          </View>
        )) : null}
      </View>
    );
  };

  const selectedDecks = [...plan.folders.flatMap((folder) => folder.decks), ...plan.looseDecks]
    .filter((deck) => deck.cards.some((card) => selectedCards.has(card.id))).length;

  const apply = async () => {
    if (!selectedCards.size && !selectedChats.size) return;
    const ok = await confirmAsync(
      "Agregar lo seleccionado",
      `Se agregarán ${selectedCards.size} tarjetas y ${selectedChats.size} conversaciones. Antes se guardará una copia de seguridad automática.`
    );
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const merged = await mergeParsedBackup(
        pending.parsed,
        { cardIds: [...selectedCards], chatIds: [...selectedChats] },
        plan
      );
      clearPendingImport();
      setResult(merged);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const { counts } = result;
    return (
      <Screen>
        <Stack.Screen options={{ title: "Importación completa" }} />
        <View style={styles.success}>
          <Feather name="check-circle" size={52} color={colors.success} />
          <Text style={styles.successTitle}>Información agregada</Text>
          <Text style={type.body}>
            {counts.cards} tarjetas, {counts.decks} mazos y {counts.gym_chats} conversaciones nuevas.
          </Text>
          <Text style={type.small}>
            La copia de seguridad anterior se guardó automáticamente antes de aplicar los cambios.
          </Text>
        </View>
        <Button label="Volver a Ajustes" kind="primary" onPress={() => router.replace("/ajustes")} />
      </Screen>
    );
  }

  const nothingNew = plan.counts.cards === 0 && plan.counts.chats === 0;
  return (
    <Screen>
      <Stack.Screen options={{ title: "Agregar respaldo" }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.title}>Revisá qué querés sumar</Text>
          <Text style={type.small}>
            Tus datos actuales no se borran. Podés desmarcar carpetas, mazos, tarjetas o conversaciones.
          </Text>
          <View style={styles.pills}>
            <Pill label={`${selectedCards.size} tarjetas`} icon="copy" color={colors.accentText} />
            <Pill label={`${selectedDecks} mazos`} icon="layers" />
            <Pill label={`${selectedChats.size} charlas`} icon="message-circle" />
          </View>
          {plan.counts.duplicateCards || plan.counts.duplicateChats ? (
            <Text style={styles.omitted}>
              Se omiten automáticamente {plan.counts.duplicateCards} tarjetas y {plan.counts.duplicateChats} conversaciones repetidas.
            </Text>
          ) : null}
        </View>

        {nothingNew ? (
          <Card style={styles.emptyCard}>
            <Feather name="check" size={28} color={colors.success} />
            <Text style={type.body}>Este respaldo no contiene información nueva.</Text>
            <Text style={type.small}>No se hará ningún cambio.</Text>
          </Card>
        ) : null}

        {plan.folders.map((folder) => {
          const ids = folder.decks.flatMap((deck) => deck.cards.map((card) => card.id));
          const selectedCount = ids.filter((id) => selectedCards.has(id)).length;
          const checked = selectedCount === ids.length;
          const key = `folder-${folder.id}`;
          const isOpen = expanded.has(key);
          return (
            <Card key={key} style={styles.section}>
              <View style={styles.treeRow}>
                <Checkbox
                  checked={checked}
                  partial={selectedCount > 0 && !checked}
                  onPress={() => setCards(ids, !checked)}
                />
                <Pressable style={styles.treeText} onPress={() => toggleExpanded(key)}>
                  <Text style={styles.sectionTitle}>{folder.importName}</Text>
                  <Text style={type.small}>{selectedCount} de {ids.length} tarjetas</Text>
                  <RenameNote node={folder} />
                </Pressable>
                <Pressable onPress={() => toggleExpanded(key)} style={styles.expandButton}>
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              {isOpen ? folder.decks.map((deck) => renderDeck(deck, true)) : null}
            </Card>
          );
        })}

        {plan.looseDecks.length ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Mazos sin carpeta</Text>
            {plan.looseDecks.map((deck) => renderDeck(deck))}
          </Card>
        ) : null}

        {plan.chats.length ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Conversaciones del Gimnasio Mental</Text>
            {plan.chats.map((chat) => (
              <View key={`chat-${chat.id}`} style={styles.chatRow}>
                <Checkbox
                  checked={selectedChats.has(chat.id)}
                  onPress={() => setSelectedChats((current) => {
                    const next = new Set(current);
                    if (next.has(chat.id)) next.delete(chat.id);
                    else next.add(chat.id);
                    return next;
                  })}
                />
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{chat.title}</Text>
                  <Text style={type.small}>{chat.messageCount} mensajes</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={busy ? "Agregando…" : `Agregar ${selectedCards.size + selectedChats.size} elementos`}
          kind="primary"
          disabled={busy || (!selectedCards.size && !selectedChats.size)}
          onPress={apply}
        />
        <Button label="Cancelar" kind="ghost" disabled={busy} onPress={() => {
          clearPendingImport();
          router.back();
        }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  intro: { gap: spacing.sm },
  title: { ...type.h2 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  omitted: { ...type.small, color: colors.streak },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.label, flex: 1 },
  treeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  treeText: { flex: 1, gap: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  partial: { width: 10, height: 2, borderRadius: 2, backgroundColor: "#FFFFFF" },
  expandButton: { padding: spacing.xs },
  branch: { gap: spacing.xs, paddingVertical: spacing.xs },
  indented: { marginLeft: spacing.md, paddingLeft: spacing.sm, borderLeftWidth: 1, borderLeftColor: colors.cardBorder },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginLeft: spacing.lg,
    paddingVertical: spacing.xs,
  },
  cardFront: { ...type.body, fontSize: 14 },
  chatRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  rename: { ...type.small, color: colors.accentText },
  emptyCard: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  success: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  successTitle: { ...type.h2, textAlign: "center" },
  error: { ...type.small, color: colors.danger },
});
