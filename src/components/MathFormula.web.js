import katex from "katex";
import { useMemo } from "react";
import { StyleSheet } from "react-native";

import NativeMathFormula from "./MathFormula.js";
import { colors } from "../theme";

let cssInjected = false;
function ensureMathCss() {
  if (cssInjected || typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-ac-math", "true");
  style.textContent = `
.ac-math-inline {
  display: inline-flex;
  align-items: baseline;
  vertical-align: middle;
  margin: 0 1px;
}
.ac-math-block {
  display: flex;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  overflow-x: auto;
  margin: 10px 0;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(70, 104, 232, 0.06);
  border: 1px solid rgba(155, 180, 255, 0.14);
}
.ac-math-inline math,
.ac-math-block math {
  font-family: "Cambria Math", "STIX Two Math", "Latin Modern Math", "Times New Roman", serif;
  font-size: 1.08em;
  color: inherit;
}
`;
  document.head.appendChild(style);
  cssInjected = true;
}

export default function MathFormula({ latex, display = false, style }) {
  ensureMathCss();
  const flat = StyleSheet.flatten(style) || {};
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || "", {
        displayMode: display,
        output: "mathml",
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return "";
    }
  }, [latex, display]);

  if (!html) {
    return <NativeMathFormula latex={latex} display={display} style={style} />;
  }

  const inlineStyle = {
    color: flat.color || colors.text,
    ...(flat.fontSize ? { fontSize: flat.fontSize } : null),
  };

  if (display) {
    return (
      <div
        className="ac-math-block"
        style={inlineStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className="ac-math-inline"
      style={inlineStyle}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
