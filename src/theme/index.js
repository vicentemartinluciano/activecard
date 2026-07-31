// Tokens de diseño de ActiveCard.
// Estética inspirada en Quizlet sobre fondo oscuro profundo: acento azul
// principal + paleta de apoyo flexible (racha, resaltados, colores de texto)
// para que la app no sea una plancha monocroma.

export const colors = {
  bg: "#09090B",
  surface: "#121216",
  surfaceHigh: "#1C1C22",
  surfaceCard: "#151518", // fondo de tarjetas/paneles destacados
  border: "#202027",
  track: "#1E1E24", // track de barras de progreso
  cardBorder: "#FFFFFF0A", // borde translúcido de las cards (Obsidian Cobalt)
  text: "#E9E9EF",
  textMuted: "#8B8B98",
  accent: "#3E63DD", // azul profundo (acento principal)
  accentSoft: "#1C2647", // fondo atenuado del acento
  accentText: "#8FA6F3", // azul claro para texto/íconos activos sobre oscuro
  danger: "#C05A5F",
  success: "#5F9E6E",
  successBright: "#4CC38A", // verde brillante estilo Quizlet (barras de progreso, completado)
  streak: "#F76B15", // naranja del fuego de racha
  streakSoft: "#3A2113",
  highlight: "#4A3A12", // fondo de resaltado rich text (ámbar oscuro)
  pillBg: "#FFFFFF14", // fondo semi-transparente de píldoras/tags
  pillBorder: "#FFFFFF1F", // borde sutil de píldoras
  cyanBorder: "rgba(0,242,254,0.35)", // borde cián de la card de cierre de sesión
};

// Paleta de colores de texto para el formato de tarjetas (rich text).
// Las claves son las que viaja el markup [[clave:texto]].
export const textColors = {
  rojo: "#E5484D",
  naranja: "#F76B15",
  amarillo: "#FFC53D",
  verde: "#46A758",
  azul: "#6E8BEB",
  violeta: "#9E6EDE",
};

// Colores por nota (FSRS). Un solo lugar: los usan la pill que aparece al
// deslizar, el borde con el que se enciende la tarjeta, los círculos ✕/~/✓ y
// las píldoras del resumen. Antes estaban duplicados e inconsistentes (el verde
// de la pill era `colors.success`, apagado, y el del botón un "#5BE7AD" suelto);
// con el borde de la tarjeta encima, la diferencia se notaba.
export const ratingColors = {
  good: "#5BE7AD", // "La sabía"
  hard: "#8FA6F3", // "Más o menos" (= colors.accentText)
  again: "#E5484D", // "No la sabía" (= textColors.rojo)
};

// Los mismos colores al 45% (sufijo alpha #RRGGBBAA), para los bordes
// atenuados de los círculos ✕/~/✓ de las pantallas de estudio.
export const ratingBorders = {
  good: `${ratingColors.good}73`,
  hard: `${ratingColors.hard}73`,
  again: `${ratingColors.again}73`,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
};

// Ancho máximo del contenido: en el teléfono no aplica (la pantalla es más
// angosta), pero en la web de escritorio evita que todo se estire a lo ancho
// del monitor — la app queda como una columna centrada tipo móvil.
export const layout = {
  maxWidth: 480,
};

// Semántica: lg = contenedores Card principales, md = filas/superficies internas,
// sm = botones/inputs, pill = píldoras y barras de progreso.
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
};

// Degradados del rediseño Obsidian Cobalt / Neón (expo-linear-gradient).
export const gradients = {
  progress: ["#30A46C", "#5BE7AD"], // barras de progreso (verde) — todas salvo la del hero
  bar: ["#2563EB", "#00F2FE"], // barra del hero de Inicio (cobalto → cián neón)
  hero: ["#0A1424", "#0C1A33", "#16295E"], // tablero "Repaso de hoy" y botones destacados — más oscuro
  card: ["#1B1B22", "#131317"], // degradé suave de fondo de cards
};

// Resplandores (boxShadow es cross-platform en RN >= 0.76 new-arch y en web).
//
// HALO ÚNICO: `halo` es cobalto, el MISMO tono que colors.accent. El cián de
// antes se leía como "otro color" contra el azul de la app (decisión de Martín).
// Se enciende SOLO al tocar/hover — nunca permanente: para eso está
// components/GlowPressable.js.
//
// Blur máximo 18px A PROPÓSITO: en Android el shadow se recorta contra los
// bordes del ScrollView/padre y un blur grande se ve "cortado de golpe". El
// halo tiene que desvanecerse ANTES de llegar al límite, y todo contenedor con
// scroll que aloje algo con halo necesita HALO_PADDING de aire.
export const glow = {
  halo: { boxShadow: "0 0 8px rgba(62,99,221,0.36), 0 0 18px rgba(62,99,221,0.18)" },
  haloViolet: { boxShadow: "0 0 8px rgba(158,110,222,0.34), 0 0 18px rgba(158,110,222,0.17)" },
  green: { boxShadow: "0 0 5px rgba(91,231,173,0.35), 0 0 10px rgba(48,164,108,0.2)" },
  // Único resplandor permanente que queda: la card de cierre de sesión, que es
  // parte del flujo de estudio y Martín pidió no tocar.
  cyan: { boxShadow: "0 0 10px rgba(0,242,254,0.18), 0 0 24px rgba(62,99,221,0.15)" },
};

// Aire mínimo alrededor de cualquier elemento con halo dentro de un scroll,
// para que el resplandor no se recorte contra el borde del contenedor.
export const HALO_PADDING = 18;

// Tipografía: Plus Jakarta Sans.
// En React Native `fontFamily` + `fontWeight` NO se combinan: si se usa una sola
// familia y se pide fontWeight 700, Android muestra la regular (o la sintetiza
// mal). Por eso se carga UN ARCHIVO POR PESO y se elige la familia a mano con
// font(). Regla: en toda la app va `...font(N)` en lugar de `fontWeight: "N"`.
// El peso 500 se mapea a SemiBold a propósito (no hay Medium cargado: un asset
// menos en el bundle y la diferencia no se nota a los tamaños que usamos).
export const fontFamilies = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_600SemiBold",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
};

export function font(weight = 400) {
  return { fontFamily: fontFamilies[weight] || fontFamilies[400] };
}

// Números que se actualizan en su lugar (contadores, porcentajes, fechas): sin
// esto las cifras tienen anchos distintos y las columnas "bailan" al refrescar.
export const tabular = { fontVariant: ["tabular-nums"] };

export const type = {
  title: { fontSize: 28, ...font(700), color: colors.text },
  subtitle: { fontSize: 15, ...font(400), color: colors.textMuted },
  body: { fontSize: 17, ...font(400), color: colors.text, lineHeight: 24 },
  small: { fontSize: 13, ...font(400), color: colors.textMuted },
  heading: { fontSize: 20, ...font(700), color: colors.text },
  label: {
    fontSize: 12,
    ...font(600),
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
};
