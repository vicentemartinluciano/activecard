// Fila de tarjeta en el modo edición del mazo: frente y dorso a la vista, sin
// tener que entrar a cada una.
//
// RESTRICCIÓN QUE MANDA EL DISEÑO: NotionField en nativo es un WebView por
// instancia. Montar veinte a la vez cuelga el teléfono. Por eso SOLO la fila
// activa monta editores de verdad; las demás muestran el texto con RichText
// dentro de una caja con pinta de input. Al tocar otra fila, el padre guarda la
// anterior y mueve el editor. No cambiar esto sin medirlo en un mazo grande.

import { Feather, FontAwesome } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import NotionField from "./NotionField";
import RichText from "./RichText";
import { Pill } from "./ui";
import { colors, font, spacing, tabular, textColors, type } from "../theme";

function EditableCardRow({
  card,
  index,
  total,
  active,
  draft,
  onActivate,
  onChangeDraft,
  onToggleStar,
  onToggleSuspended,
}) {
  const front = active ? draft.front : card.front;
  const back = active ? draft.back : card.back;

  return (
    <View style={[styles.row, active && styles.rowActive]}>
      <View style={styles.head}>
        <Pressable onPress={() => onToggleStar(card.id)} hitSlop={10}>
          {card.starred ? (
            <FontAwesome name="star" size={15} color="#FFC53D" />
          ) : (
            <Feather name="star" size={15} color={colors.textMuted} style={{ opacity: 0.4 }} />
          )}
        </Pressable>
        <Text style={styles.headLabel}>Tarjeta</Text>
        {card.source === "hybrid" ? (
          <Pill icon="zap" label="Idea" color={textColors.violeta} style={styles.ideaPill} />
        ) : null}
        {card.source === "ai" ? (
          <Pill icon="cpu" label="Sin revisar" color={colors.accentText} style={styles.ideaPill} />
        ) : null}
        {card.suspended ? (
          <Pill
            icon="pause-circle"
            label="Suspendida"
            color={colors.textMuted}
            style={styles.ideaPill}
          />
        ) : null}
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>
        <Pressable onPress={() => onToggleSuspended(card.id)} hitSlop={10}>
          <Feather
            name={card.suspended ? "play-circle" : "pause-circle"}
            size={15}
            color={card.suspended ? colors.accentText : colors.textMuted}
            style={{ opacity: card.suspended ? 1 : 0.45 }}
          />
        </Pressable>
      </View>

      {active ? (
        <>
          <NotionField
            value={draft.front}
            onChangeText={(v) => onChangeDraft({ ...draft, front: v })}
            placeholder="Frente"
            defaultAlign="center"
          />
          <NotionField
            value={draft.back}
            onChangeText={(v) => onChangeDraft({ ...draft, back: v })}
            placeholder="Dorso"
          />
        </>
      ) : (
        <Pressable
          onPress={() => onActivate(card.id)}
          style={({ pressed }) => pressed && { opacity: 0.7 }}
        >
          <View style={styles.box}>
            <RichText text={front} style={styles.boxTextFront} defaultAlign="left" />
          </View>
          <View style={[styles.box, styles.boxBack]}>
            <RichText text={back} style={styles.boxText} defaultAlign="left" />
          </View>
        </Pressable>
      )}
    </View>
  );
}

// La lista puede tener decenas de filas y solo cambia la activa: sin memo, un
// tecleo en el editor re-renderiza todas.
export default memo(EditableCardRow);

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 15,
    padding: spacing.sm + 4,
    gap: spacing.sm,
  },
  rowActive: {
    borderColor: "rgba(62,99,221,0.55)",
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headLabel: {
    ...type.small,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
    ...font(700),
  },
  counter: {
    ...type.small,
    ...tabular,
    fontSize: 11,
    marginLeft: "auto",
  },
  ideaPill: {
    borderColor: "rgba(158,110,222,0.35)",
    backgroundColor: "rgba(158,110,222,0.10)",
    paddingVertical: 2,
  },
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: spacing.sm,
  },
  boxBack: {
    marginBottom: 0,
  },
  boxTextFront: {
    ...type.body,
    fontSize: 14,
    ...font(600),
    lineHeight: 20,
  },
  boxText: {
    ...type.body,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
});
