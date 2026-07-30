import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { useFonts } from "@expo-google-fonts/plus-jakarta-sans/useFonts";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { InteractionManager } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import ErrorBoundary from "../components/ErrorBoundary";
import { autoBackupIfDue } from "../lib/backupIO";
import { initKeys } from "../lib/keys";
import {
  configureNotificationHandler,
  subscribeToReminderPress,
  syncReviewReminder,
} from "../lib/notifications";
import { colors, font } from "../theme";

export default function RootLayout() {
  const router = useRouter();
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
    configureNotificationHandler().catch((e) =>
      console.warn("No se pudo configurar el recordatorio:", e)
    );
    // El respaldo recorre toda la base. Lo arrancamos recién cuando terminó la
    // navegación inicial para que nunca compita con el primer render.
    const backupTask = InteractionManager.runAfterInteractions(() => {
      autoBackupIfDue().catch((e) => console.warn("No se pudo hacer el respaldo automático:", e));
      syncReviewReminder().catch((e) =>
        console.warn("No se pudo programar el recordatorio:", e)
      );
    });
    return () => backupTask.cancel();
  }, []);

  useEffect(() => {
    let unsubscribe = null;
    subscribeToReminderPress((route) => router.push(route))
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch((e) => console.warn("No se pudo escuchar el recordatorio:", e));
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [router]);

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
