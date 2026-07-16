// Marca TipTap "tcolor": el color de texto de ActiveCard ([[clave:texto]]).
// Guarda la CLAVE del color (rojo, azul, …) en data-color y pinta con el hex
// de theme.textColors — así richhtml.js puede volver a la clave sin adivinar.

import { Mark, mergeAttributes } from "@tiptap/core";

// Copia local de theme.textColors: este módulo también se bundlea para el
// WebView, donde no hay acceso al theme en runtime. Mantener sincronizado.
export const EDITOR_TEXT_COLORS = {
  rojo: "#E5484D",
  naranja: "#F76B15",
  amarillo: "#FFC53D",
  verde: "#46A758",
  azul: "#6E8BEB",
  violeta: "#9E6EDE",
};

export const TColor = Mark.create({
  name: "tcolor",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-color"),
        renderHTML: (attributes) => {
          if (!attributes.color || !EDITOR_TEXT_COLORS[attributes.color]) return {};
          return {
            "data-color": attributes.color,
            style: `color: ${EDITOR_TEXT_COLORS[attributes.color]}`,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setTColor:
        (color) =>
        ({ chain }) =>
          chain().setMark(this.name, { color }).run(),
      unsetTColor:
        () =>
        ({ chain }) =>
          chain().unsetMark(this.name).run(),
    };
  },
});

export default TColor;
