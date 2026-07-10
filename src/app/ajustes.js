import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../theme";

export default function Ajustes() {
  return (
    <View style={styles.container}>
      <Text style={type.body}>Ajustes</Text>
      <Text style={type.small}>En construcción (Fase 2).</Text>
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
