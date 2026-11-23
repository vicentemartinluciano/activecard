import { useContext, useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { parseLatex } from "../lib/mathLatex";
import { colors, font } from "../theme";
import { StudyInteractionContext } from "./StudyInteractionContext";

let Svg = null;
let Path = null;
try {
  const mod = require("react-native-svg");
  Svg = mod?.default || mod?.Svg || null;
  Path = mod?.Path || null;
} catch {
  Svg = null;
  Path = null;
}

const MATH_ITALIC_FONT = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: "serif",
});

function nodeContainsBigElement(node) {
  if (!node) return false;
  if (["frac", "binom", "matrix"].includes(node.type)) return true;
  if (node.type === "group") return node.items.some(nodeContainsBigElement);
  if (node.type === "delim" || node.type === "styled" || node.type === "sqrt") {
    return nodeContainsBigElement(node.body);
  }
  if (node.type === "script") {
    return nodeContainsBigElement(node.base) || nodeContainsBigElement(node.sub) || nodeContainsBigElement(node.sup);
  }
  return false;
}

function DelimiterGlyph({ char, tall, size, color }) {
  if (!char) return null;
  if (!tall) {
    return (
      <Text style={{ fontSize: size, lineHeight: size * 1.25, color }}>
        {char}
      </Text>
    );
  }
  const height = Math.max(size * 1.75, 28);
  const width = Math.max(8, Math.round(size * 0.48));
  if (char === "|") {
    return <View style={{ width: 1.5, height: height * 0.88, backgroundColor: color, marginHorizontal: 2 }} />;
  }
  if (!Svg || !Path) {
    return (
      <Text style={{ fontSize: size * 1.25, lineHeight: size * 1.45, color }}>
        {char}
      </Text>
    );
  }
  if (char === "[") {
    return (
      <Svg width={width} height={height} viewBox="0 0 12 40" style={styles.svgDelim}>
        <Path d="M10 2 H4 V38 H10" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="square" />
      </Svg>
    );
  }
  if (char === "]") {
    return (
      <Svg width={width} height={height} viewBox="0 0 12 40" style={styles.svgDelim}>
        <Path d="M2 2 H8 V38 H2" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="square" />
      </Svg>
    );
  }
  if (char === "{") {
    return (
      <Svg width={width + 2} height={height} viewBox="0 0 14 44" style={styles.svgDelim}>
        <Path
          d="M11 2 C7 2 6 5 6 9 V17 C6 20 4 22 2 22 C4 22 6 24 6 27 V35 C6 39 7 42 11 42"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (char === "}") {
    return (
      <Svg width={width + 2} height={height} viewBox="0 0 14 44" style={styles.svgDelim}>
        <Path
          d="M3 2 C7 2 8 5 8 9 V17 C8 20 10 22 12 22 C10 22 8 24 8 27 V35 C8 39 7 42 3 42"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (char === "(") {
    return (
      <Svg width={width} height={height} viewBox="0 0 12 44" style={styles.svgDelim}>
        <Path
          d="M10 2 C4 10 4 34 10 42"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (char === ")") {
    return (
      <Svg width={width} height={height} viewBox="0 0 12 44" style={styles.svgDelim}>
        <Path
          d="M2 2 C8 10 8 34 2 42"
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Text style={{ fontSize: size * 1.25, lineHeight: size * 1.45, color }}>
      {char}
    </Text>
  );
}

function AccentMark({ accent, size, color }) {
  if (accent === "bar" || accent === "overline") {
    return <View style={[styles.overbar, { backgroundColor: color }]} />;
  }
  if (accent === "hat" || accent === "widehat") {
    if (!Svg || !Path) {
      return (
        <Text style={{ fontSize: Math.max(9, size * 0.65), lineHeight: Math.max(9, size * 0.65), color, textAlign: "center" }}>
          ^
        </Text>
      );
    }
    return (
      <Svg width={Math.max(10, size * 0.72)} height={5} viewBox="0 0 16 6" style={styles.accentSvg}>
        <Path d="M1 5 L8 1 L15 5" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    );
  }
  if (accent === "tilde" || accent === "widetilde") {
    if (!Svg || !Path) {
      return (
        <Text style={{ fontSize: Math.max(9, size * 0.65), lineHeight: Math.max(9, size * 0.65), color, textAlign: "center" }}>
          ~
        </Text>
      );
    }
    return (
      <Svg width={Math.max(11, size * 0.75)} height={5} viewBox="0 0 18 6" style={styles.accentSvg}>
        <Path d="M1 4 Q5 0 9 3 T17 2" fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
    );
  }
  if (accent === "vec") {
    if (!Svg || !Path) {
      return (
        <Text style={{ fontSize: Math.max(9, size * 0.65), lineHeight: Math.max(9, size * 0.65), color, textAlign: "center" }}>
          →
        </Text>
      );
    }
    return (
      <Svg width={Math.max(12, size * 0.8)} height={6} viewBox="0 0 18 7" style={styles.accentSvg}>
        <Path d="M1 3.5 H16 M12.5 1 L16 3.5 L12.5 6" fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (accent === "dot" || accent === "ddot") {
    return (
      <Text style={{ fontSize: Math.max(8, size * 0.55), lineHeight: Math.max(7, size * 0.45), color, textAlign: "center" }}>
        {accent === "ddot" ? "··" : "·"}
      </Text>
    );
  }
  return null;
}

function MathNode({ node, size, color, display, boldOverride }) {
  if (!node) return null;

  switch (node.type) {
    case "group": {
      if (!node.items.length) return null;
      return (
        <View style={styles.row}>
          {node.items.map((child, idx) => (
            <MathNode
              key={idx}
              node={child}
              size={size}
              color={color}
              display={display}
              boldOverride={boldOverride}
            />
          ))}
        </View>
      );
    }

    case "space": {
      if (!node.em) return null;
      return <View style={{ width: Math.max(1, node.em * size) }} />;
    }

    case "text": {
      return (
        <Text
          style={[
            {
              fontSize: size,
              lineHeight: size * 1.25,
              color,
            },
            boldOverride ? font(700) : font(400),
          ]}
        >
          {node.value}
        </Text>
      );
    }

    case "styled": {
      return (
        <MathNode
          node={node.body}
          size={size}
          color={color}
          display={display}
          boldOverride={node.style === "bold" ? true : boldOverride}
        />
      );
    }

    case "symbol": {
      const italic = node.italic && !boldOverride;
      return (
        <Text
          style={[
            {
              fontSize: size,
              lineHeight: size * 1.25,
              color,
              marginHorizontal: node.operator ? 2.5 : 0,
            },
            boldOverride ? font(700) : null,
            italic ? { fontFamily: MATH_ITALIC_FONT, fontStyle: "italic" } : null,
          ]}
        >
          {node.value}
        </Text>
      );
    }

    case "bigop": {
      const wordOp = node.symbol.length > 1;
      return (
        <Text
          style={{
            fontSize: wordOp ? size : display ? size * 1.4 : size * 1.15,
            lineHeight: (wordOp ? size : display ? size * 1.4 : size * 1.15) * 1.15,
            color,
            marginHorizontal: 2,
          }}
        >
          {node.symbol}
        </Text>
      );
    }

    case "frac":
    case "binom": {
      const childSize = Math.max(10, Math.round(size * (display ? 0.9 : 0.78)));
      const inner = (
        <View style={styles.fracCol}>
          <View style={styles.fracNum}>
            <MathNode node={node.num} size={childSize} color={color} display={false} boldOverride={boldOverride} />
          </View>
          {node.type === "frac" ? (
            <View style={[styles.fracBar, { backgroundColor: color }]} />
          ) : (
            <View style={{ height: 3 }} />
          )}
          <View style={styles.fracDen}>
            <MathNode node={node.den} size={childSize} color={color} display={false} boldOverride={boldOverride} />
          </View>
        </View>
      );
      if (node.type === "binom") {
        return (
          <View style={styles.row}>
            <DelimiterGlyph char="(" tall size={size} color={color} />
            {inner}
            <DelimiterGlyph char=")" tall size={size} color={color} />
          </View>
        );
      }
      return inner;
    }

    case "script": {
      const scriptSize = Math.max(9.5, Math.round(size * 0.72));
      const isBigWordOrOp = node.base?.type === "bigop";
      if (isBigWordOrOp && display) {
        return (
          <View style={styles.bigOpCol}>
            {node.sup ? (
              <View style={styles.bigOpLimit}>
                <MathNode node={node.sup} size={scriptSize} color={color} display={false} boldOverride={boldOverride} />
              </View>
            ) : null}
            <MathNode node={node.base} size={size} color={color} display={display} boldOverride={boldOverride} />
            {node.sub ? (
              <View style={styles.bigOpLimit}>
                <MathNode node={node.sub} size={scriptSize} color={color} display={false} boldOverride={boldOverride} />
              </View>
            ) : null}
          </View>
        );
      }
      return (
        <View style={styles.scriptWrap}>
          <MathNode node={node.base} size={size} color={color} display={display} boldOverride={boldOverride} />
          <View style={styles.scriptStack}>
            {node.sup ? (
              <View style={{ marginBottom: node.sub ? 1 : Math.round(size * 0.34) }}>
                <MathNode node={node.sup} size={scriptSize} color={color} display={false} boldOverride={boldOverride} />
              </View>
            ) : null}
            {node.sub ? (
              <View style={{ marginTop: node.sup ? 1 : Math.round(size * 0.34) }}>
                <MathNode node={node.sub} size={scriptSize} color={color} display={false} boldOverride={boldOverride} />
              </View>
            ) : null}
          </View>
        </View>
      );
    }

    case "accent": {
      if (node.accent === "underline") {
        return (
          <View style={styles.accentWrap}>
            <MathNode node={node.body} size={size} color={color} display={display} boldOverride={boldOverride} />
            <View style={[styles.overbar, { backgroundColor: color }]} />
          </View>
        );
      }
      return (
        <View style={styles.accentWrap}>
          <AccentMark accent={node.accent} size={size} color={color} />
          <MathNode node={node.body} size={size} color={color} display={display} boldOverride={boldOverride} />
        </View>
      );
    }

    case "sqrt": {
      const idxSize = Math.max(9, Math.round(size * 0.65));
      const radHeight = Math.max(18, Math.round(size * 1.25));
      return (
        <View style={styles.sqrtWrap}>
          {node.index ? (
            <View style={styles.sqrtIndex}>
              <MathNode node={node.index} size={idxSize} color={color} display={false} boldOverride={boldOverride} />
            </View>
          ) : null}
          {Svg && Path ? (
            <Svg width={10} height={radHeight} viewBox="0 0 12 24" style={{ marginRight: -1 }}>
              <Path
                d="M1 14 L3.5 12 L6.5 22 L11 2"
                fill="none"
                stroke={color}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          ) : (
            <Text style={{ fontSize: size * 1.15, lineHeight: size * 1.25, color, marginRight: -1 }}>
              √
            </Text>
          )}
          <View style={[styles.sqrtBody, { borderTopColor: color }]}>
            <MathNode node={node.body} size={size} color={color} display={display} boldOverride={boldOverride} />
          </View>
        </View>
      );
    }

    case "delim": {
      const tall = nodeContainsBigElement(node.body);
      return (
        <View style={styles.row}>
          <DelimiterGlyph char={node.left} tall={tall} size={size} color={color} />
          <MathNode node={node.body} size={size} color={color} display={display} boldOverride={boldOverride} />
          <DelimiterGlyph char={node.right} tall={tall} size={size} color={color} />
        </View>
      );
    }

    case "matrix": {
      const delims = {
        cases: ["{", ""],
        pmatrix: ["(", ")"],
        bmatrix: ["[", "]"],
        vmatrix: ["|", "|"],
        Bmatrix: ["{", "}"],
      }[node.env] || ["", ""];
      const cellSize = Math.max(11, Math.round(size * (node.env === "cases" ? 0.92 : 0.88)));
      return (
        <View style={styles.row}>
          {delims[0] ? <DelimiterGlyph char={delims[0]} tall size={size} color={color} /> : null}
          <View style={styles.matrixGrid}>
            {node.rows.map((row, rIdx) => (
              <View key={rIdx} style={styles.matrixRow}>
                {row.map((cell, cIdx) => (
                  <View key={cIdx} style={styles.matrixCell}>
                    <MathNode node={cell} size={cellSize} color={color} display={false} boldOverride={boldOverride} />
                  </View>
                ))}
              </View>
            ))}
          </View>
          {delims[1] ? <DelimiterGlyph char={delims[1]} tall size={size} color={color} /> : null}
        </View>
      );
    }

    default:
      return null;
  }
}

export default function MathFormula({ latex, display = false, style }) {
  const interactionRef = useContext(StudyInteractionContext);
  const flat = StyleSheet.flatten(style) || {};
  const size = flat.fontSize || 16;
  const color = flat.color || colors.text;
  const ast = useMemo(() => parseLatex(latex), [latex]);

  if (display) {
    return (
      <View style={styles.displayBox}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.displayScrollContent}
          onTouchStart={() => {
            if (interactionRef) {
              interactionRef.current = true;
              interactionRef.suppressFlipUntil = Date.now() + 400;
            }
          }}
          onTouchEnd={() => {
            if (interactionRef) {
              interactionRef.current = false;
              interactionRef.suppressFlipUntil = Date.now() + 400;
            }
          }}
          onTouchCancel={() => {
            if (interactionRef) {
              interactionRef.current = false;
              interactionRef.suppressFlipUntil = Date.now() + 400;
            }
          }}
        >
          <MathNode node={ast} size={size * 1.06} color={color} display />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.inlineWrap} accessibilityLabel={latex}>
      <MathNode node={ast} size={size} color={color} display={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  inlineWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 1,
    paddingVertical: 1,
  },
  displayBox: {
    alignSelf: "stretch",
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(70,104,232,0.06)",
    borderWidth: 1,
    borderColor: "rgba(155,180,255,0.14)",
  },
  displayScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  fracCol: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
  },
  fracNum: {
    paddingHorizontal: 3,
    paddingBottom: 1.5,
  },
  fracBar: {
    alignSelf: "stretch",
    height: 1.2,
    minWidth: 10,
  },
  fracDen: {
    paddingHorizontal: 3,
    paddingTop: 1.5,
  },
  scriptWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  scriptStack: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginLeft: 1,
  },
  bigOpCol: {
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 3,
  },
  bigOpLimit: {
    alignItems: "center",
  },
  accentWrap: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  overbar: {
    alignSelf: "stretch",
    height: 1.2,
    marginBottom: 1,
  },
  accentSvg: {
    marginBottom: -1,
  },
  sqrtWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 1,
  },
  sqrtIndex: {
    alignSelf: "flex-start",
    marginRight: -3,
    marginTop: 1,
  },
  sqrtBody: {
    borderTopWidth: 1.3,
    paddingTop: 1.5,
    paddingHorizontal: 3,
  },
  svgDelim: {
    marginHorizontal: 1,
  },
  matrixGrid: {
    gap: 5,
    paddingHorizontal: 4,
  },
  matrixRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  matrixCell: {
    alignItems: "center",
  },
});
