import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import ActionSheet from "../../components/ActionSheet";
import { Card, InlineAdd, Pill, Screen } from "../../components/ui";
import { createDeck } from "../../db/decks";
import { createFolder } from "../../db/folders";
import { colors, radius, spacing, type } from "../../theme";

const OPTIONS = [
  {
    key: "ia",
    icon: "cpu",
    title: "Generar Mazo con IA",
    desc: "Generá fichas de estudio a partir de tus archivos, textos o Notion.",
    highlight: true,
  },
  {
    key: "mazo",
    icon: "edit-3",
    title: "Nuevo Mazo Manual",
    desc: "Escribí tus tarjetas directo con el editor de marcas.",
  },
  {
    key: "carpeta",
    icon: "folder-plus",
    title: "Crear Nueva Carpeta",
    desc: "Organizá tus materias en carpetas.",
  },
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
        {OPTIONS.map((opt) => (
          <Card
            key={opt.key}
            onPress={() => handlePress(opt.key)}
            style={[styles.row, opt.highlight && styles.rowHighlight]}
          >
            <View style={styles.iconBox}>
              <Feather name={opt.icon} size={20} color={colors.accentText} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.titleRow}>
                <Text style={[type.body, { fontWeight: "700" }]}>{opt.title}</Text>
                {opt.highlight ? <Pill label="IA" color={colors.accentText} /> : null}
              </View>
              <Text style={type.small}>{opt.desc}</Text>
            </View>
          </Card>
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowHighlight: {
    borderColor: colors.accent,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
