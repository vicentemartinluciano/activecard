import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "../../../theme";

export default function Estudiar() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Estudiar" }} />
      <Text style={type.body}>Modo Quizlet</Text>
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
