// Tokens de diseño de ActiveCard.
// Ultra minimalista: fondo oscuro profundo, un solo color de acento, cero ruido.

export const colors = {
  bg: "#0B0B0F",
  surface: "#15151C",
  surfaceHigh: "#1E1E27",
  border: "#26262F",
  text: "#E9E9EF",
  textMuted: "#8B8B98",
  accent: "#C9A227",
  accentSoft: "#3A3320",
  danger: "#C05A5F",
  success: "#5F9E6E",
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
