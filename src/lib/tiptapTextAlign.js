// Extensión propia de alineación por bloque para TipTap (evita sumar la dep
// @tiptap/extension-text-align). Agrega un atributo `textAlign` al párrafo que
// se serializa como style="text-align: ..." — que es justo lo que lee/emite el
// puente marcas↔HTML (richhtml.js). Izquierda = default (no emite style).
// Mismo espíritu que tiptapTColor.js: extensión chica, controlada, sin dep nueva.

import { Extension } from "@tiptap/core";

export const ALIGNMENTS = ["left", "center", "right"];

export const TextAlign = Extension.create({
  name: "textAlign",

  addOptions() {
    return { types: ["paragraph"], defaultAlignment: "left" };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => {
              const a = element.style.textAlign || this.options.defaultAlignment;
              return ALIGNMENTS.includes(a) ? a : this.options.defaultAlignment;
            },
            renderHTML: (attributes) => {
              const a = attributes.textAlign;
              if (!a || a === this.options.defaultAlignment) return {};
              return { style: `text-align: ${a}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment) =>
        ({ commands }) => {
          if (!ALIGNMENTS.includes(alignment)) return false;
          return this.options.types
            .map((type) => commands.updateAttributes(type, { textAlign: alignment }))
            .every(Boolean);
        },
    };
  },
});
