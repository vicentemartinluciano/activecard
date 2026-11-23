import React from "react";
import { act, create } from "react-test-renderer";
import MathFormulaWeb from "../MathFormula.web";
import RichText from "../RichText";

let mockSvgShouldThrow = false;

jest.mock("react-native", () => {
  const react = require("react");
  return {
    Platform: { OS: "android", select: (values) => values.android ?? values.default },
    StyleSheet: {
      create: (styles) => styles,
      flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {}),
    },
    View: ({ children, ...props }) => react.createElement("View", props, children),
    Text: ({ children, ...props }) => react.createElement("Text", props, children),
    ScrollView: ({ children, ...props }) => react.createElement("ScrollView", props, children),
    Pressable: ({ children, ...props }) => react.createElement("Pressable", props, children),
    Image: { getSize: jest.fn() },
    Modal: ({ children, ...props }) => react.createElement("Modal", props, children),
  };
});

jest.mock("react-native-svg", () => {
  const react = require("react");
  return {
    __esModule: true,
    get default() {
      if (mockSvgShouldThrow) throw new Error("Missing react-native-svg");
      return ({ children, ...props }) => react.createElement("Svg", props, children);
    },
    get Path() {
      if (mockSvgShouldThrow) throw new Error("Missing react-native-svg");
      return (props) => react.createElement("Path", props);
    },
  };
});

jest.mock("@expo/vector-icons/Feather", () => () => null);

describe("RichText y renderizadores matemáticos", () => {
  test("renderiza LaTeX inline, display multilínea y preserva precios en RichText nativo", () => {
    const sample = [
      "El índice $H_k$ cuesta $100 en promedio.",
      "$$",
      "\\sqrt{(1 + H_k)^{1/k}} = \\bar{h} \\implies \\cdots",
      "$$",
    ].join("\n");

    let tree;
    try {
      act(() => {
        tree = create(<RichText text={sample} />);
      });
      const json = JSON.stringify(tree.toJSON());

      expect(json).toContain('"$100"');
      expect(json).toContain('"promedio."');
      expect(json).toContain('"H_k"');
      expect(json).not.toContain("ac-math-block");
      expect(json).toContain("⟹");
      expect(json).toContain("⋯");
      expect(json).toContain("Svg");
    } finally {
      act(() => tree?.unmount());
    }
  });

  test("MathFormula nativo degrada limpiamente si react-native-svg no está disponible", () => {
    mockSvgShouldThrow = true;
    try {
      jest.isolateModules(() => {
        const IsoReact = require("react");
        const { act: isoAct, create: isoCreate } = require("react-test-renderer");
        const FallbackMathFormula = require("../MathFormula").default;
        let tree;
        try {
          isoAct(() => {
            tree = isoCreate(
              IsoReact.createElement(FallbackMathFormula, {
                latex: "\\sqrt{x + \\hat{a}} + \\left( \\frac{1}{2} \\right)",
              })
            );
          });
          const json = JSON.stringify(tree.toJSON());
          expect(json).toContain("√");
          expect(json).toContain("^");
          expect(json).not.toContain('"Svg"');
        } finally {
          isoAct(() => tree?.unmount());
        }
      });
    } finally {
      mockSvgShouldThrow = false;
    }
  });

  test("MathFormula.web genera salida MathML de KaTeX tanto inline como display", () => {
    let inlineTree;
    let blockTree;
    try {
      act(() => {
        inlineTree = create(<MathFormulaWeb latex="H_k = \\frac{1}{k}" />);
        blockTree = create(<MathFormulaWeb latex="(1+H_k)^{1/k}" display />);
      });

      const inlineNode = inlineTree.root.findByType("span");
      const blockNode = blockTree.root.findByType("div");
      expect(inlineNode.props.className).toBe("ac-math-inline");
      expect(inlineNode.props.dangerouslySetInnerHTML.__html).toContain("<math");
      expect(blockNode.props.className).toBe("ac-math-block");
      expect(blockNode.props.dangerouslySetInnerHTML.__html).toContain("<math");
    } finally {
      act(() => {
        inlineTree?.unmount();
        blockTree?.unmount();
      });
    }
  });
});
