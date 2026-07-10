import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { Chip, Screen } from "../components/ui";
import { listDecks, listTags } from "../db/decks";
import { listPriorities, setPriority } from "../db/priorities";
import { getFocusDeckIds, setFocusDeckIds } from "../db/settings";
import { monthKey } from "../lib/queue";
import { colors, spacing, type } from "../theme";

const WEIGHTS = [
  { value: 1, label: "Normal" },
  { value: 2, label: "Alta" },
  { value: 3, label: "Máxima" },
];

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function PrioritySelector({ current, onChange }) {
  return (
    <View style={styles.weightRow}>
      {WEIGHTS.map((w) => (
        <Chip
          key={w.value}
          label={w.label}
          active={current === w.value}
          onPress={() => onChange(w.value)}
        />
      ))}
    </View>
  );
}

export default function Ajustes() {
  const month = monthKey();
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [focusIds, setFocusIds] = useState(null);

  const load = useCallback(async () => {
    const [d, t, p, f] = await Promise.all([
      listDecks(),
      listTags(),
      listPriorities(month),
      getFocusDeckIds(),
    ]);
    setDecks(d);
    setTags(t);
    setPriorities(p);
    setFocusIds(f);
  }, [month]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  const weightOf = (type_, id) => {
    const p = priorities.find((x) => x.target_type === type_ && x.target_id === id);
    return p ? p.weight : 1;
  };

  const changeWeight = async (type_, id, weight) => {
    await setPriority(type_, id, weight, month);
    load();
  };

  const focusEnabled = Array.isArray(focusIds) && focusIds.length > 0;

  const toggleFocus = async (enabled) => {
    await setFocusDeckIds(enabled ? decks.map((d) => d.id) : null);
    load();
  };

  const toggleFocusDeck = async (deckId) => {
    const current = focusIds || [];
    const next = current.includes(deckId)
      ? current.filter((d) => d !== deckId)
      : [...current, deckId];
    await setFocusDeckIds(next);
    load();
  };

  const monthLabel = `${MONTH_NAMES[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ajustes" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modo Enfoque</Text>
          <Text style={type.small}>
            Limitá el repaso diario a los mazos de un tema que quieras trabajar a fondo estos días.
          </Text>
          <View style={styles.focusRow}>
            <Text style={type.body}>Activar</Text>
            <Switch
              value={focusEnabled}
              onValueChange={toggleFocus}
              trackColor={{ true: colors.accentSoft, false: colors.surfaceHigh }}
              thumbColor={focusEnabled ? colors.accent : colors.textMuted}
            />
          </View>
          {focusEnabled ? (
            <View style={styles.chipWrap}>
              {decks.map((d) => (
                <Chip
                  key={d.id}
                  label={d.name}
                  active={(focusIds || []).includes(d.id)}
                  onPress={() => toggleFocusDeck(d.id)}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prioridades de {monthLabel}</Text>
          <Text style={type.small}>
            Lo que marques como Alta o Máxima aparece primero en el repaso del día.
          </Text>

          {decks.length === 0 && tags.length === 0 ? (
            <Text style={[type.small, { marginTop: spacing.sm }]}>
              Creá mazos para poder priorizarlos.
            </Text>
          ) : null}

          {decks.map((d) => (
            <View key={`d${d.id}`} style={styles.priorityItem}>
              <Text style={type.body}>{d.name}</Text>
              <PrioritySelector
                current={weightOf("deck", d.id)}
                onChange={(w) => changeWeight("deck", d.id, w)}
              />
            </View>
          ))}

          {tags.length > 0 ? (
            <Text style={[type.small, { marginTop: spacing.md }]}>Por etiqueta</Text>
          ) : null}
          {tags.map((t) => (
            <View key={`t${t.id}`} style={styles.priorityItem}>
              <Text style={type.body}>{t.name}</Text>
              <PrioritySelector
                current={weightOf("tag", t.id)}
                onChange={(w) => changeWeight("tag", t.id, w)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.body,
    fontWeight: "700",
  },
  focusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  priorityItem: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  weightRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
