// Fila de tarjeta en el modo edición del mazo: frente y dorso a la vista, sin
// tener que entrar a cada una.
//
// RESTRICCIÓN QUE MANDA EL DISEÑO: NotionField en nativo es un WebView por
// instancia. Montar veinte a la vez cuelga el teléfono. Por eso SOLO la fila
// activa monta editores de verdad; las demás muestran el texto con RichText
// dentro de una caja con pinta de input. Al tocar otra fila, el padre guarda la
// anterior y mueve el editor. No cambiar esto sin medirlo en un mazo grande.

import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { memo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

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
  onGym,
  onMove,
}) {
  const front = active ? draft.front : card.front;
  const back = active ? draft.back : card.back;

  return (
    <View style={[styles.row, active && styles.rowActive, Platform.OS === "web" && { breakInside: "avoid", display: "inline-flex", width: "100%", marginBottom: 20 }]}>
      <View style={styles.head}>
        {onGym && <Pressable accessibilityRole="button" accessibilityLabel="Conversar sobre esta tarjeta" onPress={() => onGym(card.id)} style={styles.action}>
          <Feather name="message-circle" size={18} color={colors.accentText} />
        </Pressable>}
        {onToggleStar && <Pressable accessibilityRole="button" accessibilityLabel={card.starred ? "Quitar de destacadas" : "Destacar tarjeta"} accessibilityState={{ selected: !!card.starred }} onPress={() => onToggleStar(card.id)} hitSlop={2} style={styles.action}>
          {card.starred ? (
            <FontAwesome name="star" size={18} color="#FFC53D" />
          ) : (
            <Feather name="star" size={18} color={colors.textMuted} />
          )}
        </Pressable>}
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
        {onMove ? <>
          <Pressable accessibilityRole="button" accessibilityLabel="Subir tarjeta" disabled={index === 0} onPress={() => onMove(card.id, -1)} style={[styles.move, index === 0 && { opacity: .3 }]}><Feather name="arrow-up" size={16} color={colors.textMuted} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Bajar tarjeta" disabled={index === total - 1} onPress={() => onMove(card.id, 1)} style={[styles.move, index === total - 1 && { opacity: .3 }]}><Feather name="arrow-down" size={16} color={colors.textMuted} /></Pressable>
        </> : null}
        {onToggleSuspended && <Pressable accessibilityRole="button" accessibilityLabel={card.suspended ? "Reanudar tarjeta" : "Suspender tarjeta"} accessibilityState={{ selected: !!card.suspended }} onPress={() => onToggleSuspended(card.id)} hitSlop={2} style={styles.action}>
          <Feather
            name={card.suspended ? "play-circle" : "pause-circle"}
            size={18}
            color={card.suspended ? colors.accentText : colors.textMuted}
          />
        </Pressable>}
      </View>

      {active ? (
        <>
          <NotionField
            value={draft.front}
            minHeight={56}
            onChangeText={(v) => onChangeDraft({ ...draft, front: v })}
            placeholder="Frente"
            defaultAlign="center"
          />
          <NotionField
            value={draft.back}
            minHeight={56}
            onChangeText={(v) => onChangeDraft({ ...draft, back: v })}
            placeholder="Dorso"
          />
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Editar frente y dorso de la tarjeta"
          onPress={() => onActivate(card.id)}
          style={({ pressed }) => pressed && { opacity: 0.7 }}
        >
          <View style={styles.box}>
            <RichText text={front} style={styles.boxTextFront} defaultAlign="center" />
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
    minWidth: 0,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 15,
    padding: spacing.sm + 4,
    gap: spacing.sm,
    ...(Platform.OS === 'web' ? { padding: 16, gap: 12 } : {}),
  },
  rowActive: {
    borderColor: "rgba(62,99,221,0.55)",
  },
  head: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  headLabel: {
    ...type.small,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    ...font(700),
  },
  counter: {
    ...type.small,
    ...tabular,
    fontSize: 13,
    marginLeft: "auto",
  },
  ideaPill: {
    borderColor: "rgba(158,110,222,0.35)",
    backgroundColor: "rgba(158,110,222,0.10)",
    paddingVertical: 2,
  },
  action: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  move: { width: 28, height: 36, alignItems: "center", justifyContent: "center" },
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' ? { padding: 12 } : {}),
  },
  boxBack: {
    marginBottom: 0,
  },
  boxTextFront: { ...type.body, fontSize: 16, lineHeight: 23.2 },
  boxText: { ...type.body, fontSize: 16, lineHeight: 23.2 },
});
