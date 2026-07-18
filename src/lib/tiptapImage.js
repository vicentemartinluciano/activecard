// Nodo de imagen propio para TipTap (evita la dep @tiptap/extension-image).
// Bloque atómico que se serializa como <img src="data:..."> — justo lo que
// lee/emite el puente marcas↔HTML (richhtml.js). Mismo espíritu que
// tiptapTColor.js / tiptapTextAlign.js: extensión chica, sin dep nueva.

import { Node } from "@tiptap/core";

export const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { src: { default: null } };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", HTMLAttributes];
  },

  addCommands() {
    return {
      setImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
