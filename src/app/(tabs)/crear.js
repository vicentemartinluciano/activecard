import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import GlowPressable from "../../components/GlowPressable";
import SectionSwipe from "../../components/SectionSwipe";
import Stagger from "../../components/Stagger";
import { InlineAdd, Screen } from "../../components/ui";
import { createDeck } from "../../db/decks";
import { createFolder } from "../../db/folders";
import { colors, font, gradients, radius, spacing, type } from "../../theme";

// Los emojis se quedan: decisión de Martín (se propuso pasarlos a Feather y lo
// rechazó). Las tres opciones reaccionan IGUAL — ninguna es "la destacada".
const OPTIONS = [
  { key: "ia", emoji: "🤖", title: "Generar Mazo con IA", description: 'Convertí tus fuentes y apuntes en propuestas de tarjetas para revisar.' },
  { key: "mazo", emoji: "✏️", title: "Nuevo Mazo Manual", description: 'Armá un mazo y escribí sus tarjetas con el editor.' },
  { key: "carpeta", emoji: "📁", title: "Crear Nueva Carpeta", description: 'Agrupá tus mazos por materia, tema o proyecto.' },
];

function CreationArea({ children }) {
  return Platform.OS === 'web'
    ? <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={{ flex: 1 }}>{children}</View>;
}

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
    <SectionSwipe index={1}>
    <Screen safeTop style={Platform.OS === 'web' ? { padding: 32 } : undefined}>
      <CreationArea>
      <View style={{ flex: 1, justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center', paddingTop: Platform.OS === 'web' ? 20 : 0 }}>
      <Text style={[type.title, { textAlign: Platform.OS === 'web' ? 'left' : 'center', marginBottom: spacing.lg, ...(Platform.OS === 'web' ? { fontSize: 32 } : {}) }]}>
        ¿Qué querés crear hoy?
      </Text>

      <View style={{ gap: spacing.md, ...(Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap' } : {}) }}>
        {/* Excepción al patrón Card: GlowPressable directo, porque las cards
            encienden el halo con hovered (web) / pressed (nativo) y Card no
            expone esos estados. El resto de la app sigue usando Card. */}
        <Stagger style={Platform.OS === 'web' ? { flexGrow: 1, flexShrink: 1, flexBasis: 300 } : undefined}>
        {OPTIONS.map((opt) => (
          <GlowPressable
            accessibilityRole="button"
            accessibilityLabel={opt.title}
            key={opt.key}
            onPress={() => handlePress(opt.key)}
            style={styles.row}
          >
            <LinearGradient
              colors={gradients.card}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.rowInner}
            >
              <View style={styles.emojiBox}>
                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
              </View>
              <Text style={[type.body, { ...font(800), fontSize: Platform.OS === 'web' ? 22 : 18 }]}>{opt.title}</Text>
              {Platform.OS === 'web' && <Text style={[type.body, { color: colors.textMuted, lineHeight: 26 }]}>{opt.description}</Text>}
            </LinearGradient>
          </GlowPressable>
        ))}
        </Stagger>
      </View>
      </View>
      </CreationArea>

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
    </SectionSwipe>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    // Sin overflow hidden: recortaría el halo del GlowPressable. El degradé
    // interno ya se redondea con su propio borderRadius.
    borderCurve: "continuous",
  },
  rowInner: {
    borderRadius: radius.lg,
    // Recorta el degradé contra las esquinas redondeadas. Va acá, en el degradé
    // interno, y NO en `row`: ahí se comería el halo del press.
    overflow: "hidden",
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md + 4,
    ...(Platform.OS === 'web' ? { minHeight: 300, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: 28, gap: 24 } : {}),
  },
  emojiBox: {
    width: 54,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
