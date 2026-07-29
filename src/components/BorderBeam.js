// Segmento de luz que recorre el CONTORNO de una tarjeta, con cola de cometa.
//
// Cómo se dibuja (y por qué así): el intento anterior giraba un degradé POR
// DETRÁS del contenido y dejaba asomar una franja. Eso da un barrido difuso sin
// forma —no se lee como un segmento— y además el contenedor que lo alojaba
// dejaba ver el fondo de la pantalla por los costados: el "borde negro".
// Acá el segmento se dibuja EXPLÍCITAMENTE sobre cada lado del borde, encima
// del contenido y sin envolverlo, así que no agrega ningún marco.
//
// El recorrido son 4 tramos (arriba → derecha → abajo → izquierda). Un
// Animated.Value avanza de 0 a 4 por tarjeta; cada lado se enciende solo
// durante su tramo y el segmento se desplaza a lo largo de ese lado.
//
// Las posiciones van en PORCENTAJE, no en píxeles: así no hay que medir la
// tarjeta con onLayout (medir resultó frágil — cuando la medida no llega, no se
// dibuja nada). El costo es animar por JS en vez de native driver, que para una
// animación de decoración es irrelevante.
//
// Con `total` > 1 varias tarjetas COMPARTEN una sola luz: la tarjeta 0 la tiene
// mientras el valor va de 0 a 4, la 1 de 4 a 8, y así. Se ve como una única luz
// que da la vuelta a una tarjeta, salta a la siguiente y sigue.

import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

const VUELTA = 5200; // ms que tarda la luz en dar una vuelta a UNA tarjeta
const LARGO = 62; // largo del segmento, en % del lado que recorre
const GROSOR = 2;

// La serpiente usa una sola familia cobalto. La punta es el mismo azul llevado
// a más luminosidad: no cambia de tono hacia cián al recorrer la tarjeta.
const COLA = "transparent";
const CUERPO = "rgba(62,99,221,0.70)";
const PUNTA = "rgba(146,175,255,0.95)";

// El Animated.Value compartido. `total` = cuántas tarjetas se pasan la luz.
// OJO: acá NO se consulta AccessibilityInfo.isReduceMotionEnabled(). En el
// teléfono de Martín la escala de animaciones del sistema está baja y esa
// consulta devuelve true, así que el efecto se apagaba solo y nunca se veía.
// Es una app personal y la luz se pidió explícitamente: corre siempre.
export function useBeam(total = 1, { duration = VUELTA, disabled = false } = {}) {
  const progress = useRef(new Animated.Value(0)).current;
  const off = disabled;

  useEffect(() => {
    if (off) {
      progress.setValue(-1); // fuera de todo rango: ningún lado se enciende
      return undefined;
    }
    progress.setValue(0);
    // El +salida deja que la cola del último tramo termine de salir antes de
    // reiniciar; si no, la luz se corta al cerrar la vuelta.
    const salida = LARGO / 100;
    const vueltaCompleta = total * 4 + salida;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: vueltaCompleta,
        duration: (duration / 4) * vueltaCompleta,
        easing: Easing.linear,
        // Las posiciones son porcentajes (left/top), que el native driver no
        // sabe animar. Es una animación de decoración: no vale la pena.
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [off, total, duration, progress]);

  return off ? null : progress;
}

// Un lado del recorrido. `k` es el tramo (0 arriba, 1 derecha, 2 abajo, 3 izq).
//
// LA CLAVE DE LA CONTINUIDAD: el tramo no se apaga cuando la PUNTA llega al
// final del lado, sino cuando la COLA termina de salir. Eso hace que dos lados
// estén encendidos a la vez mientras la luz dobla la esquina — antes cada lado
// se apagaba entero antes de que se encendiera el siguiente y la luz SALTABA en
// vez de doblar. El mismo solapamiento encadena una tarjeta con la siguiente en
// Crear: la cola todavía sale de una cuando la punta ya entró en la otra.
function Tramo({ progress, base, k, thickness, largo }) {
  const salida = largo / 100; // lo que tarda la cola en terminar de salir
  const desde = base + k;
  const hasta = desde + 1 + salida;

  const opacity = progress.interpolate({
    inputRange: [desde - 0.001, desde, hasta, hasta + 0.001],
    outputRange: [0, 1, 1, 0],
    extrapolate: "clamp",
  });

  // La punta entra en `desde` y la cola termina de salir en `hasta`, a
  // velocidad constante. El overflow del padre recorta lo que sobra.
  const corre = (from, to) =>
    progress.interpolate({ inputRange: [desde, hasta], outputRange: [from, to], extrapolate: "clamp" });

  const horizontal = k === 0 || k === 2;
  const tamano = horizontal
    ? { width: `${largo}%`, height: thickness }
    : { width: thickness, height: `${largo}%` };

  // Punta cobalto clara adelante, cuerpo cobalto y cola desvaneciéndose.
  const haciaAdelante = [COLA, CUERPO, PUNTA];
  const haciaAtras = [PUNTA, CUERPO, COLA];
  const gradiente =
    k === 0
      ? { colors: haciaAdelante, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } }
      : k === 1
        ? { colors: haciaAdelante, start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } }
        : k === 2
          ? { colors: haciaAtras, start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } }
          : { colors: haciaAtras, start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } };

  const posicion =
    k === 0
      ? { top: 0, left: corre(`-${largo}%`, "100%") }
      : k === 1
        ? { right: 0, top: corre(`-${largo}%`, "100%") }
        : k === 2
          ? { bottom: 0, left: corre("100%", `-${largo}%`) }
          : { left: 0, top: corre("100%", `-${largo}%`) };

  return (
    <Animated.View pointerEvents="none" style={[styles.tramo, tamano, posicion, { opacity }]}>
      <LinearGradient
        colors={gradiente.colors}
        start={gradiente.start}
        end={gradiente.end}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

// Va como hijo absoluto de la tarjeta. El padre necesita `overflow: hidden`
// para que el segmento se recorte prolijo contra las esquinas.
export default function BorderBeam({
  progress,
  index = 0,
  thickness = GROSOR,
  largo = LARGO,
  radius = 0,
}) {
  if (!progress) return null;
  const base = index * 4;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      {[0, 1, 2, 3].map((k) => (
        <Tramo key={k} progress={progress} base={base} k={k} thickness={thickness} largo={largo} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tramo: {
    position: "absolute",
  },
});
