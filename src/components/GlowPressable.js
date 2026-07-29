// Superficie pressable que enciende el halo SOLO mientras se interactúa:
// `pressed` en el teléfono, `hovered` en la web. Nunca permanente — decisión de
// Martín: cuando todo brilla, nada destaca.
//
// Ojo con el patrón: acá el `style` como función va en un Pressable COMÚN, que
// sí lo soporta. Lo prohibido en esta app es
// `Animated.createAnimatedComponent(Pressable)` con style-función, que pierde
// los fondos en Android new-arch (ver Button en ui.js).
//
// Si el elemento vive dentro de un ScrollView, el contenedor necesita
// HALO_PADDING de aire o Android recorta el resplandor contra su borde.

import { Pressable } from "react-native";

import { glow } from "../theme";

// `active`: enciende el halo desde afuera. Sirve cuando lo que se toca está
// ADENTRO (el botón del hero se come el press, así que el contenedor nunca se
// entera) y la tarjeta entera igual tiene que iluminarse.
export default function GlowPressable({
  onPress,
  onLongPress,
  style,
  halo = glow.halo,
  disabled,
  active = false,
  children,
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed, hovered }) => [
        style,
        (pressed || hovered || active) && !disabled && halo,
      ]}
    >
      {children}
    </Pressable>
  );
}
