// Tokens de diseño de ActiveCard.
// Estética inspirada en Quizlet sobre fondo oscuro profundo: acento azul
// principal + paleta de apoyo flexible (racha, resaltados, colores de texto)
// para que la app no sea una plancha monocroma.

export const colors = {
  bg: "#0B0B0F",
  surface: "#15151C",
  surfaceHigh: "#1E1E27",
  surfaceCard: "#181820", // fondo de tarjetas/paneles destacados
  border: "#26262F",
  text: "#E9E9EF",
  textMuted: "#8B8B98",
  accent: "#3E63DD", // azul profundo (acento principal)
  accentSoft: "#1C2647", // fondo atenuado del acento
  accentText: "#8FA6F3", // azul claro para texto/íconos activos sobre oscuro
  danger: "#C05A5F",
  success: "#5F9E6E",
  streak: "#F76B15", // naranja del fuego de racha
  streakSoft: "#3A2113",
  highlight: "#4A3A12", // fondo de resaltado rich text (ámbar oscuro)
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

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
};

export const type = {
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },
  body: { fontSize: 17, color: colors.text, lineHeight: 24 },
  small: { fontSize: 13, color: colors.textMuted },
};
