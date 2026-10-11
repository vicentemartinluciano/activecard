import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import GlowPressable from "../../components/GlowPressable";
import SectionSwipe from "../../components/SectionSwipe";
import Stagger from "../../components/Stagger";
import { InlineAdd, Screen } from "../../components/ui";
import { createDeck } from "../../db/decks";
import { createFolder } from "../../db/folders";
import { colors, gradients, HALO_PADDING, radius, spacing, type } from "../../theme";

// Los emojis se quedan: decisión de Martín (se propuso pasarlos a Feather y lo
// rechazó). Las tres opciones reaccionan IGUAL — ninguna es "la destacada".
const OPTIONS = [
  { key: "ia", emoji: "🤖", title: "Generar Mazo con IA", description: 'Convertí tus fuentes y apuntes en propuestas de tarjetas para revisar.' },
  { key: "mazo", emoji: "✏️", title: "Nuevo Mazo Manual", description: 'Armá un mazo y escribí sus tarjetas con el editor.' },
  { key: "carpeta", emoji: "📁", title: "Crear Nueva Carpeta", description: 'Agrupá tus mazos por materia, tema o proyecto.' },
];

function CreationArea({ children }) {
  return <ScrollView contentContainerStyle={{ flexGrow: 1, padding: HALO_PADDING, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

// Hub de creación: única puerta de entrada para mazos con IA, mazos manuales y carpetas.
export default function Crear() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 1000;
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
    <Screen safeTop style={{ padding: 0 }}>
      <CreationArea>
      <View style={{ flex: 1, justifyContent: Platform.OS === 'web' ? 'flex-start' : 'center', paddingTop: desktop ? spacing.lg : spacing.sm }}>
      <Text style={[type.title, { textAlign: Platform.OS === 'web' ? 'left' : 'center', marginBottom: spacing.lg }]}>
        ¿Qué querés crear hoy?
      </Text>

      <View style={{ gap: spacing.md, ...(Platform.OS === 'web' ? { flexDirection: 'row', flexWrap: 'wrap' } : {}) }}>
        {/* Excepción al patrón Card: GlowPressable directo, porque las cards
            encienden el halo con hovered (web) / pressed (nativo) y Card no
            expone esos estados. El resto de la app sigue usando Card. */}
        <Stagger style={desktop ? { flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 } : { width: '100%' }}>
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
              style={[styles.rowInner, desktop && styles.desktopRow]}
            >
              <View style={styles.emojiBox}>
                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
              </View>
              <View style={{ flex: desktop ? undefined : 1, minWidth: 0, gap: spacing.xs }}>
                <Text style={[type.heading, { fontSize: desktop ? 22 : 18, lineHeight: desktop ? 30 : 25 }]}>{opt.title}</Text>
                <Text style={type.small}>{opt.description}</Text>
              </View>
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
    paddingVertical: spacing.md,
  },
  desktopRow: {
    minHeight: 230,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
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
