import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import BorderBeam, { useBeam } from "../../components/BorderBeam";
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
  { key: "ia", emoji: "🤖", title: "Generar Mazo con IA" },
  { key: "mazo", emoji: "✏️", title: "Nuevo Mazo Manual" },
  { key: "carpeta", emoji: "📁", title: "Crear Nueva Carpeta" },
];

// Hub de creación: única puerta de entrada para mazos con IA, mazos manuales y carpetas.
export default function Crear() {
  const router = useRouter();
  const focused = useIsFocused();
  const [createStep, setCreateStep] = useState(null); // null | "mazo" | "carpeta"
  // Una sola luz recorre el borde de las tres, una tras otra, en loop.
  const beam = useBeam(OPTIONS.length, { disabled: !focused });

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
    <Screen safeTop>
      <View style={{ flex: 1, justifyContent: "center" }}>
      <Text style={[type.title, { textAlign: "center", marginBottom: spacing.lg }]}>
        ¿Qué querés crear hoy?
      </Text>

      <View style={{ gap: spacing.md }}>
        {/* Excepción al patrón Card: GlowPressable directo, porque las cards
            encienden el halo con hovered (web) / pressed (nativo) y Card no
            expone esos estados. El resto de la app sigue usando Card. */}
        <Stagger>
        {OPTIONS.map((opt, i) => (
          <GlowPressable
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
              {/* UNA sola luz para las tres: da la vuelta al borde de esta
                  tarjeta durante su turno y después salta a la siguiente. */}
              <BorderBeam progress={beam} index={i} radius={radius.lg} />
              <View style={styles.emojiBox}>
                <Text style={{ fontSize: 26 }}>{opt.emoji}</Text>
              </View>
              <Text style={[type.body, { ...font(800), fontSize: 18 }]}>{opt.title}</Text>
            </LinearGradient>
          </GlowPressable>
        ))}
        </Stagger>
      </View>
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
    // Recorta la luz del borde contra las esquinas redondeadas. Va acá, en el
    // degradé interno, y NO en `row`: ahí se comería el halo del press.
    overflow: "hidden",
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md + 4,
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
