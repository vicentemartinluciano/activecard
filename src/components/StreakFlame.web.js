// Mismo recurso de Android, renderizado localmente como SVG en el navegador.
import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, font } from "../theme";
import animationData from "../../assets/lottie/streak-fire.json";

export default function StreakFlame({ days = null, active = false }) {
  const color = active ? colors.streak : colors.textMuted;
  const focused = useIsFocused();
  const container = useRef(null);
  useEffect(() => {
    let disposed = false;
    let animation;
    import('lottie-web/build/player/lottie_light').then(({ default: lottie }) => {
      if (disposed || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: 'svg', loop: true, autoplay: active && focused, animationData: JSON.parse(JSON.stringify(animationData)) });
      animation.addEventListener('DOMLoaded', () => {
        if (!active || !focused) animation.goToAndStop(45, true);
      });
    }).catch(() => console.warn('No se pudo cargar la animación de racha.'));
    return () => { disposed = true; animation?.destroy(); };
  }, [active, focused]);
  return (
    <View style={styles.row} accessible accessibilityLabel={days == null ? 'Racha de estudio' : `Racha de ${days} ${days === 1 ? 'día' : 'días'}`}>
      <div ref={container} aria-hidden="true" style={{ width: 34, height: 34, opacity: active ? 1 : 0.4, pointerEvents: 'none' }} />
      {days != null ? <Text style={[styles.days, { color }]}>{days}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  days: {
    fontSize: 17,
    ...font(700),
  },
});
