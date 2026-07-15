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
  neonBorder: "rgba(77,124,255,0.65)", // borde azul eléctrico de elementos con glow
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
  hero: ["#0F1E36", "#112443", "#1E3A8A"], // tablero "Repaso de hoy" y botones destacados
  card: ["#1B1B22", "#131317"], // degradé suave de fondo de cards
};

// Resplandores neón (boxShadow es cross-platform en RN >= 0.76 new-arch y en web).
// Radios chicos a propósito: en Android el shadow se recorta contra los bordes
// del ScrollView/padre y un blur grande se ve "cortado de golpe" — el halo
// tiene que desvanecerse ANTES de llegar al límite (márgenes ≥ blur máximo).
export const glow = {
  accent: { boxShadow: "0 0 10px rgba(77,124,255,0.38), 0 0 22px rgba(62,99,221,0.18)" },
  accentSoft: { boxShadow: "0 0 8px rgba(77,124,255,0.10)" },
  cyan: { boxShadow: "0 0 10px rgba(0,242,254,0.18), 0 0 24px rgba(62,99,221,0.15)" },
  green: { boxShadow: "0 0 5px rgba(91,231,173,0.35), 0 0 10px rgba(48,164,108,0.2)" },
  violet: { boxShadow: "0 0 10px rgba(158,110,222,0.15)" },
};

export const type = {
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  body: { fontSize: 17, color: colors.text, lineHeight: 24 },
  small: { fontSize: 13, color: colors.textMuted },
  heading: { fontSize: 20, fontWeight: "700", color: colors.text },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
};
