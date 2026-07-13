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

// Semántica: lg = contenedores Card principales, md = filas/superficies internas,
// sm = botones/inputs, pill = píldoras y barras de progreso.
export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
};

// Degradados del rediseño Obsidian Cobalt (expo-linear-gradient).
export const gradients = {
  progress: ["#30A46C", "#5BE7AD"], // barras de progreso (verde esmeralda → verde claro)
  bar: ["#2563EB", "#00F2FE"], // card "shiny" de fin de sesión (ex barras de mazos)
  hero: ["#0F1E36", "#112443", "#1E3A8A"], // tablero "Repaso de hoy"
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
