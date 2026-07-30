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

export default function Collapsible({ icon, title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

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
      {open ? <View style={styles.body}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  title: {
    ...type.body,
    fontSize: 15,
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
