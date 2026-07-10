import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDueCount } from "../db/reviewQueue";
import { colors, radius, spacing, type } from "../theme";

function MenuButton({ label, hint, onPress, primary }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonPrimary,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.buttonLabel, primary && styles.buttonLabelPrimary]}>
        {label}
      </Text>
      {hint ? <Text style={styles.buttonHint}>{hint}</Text> : null}
    </Pressable>
  );
}

export default function Home() {
  const router = useRouter();
  const [dueCount, setDueCount] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getDueCount()
        .then((n) => alive && setDueCount(n))
        .catch((e) => {
          console.warn("No se pudo leer la cola de repaso:", e);
          if (alive) setDueCount(null);
        });
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={type.title}>ActiveCard</Text>
        <Text style={type.subtitle}>Soberanía mental, un día a la vez.</Text>
      </View>

      <View style={styles.menu}>
        <MenuButton
          primary
          label={dueCount != null ? `Repasar (${dueCount})` : "Repasar"}
          hint="La cola de hoy"
          onPress={() => router.push("/repaso")}
        />
        <MenuButton
          label="Estudiar un mazo"
          hint="Modo rápido, deslizando"
          onPress={() => router.push("/mazos")}
        />
        <MenuButton
          label="Crear tarjetas"
          hint="Texto, archivo o Notion"
          onPress={() => router.push("/crear")}
        />
        <MenuButton label="Mazos" onPress={() => router.push("/mazos")} />
        <MenuButton label="Ajustes" onPress={() => router.push("/ajustes")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  menu: {
    gap: spacing.sm,
  },
  button: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonLabel: {
    ...type.body,
    fontWeight: "600",
  },
  buttonLabelPrimary: {
    color: colors.accent,
  },
  buttonHint: {
    ...type.small,
    marginTop: 2,
  },
});
