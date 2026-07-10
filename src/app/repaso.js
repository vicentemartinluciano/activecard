import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../theme";

export default function Repaso() {
  return (
    <View style={styles.container}>
      <Text style={type.body}>Repaso diario</Text>
      <Text style={type.small}>En construcción (Fase 3).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
});
