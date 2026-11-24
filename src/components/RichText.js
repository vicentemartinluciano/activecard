// Renderiza el formato liviano de src/lib/richtext.js: negrita, cursiva,
// subrayado, resaltado, color de texto, viñetas, listas numeradas ("N. "),
// divisor ("---") y fórmulas LaTeX ($...$, $$...$$, \(...\), \[...\]).
// La forma de cada bloque la decide describeBlock (richhtml.js), la misma que
// usa el editor — así lo que se ve al estudiar es exactamente lo que se ve al editar.

import { useContext, useEffect, useMemo, useState } from "react";
import { Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { hasMathSyntax, splitMathSegments } from "../lib/mathLatex";
import { describeBlock, groupDisplayMathBlocks, groupQuoteRuns } from "../lib/richhtml";
import { linkDisplayTitle, linkDomain, linkPlatformInfo, sanitizeLinkUrl } from "../lib/richLink";
import { tableGrid, tableColumnWidths } from "../lib/richTable";
import { parseRich } from "../lib/richtext";
import { colors, font, radius, spacing, textColors } from "../theme";
import MathFormula from "./MathFormula";
import { StudyInteractionContext } from "./StudyInteractionContext";
import RichToggle from "./RichToggle";

// Imagen inline (data URI). Toma el aspect ratio real para no deformarla y
// respetar el ancho elegido. width = % del ancho (100 = a todo lo ancho); se
// centra. Tocarla la abre a pantalla completa.
// La proporción se saca del evento onLoad de la <Image> (funciona con data URIs
// base64 en Android, donde Image.getSize FALLA); getSize queda como camino extra
// para la web. Sin proporción, si cayera a una altura fija, el ancho no se
// notaría — por eso onLoad es clave en el celu.
function ImageBlock({ src, width = 100 }) {
  const [ratio, setRatio] = useState(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      src,
      (w, h) => {
        if (alive && h) setRatio(w / h);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <View style={styles.imageWrap}>
      <Pressable onPress={() => setExpanded(true)} style={{ width: `${width}%` }}>
        <Image
          source={{ uri: src }}
          onLoad={(e) => {
            const s = e?.nativeEvent?.source;
            if (s && s.height) setRatio(s.width / s.height);
          }}
          style={[styles.image, { aspectRatio: ratio || 1 }]}
          resizeMode="contain"
        />
      </Pressable>
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.lightbox} onPress={() => setExpanded(false)}>
          <Image source={{ uri: src }} style={styles.lightboxImg} resizeMode="contain" />
        </Pressable>
      </Modal>
    </View>
  );
}

function TableBlock({ rows, style }) {
  const interactionRef = useContext(StudyInteractionContext);
  const [measured, setMeasured] = useState({});
  const [width, setWidth] = useState(0);
  const { cells, columns } = useMemo(() => tableGrid(rows), [rows]);
  const minColumnWidth = Platform.OS === "web" ? 80 : 200;
  const columnWidth = Math.max(200, width / Math.max(1, columns));
  const widths = tableColumnWidths(rows, columnWidth, minColumnWidth);
  const columnOffset = (column) => widths.slice(0, column).reduce((sum, value) => sum + value, 0);
  const heights = rows.map(() => 48);
  cells.forEach((cell, index) => {
    const height = (measured[index] || 48) / cell.rowspan;
    for (let r = cell.row; r < cell.row + cell.rowspan; r++) heights[r] = Math.max(heights[r], height);
  });
  const offset = (row) => heights.slice(0, row).reduce((sum, height) => sum + height, 0);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ marginVertical: 12 }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator dataSet={{ studyAction: "table" }}
        onTouchStart={() => { if (interactionRef) { interactionRef.current = true; interactionRef.suppressFlipUntil = Date.now() + 400; } }}
        onTouchEnd={() => { if (interactionRef) { interactionRef.current = false; interactionRef.suppressFlipUntil = Date.now() + 400; } }}
        onTouchCancel={() => { if (interactionRef) { interactionRef.current = false; interactionRef.suppressFlipUntil = Date.now() + 400; } }}>
        <View style={{ width: columnOffset(columns), height: offset(rows.length) }}>
          {cells.map((cell, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                left: columnOffset(cell.column),
                top: offset(cell.row),
                width: columnOffset(cell.column + cell.colspan) - columnOffset(cell.column),
                height: offset(cell.row + cell.rowspan) - offset(cell.row),
                borderWidth: 0.5,
                borderColor: colors.border,
                backgroundColor: cell.header ? colors.surfaceHigh : "transparent",
              }}
            >
              <View
                onLayout={(event) => {
                  const height = Math.ceil(event.nativeEvent.layout.height) + 2;
                  setMeasured((previous) => (previous[index] === height ? previous : { ...previous, [index]: height }));
                }}
                style={{ padding: 10 }}
              >
                <RichText text={cell.text} style={[style, cell.header && styles.bold]} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function openSafeUrl(url) {
  const safe = sanitizeLinkUrl(url);
  if (safe) Linking.openURL(safe).catch?.(() => {});
}

function spanStyle(span) {
  return [
    span.bold && styles.bold,
    span.italic && styles.italic,
    span.underline && span.strike ? styles.underlineStrike : span.underline && styles.underline,
    span.strike && !span.underline && styles.strike,
    span.highlight && styles.highlight,
    span.color && textColors[span.color] ? { color: textColors[span.color] } : null,
  ];
}

function renderInlineSpan(span, key, textOverride = null, interactionRef = null) {
  const label = textOverride != null ? textOverride : span.text;
  if (span.link?.href) {
    const isMention = span.link.display === "mention";
    const platform = linkPlatformInfo(span.link.href);
    return (
      <Text
        key={key}
        accessibilityRole="link"
        onPress={(event) => {
          event?.stopPropagation?.();
          if (interactionRef) interactionRef.suppressFlipUntil = Date.now() + 450;
          openSafeUrl(span.link.href);
        }}
        style={[spanStyle(span), isMention ? styles.linkMention : styles.linkInline]}
      >
        {isMention ? `${platform.icon} ${label}` : label}
      </Text>
    );
  }
  return (
    <Text key={key} style={spanStyle(span)}>
      {label}
    </Text>
  );
}

function LinkBlock({ link }) {
  const interactionRef = useContext(StudyInteractionContext);
  const platform = linkPlatformInfo(link.url);
  const domain = linkDomain(link.url) || link.url;
  const titleText = linkDisplayTitle(link.url, link.title);
  const descText = String(link.description || "").trim();
  const isCard = link.variant === "card";
  const guard = (active) => {
    if (!interactionRef) return;
    interactionRef.current = active;
    interactionRef.suppressFlipUntil = Date.now() + 450;
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={titleText}
      onTouchStart={() => guard(true)}
      onTouchEnd={() => guard(false)}
      onTouchCancel={() => guard(false)}
      onPress={(event) => {
        event?.stopPropagation?.();
        guard(false);
        openSafeUrl(link.url);
      }}
      style={({ pressed }) => [styles.linkBlock, isCard && styles.linkBlockCard, pressed && styles.linkBlockPressed]}
    >
      {isCard && (
        <View style={styles.linkCardHeader}>
          <View style={styles.linkCardBadge}>
            <Text style={[styles.linkBlockIcon, { color: platform.accent }]}>{platform.icon}</Text>
            <Text style={styles.linkCardPlatform}>{platform.name}</Text>
          </View>
          <Text style={styles.linkBlockOpenText}>Abrir ↗</Text>
        </View>
      )}
      <View style={styles.linkBlockInner}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.linkBlockTitle} numberOfLines={2}>
            {titleText}
          </Text>
          {descText ? (
            <Text style={styles.linkBlockDesc} numberOfLines={2}>
              {descText}
            </Text>
          ) : null}
          <View style={styles.linkBlockMetaRow}>
            {!isCard && <Text style={[styles.linkBlockIcon, { color: platform.accent }]}>{platform.icon}</Text>}
            <Text style={styles.linkBlockDomain} numberOfLines={1}>
              {domain}
            </Text>
          </View>
        </View>
        {!isCard && <Text style={styles.linkBlockArrow}>↗</Text>}
      </View>
    </Pressable>
  );
}

function spansHaveMath(spans) {
  return Array.isArray(spans) && spans.some((span) => hasMathSyntax(span.text));
}

function buildMathChunks(spans) {
  const chunks = [];
  let inlineParts = [];

  const flushInline = () => {
    if (inlineParts.length) {
      chunks.push({ kind: "inline", parts: inlineParts });
      inlineParts = [];
    }
  };

  for (const span of spans) {
    const segments = splitMathSegments(span.text);
    for (const seg of segments) {
      if (seg.type === "math" && seg.display) {
        flushInline();
        chunks.push({ kind: "display", latex: seg.latex, span });
      } else if (seg.type === "math") {
        inlineParts.push({ kind: "math", latex: seg.latex, span });
      } else if (seg.text) {
        inlineParts.push({ kind: "text", text: seg.text, span });
      }
    }
  }
  flushInline();
  return chunks;
}

function RichLineWithMath({ spans, baseStyle, align = "left", flexContainer = false, interactionRef = null }) {
  const chunks = buildMathChunks(spans);
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  const nodes = chunks.map((chunk, cIdx) => {
    if (chunk.kind === "display") {
      return (
        <MathFormula
          key={`d-${cIdx}`}
          latex={chunk.latex}
          display
          style={[baseStyle, spanStyle(chunk.span)]}
        />
      );
    }

    if (Platform.OS === "web") {
      return (
        <Text
          key={`i-${cIdx}`}
          style={[baseStyle, align !== "left" && { textAlign: align }, flexContainer && styles.liContent]}
        >
          {chunk.parts.map((part, pIdx) =>
            part.kind === "math" ? (
              <MathFormula
                key={pIdx}
                latex={part.latex}
                display={false}
                style={[baseStyle, spanStyle(part.span)]}
              />
            ) : (
              renderInlineSpan(part.span, pIdx, part.text, interactionRef)
            )
          )}
        </Text>
      );
    }

    return (
      <View
        key={`i-${cIdx}`}
        style={[
          styles.inlineMathRow,
          flexContainer && styles.liContent,
          { justifyContent: justify },
        ]}
      >
        {chunk.parts.map((part, pIdx) => {
          if (part.kind === "math") {
            return (
              <MathFormula
                key={pIdx}
                latex={part.latex}
                display={false}
                style={[baseStyle, spanStyle(part.span)]}
              />
            );
          }
          if (part.span.link?.href) {
            return renderInlineSpan(part.span, pIdx, part.text, interactionRef);
          }
          const tokens = part.text.split(/(\s+)/).filter(Boolean);
          return tokens.map((token, tIdx) => (
            <Text key={`${pIdx}-${tIdx}`} style={[baseStyle, spanStyle(part.span)]}>
              {token}
            </Text>
          ));
        })}
      </View>
    );
  });

  if (chunks.length === 1 && !flexContainer) return nodes[0];
  return <View style={flexContainer ? styles.liContent : undefined}>{nodes}</View>;
}

// defaultAlign: alineación de los bloques SIN alineación explícita (el default
// por cara — el dorso arranca centrado). Las listas nunca heredan el default
// (siempre a la izquierda).
export default function RichText({ text, style, containerStyle, defaultAlign = "left" }) {
  const interactionRef = useContext(StudyInteractionContext);
  const baseSize = StyleSheet.flatten(style)?.fontSize || 16;
  const blocks = useMemo(
    () => groupDisplayMathBlocks(groupQuoteRuns(parseRich(text).map(describeBlock))),
    [text]
  );
  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, i) => {
        if (block.kind === "mathBlock") {
          return <MathFormula key={i} latex={block.latex} display style={style} />;
        }
        if (block.kind === "linkBlock") {
          return <LinkBlock key={i} link={block.link} />;
        }
        if (block.kind === "list") return (
          <View key={i}>
            {block.items.map((item, index) => <View key={index} style={styles.liRow}>
              <Text style={[style, styles.bullet]}>{block.ordered ? `${block.start + index}.` : "•"}</Text>
              <RichText text={item} style={style} containerStyle={{ flex: 1 }} defaultAlign="left" />
            </View>)}
          </View>
        );
        if (block.kind === "toggle") {
          const title = describeBlock(parseRich(block.summary)[0]);
          const scale = { heading1: 1.55, heading2: 1.3, heading3: 1.12 }[title.kind];
          const lineHeight = scale ? baseSize * scale * 1.22 + 8 : StyleSheet.flatten(style)?.lineHeight || baseSize * 1.45;
          return (
            <RichToggle key={`${i}:${block.summary}`} arrowOffset={Math.max(0, (lineHeight - 24) / 2)} title={<RichText text={block.summary || "Desplegable"} style={style} defaultAlign={defaultAlign} />}>
              <RichText text={block.content} style={style} defaultAlign={defaultAlign} />
            </RichToggle>
          );
        }
        if (block.kind === "table") return <TableBlock key={i} rows={block.rows} style={style} />;
        if (block.kind === "quoteGroup") {
          return (
            <View key={i} style={styles.quoteWrap}>
              {block.blocks.map((quote, j) => {
                const align = quote.align || defaultAlign;
                if (spansHaveMath(quote.spans)) {
                  return (
                    <RichLineWithMath
                      key={j}
                      spans={quote.spans}
                      baseStyle={[style, styles.quoteText]}
                      align={align}
                      interactionRef={interactionRef}
                    />
                  );
                }
                return (
                  <Text
                    key={j}
                    style={[style, styles.quoteText, align !== "left" && { textAlign: align }]}
                  >
                    {quote.spans.length === 0 ? "\u00a0" : quote.spans.map((span, k) => (
                      renderInlineSpan(span, k, null, interactionRef)
                    ))}
                  </Text>
                );
              })}
            </View>
          );
        }

        if (block.kind === "hr") {
          return <View key={i} style={styles.divider} />;
        }

        if (block.kind === "img") {
          return <ImageBlock key={i} src={block.src} width={block.width} />;
        }

        const isList = block.kind === "li" || block.kind === "ol";
        // block.align: "left"/"center"/"right" explícito, o null ("sin tocar").
        // Sin tocar → las listas van a la izquierda; el resto usa el default de
        // la cara (frente = centro, dorso = izquierda).
        const align = block.align || (isList ? "left" : defaultAlign);
        const headingScale = { heading1: 1.55, heading2: 1.3, heading3: 1.12 }[block.kind];
        const blockTextStyle = headingScale
          ? { ...font(700), fontSize: baseSize * headingScale, lineHeight: baseSize * headingScale * 1.22, marginVertical: 4 }
          : { marginBottom: 2 };

        const line = spansHaveMath(block.spans) ? (
          <RichLineWithMath
            key={i}
            spans={block.spans}
            baseStyle={[style, blockTextStyle]}
            align={align}
            flexContainer={isList}
            interactionRef={interactionRef}
          />
        ) : (
          <Text
            style={[style, blockTextStyle, align !== "left" && { textAlign: align }, isList && styles.liContent]}
            key={i}
          >
            {block.spans.length === 0 ? "\u00a0" : block.spans.map((span, j) => (
              renderInlineSpan(span, j, null, interactionRef)
            ))}
          </Text>
        );

        if (block.kind === "li" || block.kind === "ol") {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={[style, styles.bullet]}>
                {block.kind === "ol" ? `${block.number}.` : "•"}
              </Text>
              {line}
            </View>
          );
        }
        return line;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  inlineMathRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 2,
  },
  bold: { ...font(700) },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
  strike: { textDecorationLine: "line-through" },
  underlineStrike: { textDecorationLine: "underline line-through" },
  highlight: {
    backgroundColor: colors.highlight,
  },
  liRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  // El contenido de la lista ocupa el ancho restante de la fila y ENVUELVE
  // (sin flex, un Text en una row se desborda y se recorta a la derecha).
  liContent: {
    flex: 1,
  },
  bullet: {
    marginTop: 1,
  },
  quoteWrap: { borderLeftWidth: 3, borderLeftColor: "#5B6897", paddingLeft: 12, paddingVertical: 3, marginVertical: 5 },
  quoteText: { color: colors.textMuted, marginBottom: 2 },
  divider: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  imageWrap: {
    width: "100%",
    marginVertical: spacing.sm,
    alignItems: "center",
  },
  image: {
    width: "100%",
    borderRadius: radius.sm,
  },
  lightbox: {
    flex: 1,
    backgroundColor: "#000000EE",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  lightboxImg: {
    width: "100%",
    height: "100%",
  },
  linkInline: {
    color: colors.accentText,
    textDecorationLine: "underline",
    textDecorationColor: "rgba(155,180,255,0.55)",
  },
  linkMention: {
    color: colors.text,
    backgroundColor: "rgba(70,104,232,0.16)",
    borderRadius: 6,
    overflow: "hidden",
    ...font(600),
  },
  linkBlock: {
    marginVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: colors.surfaceCard,
    overflow: "hidden",
  },
  linkBlockCard: {
    borderColor: "rgba(70,104,232,0.35)",
  },
  linkBlockPressed: {
    opacity: 0.85,
  },
  linkCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(70,104,232,0.10)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  linkCardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linkCardPlatform: {
    color: colors.text,
    fontSize: 12,
    ...font(600),
  },
  linkBlockInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkBlockTitle: {
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 20,
    ...font(600),
  },
  linkBlockDesc: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 2,
  },
  linkBlockMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  linkBlockIcon: {
    fontSize: 12.5,
    ...font(700),
  },
  linkBlockDomain: {
    color: colors.textMuted,
    fontSize: 12,
    flexShrink: 1,
  },
  linkBlockOpenText: {
    color: colors.accentText,
    fontSize: 12,
    ...font(600),
  },
  linkBlockArrow: {
    color: colors.accentText,
    fontSize: 17,
    paddingLeft: 4,
  },
});
