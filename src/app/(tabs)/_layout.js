import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { Platform, useWindowDimensions } from "react-native";

import { colors, font } from "../../theme";

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  return (
    <Tabs
      tabBar={Platform.OS === "web" && width >= 760 ? () => null : undefined}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { ...font(600) },
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, ...font(600) },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="crear" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="biblioteca"
        options={{
          title: "Biblioteca",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="book-open" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="gimnasio" options={{ title: "Gimnasio", headerShown: false, tabBarIcon: ({ color, size }) => <Feather name="zap" color={color} size={size} /> }} />
      <Tabs.Screen
        name="progreso"
        options={{
          title: "Progreso",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Feather name="trending-up" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
