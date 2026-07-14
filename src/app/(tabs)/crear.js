import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import { InlineAdd, Screen } from "../../components/ui";
import { createDeck } from "../../db/decks";
import { createFolder } from "../../db/folders";
import { colors, glow, gradients, radius, spacing, type } from "../../theme";

const OPTIONS = [
  { key: "ia", emoji: "🤖", title: "Generar Mazo con IA", highlight: true },
  { key: "mazo", emoji: "✏️", title: "Nuevo Mazo Manual" },
  { key: "carpeta", emoji: "📁", title: "Crear Nueva Carpeta" },
];

// Hub de creación: única puerta de entrada para mazos con IA, mazos manuales y carpetas.
export default function Crear() {
  const router = useRouter();
  const [createStep, setCreateStep] = useState(null); // null | "mazo" | "carpeta"

  const onCreateDeck = async (name) => {
    const id = await createDeck(name);
    setCreateStep(null);
    router.push(`/mazos/${id}`);
  };

  const onCreateFolder = async (name) => {
    await createFolder(name);
    setCreateStep(null);
    router.push("/biblioteca");
  };

  const handlePress = (key) => {
    if (key === "ia") router.push("/crear/ia");
    else setCreateStep(key);
  };

  return (
    <Screen>
      <Text style={type.label}>ESTUDIO INTELIGENTE</Text>
      <Text style={[type.title, { marginBottom: spacing.lg }]}>¿Qué querés crear hoy?</Text>

      <View style={{ gap: spacing.md }}>
        {/* Excepción al patrón Card: Pressable directo porque la card IA
            intensifica su glow con hovered (web) / pressed (nativo), y Card
            no expone esos estados. El resto de la app sigue usando Card. */}
        {OPTIONS.map((opt) => (
          <Pressable
            key={opt.key}
            onPress={() => handlePress(opt.key)}
            style={({ pressed, hovered }) => [
              styles.row,
              opt.highlight && styles.rowIa,
              opt.highlight && (pressed || hovered) && styles.rowIaHot,
              !opt.highlight && pressed && { opacity: 0.7 },
            ]}
          >
            <LinearGradient
              colors={gradients.card}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rowInner}
            >
              <View style={styles.emojiBox}>
                <Text style={{ fontSize: 22 }}>{opt.emoji}</Text>
              </View>
              <Text style={[type.body, { fontWeight: "800" }]}>{opt.title}</Text>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      <ActionSheet
        visible={createStep !== null}
        onClose={() => setCreateStep(null)}
        title={createStep === "mazo" ? "Nuevo mazo" : "Nueva carpeta"}
      >
        {createStep === "mazo" ? (
          <InlineAdd placeholder="Nombre del mazo nuevo…" buttonLabel="Crear" onSubmit={onCreateDeck} />
        ) : null}
        {createStep === "carpeta" ? (
          <InlineAdd placeholder="Nombre de la carpeta…" buttonLabel="Crear" onSubmit={onCreateFolder} />
        ) : null}
      </ActionSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: "hidden",
  },
  rowIa: {
    borderColor: colors.neonBorder,
    ...glow.accent,
  },
  rowIaHot: {
    boxShadow: "0 0 20px rgba(77,124,255,0.65), 0 0 52px rgba(62,99,221,0.42)",
  },
  rowInner: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  emojiBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
