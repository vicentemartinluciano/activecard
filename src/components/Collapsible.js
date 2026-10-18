// Sección plegable para Ajustes: cabecera siempre visible (ícono + título +
// resumen de una línea) y cuerpo que se abre al tocarla.
//
// El resumen existe para que plegado siga diciendo algo útil ("40 repasos · 15
// nuevas"): una sección cerrada que no informa nada es solo una puerta más.

import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from "react-native";

import { Card } from "./ui";
import { colors, font, spacing, type } from "../theme";

// LayoutAnimation en Android necesita este opt-in explícito.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function Collapsible({ icon, title, summary, defaultOpen = false, children, open: controlledOpen, onToggle, triggerHidden = false }) {
  const [internalOpen, setOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (onToggle) onToggle();
    else setOpen((o) => !o);
  };

  if (triggerHidden) return Platform.OS === "web" ? (
    <div aria-hidden={!open} inert={!open} style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition: "grid-template-rows 200ms ease, opacity 200ms ease" }}>
      <div style={{ minHeight: 0, overflow: "hidden" }}><Card style={{ gap: spacing.md }}>{children}</Card></div>
    </div>
  ) : open ? <Card style={{ gap: spacing.md }}>{children}</Card> : null;

  return (
    <Card style={{ gap: 0 }}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [styles.head, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        {icon ? <Feather name={icon} size={18} color={colors.accentText} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={type.small}>{summary}</Text> : null}
        </View>
        <Feather
          name={open ? "chevron-down" : "chevron-right"}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>
      {Platform.OS === "web" ? <div aria-hidden={!open} inert={!open} style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, transition: "grid-template-rows 200ms ease, opacity 200ms ease" }}>
        <div style={{ overflow: "hidden", minHeight: 0 }}><View style={styles.body}>{children}</View></div>
      </div> : open ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  title: {
    ...type.body,
    fontSize: 16,
    ...font(600),
  },
  body: {
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
});
