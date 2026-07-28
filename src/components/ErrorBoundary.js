// Red de contención: si una pantalla revienta, sin esto React desmonta TODO el
// árbol y queda la pantalla en negro, sin explicación y sin salida. Acá al
// menos se dice qué pasó y se ofrece reintentar.
//
// Tiene que ser class component: no hay equivalente con hooks para
// componentDidCatch.

import { Component } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "./ui";
import { colors, font, radius, spacing, type } from "../theme";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.warn("Error no controlado en la interfaz:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Se rompió algo</Text>
        <Text style={type.small}>
          La pantalla no se pudo dibujar. Tus datos están a salvo: esto es un problema de la
          interfaz, no de la base.
        </Text>
        <ScrollView style={styles.detail} contentContainerStyle={{ padding: spacing.sm + 4 }}>
          <Text style={styles.mono}>{String(error?.message || error)}</Text>
        </ScrollView>
        <Button label="Reintentar" kind="primary" onPress={() => this.setState({ error: null })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: "center",
  },
  title: {
    ...type.title,
    fontSize: 24,
  },
  detail: {
    maxHeight: 160,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mono: {
    ...type.small,
    ...font(400),
    color: colors.danger,
    lineHeight: 18,
  },
});
