import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import ErrorBoundary from "../components/ErrorBoundary";
import { autoBackupIfDue } from "../lib/backupIO";
import { initKeys } from "../lib/keys";
import { colors, font } from "../theme";

export default function RootLayout() {
  // Un archivo por peso (ver fontFamilies en theme). Esperamos la carga para
  // evitar el salto del primer frame, salvo que falle: ahí la app continúa con
  // la fuente del sistema.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    initKeys().catch((e) => console.warn("No se pudieron leer las claves guardadas:", e));
    // El respaldo recorre toda la base. Lo arrancamos recién cuando terminó la
    // navegación inicial para que nunca compita con el primer render.
    const backupTask = InteractionManager.runAfterInteractions(() => {
      autoBackupIfDue().catch((e) => console.warn("No se pudo hacer el respaldo automático:", e));
    });
    return () => backupTask.cancel();
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn("Plus Jakarta Sans no pudo cargarse; se usará la fuente del sistema:", fontError);
    }
  }, [fontError]);

  // Un fallo de fuente no puede dejar la app en una pantalla negra. React
  // Native reemplaza la familia ausente por la del sistema al renderizar.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ErrorBoundary>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { ...font(600) },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
