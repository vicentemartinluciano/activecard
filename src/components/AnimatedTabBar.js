// Barra inferior personalizada con indicador deslizante y rebote táctil.
// Usa Animated.View externo + Pressable interno (patrón seguro en Android Fabric).

import Feather from "@expo/vector-icons/Feather";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, font, radius } from "../theme";

const NATIVE_DRIVER = Platform.OS !== "web";

const TAB_ICONS = {
  index: "home",
  biblioteca: "book-open",
  notas: "file-text",
  gimnasio: "zap",
  progreso: "trending-up",
};

function TabItem({ route, label, active, onPress, onLongPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconName = TAB_ICONS[route.name] || "circle";

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      speed: 48,
      bounciness: 0,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 36,
      bounciness: 6,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  };

  return (
    <Animated.View style={[styles.tabSlot, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ hovered }) => [styles.tabPress, hovered && !active && styles.tabHover]}
      >
        <View style={styles.iconWrap}>
          <Feather name={iconName} size={20} color={active ? colors.accentText : colors.textMuted} />
        </View>
        <Text
          numberOfLines={1}
          style={[styles.label, active ? styles.labelActive : styles.labelInactive]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export default function AnimatedTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const visibleRoutes = state.routes.filter((route) => {
    const opts = descriptors[route.key]?.options || {};
    return opts.href !== null && opts.tabBarButton !== null && route.name !== "crear";
  });

  const activeRouteKey = state.routes[state.index]?.key;
  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => route.key === activeRouteKey)
  );
  const slotWidth = visibleRoutes.length > 0 ? barWidth / visibleRoutes.length : 0;

  const indicatorX = useRef(new Animated.Value(0)).current;
  const hasMeasured = useRef(false);

  useEffect(() => {
    if (!slotWidth) return;
    const targetX = activeVisibleIndex * slotWidth;
    if (!hasMeasured.current) {
      hasMeasured.current = true;
      indicatorX.setValue(targetX);
      return;
    }
    Animated.spring(indicatorX, {
      toValue: targetX,
      speed: 26,
      bounciness: 4,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [activeVisibleIndex, slotWidth, indicatorX]);

  return (
    <View
      style={[
        styles.outer,
        { paddingBottom: Math.max(insets.bottom, Platform.OS === "web" ? 8 : 6) },
      ]}
    >
      <View
        style={styles.inner}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next > 0 && next !== barWidth) setBarWidth(next);
        }}
      >
        {slotWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicatorWrap,
              {
                width: slotWidth,
                transform: [{ translateX: indicatorX }],
              },
            ]}
          >
            <View style={styles.activeTopLine} />
            <View style={styles.activeCapsule} />
          </Animated.View>
        ) : null}

        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel ?? options.title ?? route.name;
          const active = route.key === activeRouteKey;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!active && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };
          return (
            <TabItem
              key={route.key}
              route={route}
              label={label}
              active={active}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  inner: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
  },
  activeIndicatorWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTopLine: {
    position: "absolute",
    top: -6,
    width: 24,
    height: 2.5,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  activeCapsule: {
    width: "84%",
    maxWidth: 68,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(70,104,232,0.14)",
    borderWidth: 1,
    borderColor: "rgba(155,180,255,0.18)",
  },
  tabSlot: {
    flex: 1,
    minWidth: 0,
  },
  tabPress: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 14,
    paddingHorizontal: 2,
  },
  tabHover: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  iconWrap: {
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  labelActive: {
    ...font(600),
    color: colors.accentText,
  },
  labelInactive: {
    ...font(400),
    color: colors.textMuted,
  },
});
