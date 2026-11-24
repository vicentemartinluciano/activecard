import { hasMathSyntax, matchMathAt, splitMathSegments } from "./mathLatex";
import { isStandaloneUrl, matchMarkdownLinkAt, sanitizeLinkUrl } from "./richLink";

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(text) {
  return String(text || "").replace(/[&<>"]/g, (ch) => HTML_ESCAPES[ch]);
}

const UNICODE_TO_LATEX = {
  "⋯": "\\cdots ",
  "…": "\\ldots ",
  "⟹": "\\implies ",
  "⟸": "\\impliedby ",
  "⟺": "\\iff ",
  "→": "\\to ",
  "←": "\\leftarrow ",
  "↔": "\\leftrightarrow ",
  "↦": "\\mapsto ",
  "⇒": "\\Rightarrow ",
  "⇐": "\\Leftarrow ",
  "⇔": "\\Leftrightarrow ",
  "≤": "\\le ",
  "≥": "\\ge ",
  "≠": "\\neq ",
  "≈": "\\approx ",
  "≡": "\\equiv ",
  "≅": "\\cong ",
  "∝": "\\propto ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "⊂": "\\subset ",
  "⊆": "\\subseteq ",
  "⊃": "\\supset ",
  "⊇": "\\supseteq ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "∅": "\\emptyset ",
  "∀": "\\forall ",
  "∃": "\\exists ",
  "¬": "\\neg ",
  "∧": "\\land ",
  "∨": "\\lor ",
  "×": "\\times ",
  "÷": "\\div ",
  "±": "\\pm ",
  "∓": "\\mp ",
  "·": "\\cdot ",
  "⋅": "\\cdot ",
  "∗": "*",
  "∞": "\\infty ",
  "∂": "\\partial ",
  "∇": "\\nabla ",
  "∑": "\\sum ",
  "∏": "\\prod ",
  "∫": "\\int ",
  "∬": "\\iint ",
  "∮": "\\oint ",
  "−": "-",
  "–": "-",
  "⟨": "\\langle ",
  "⟩": "\\rangle ",
  α: "\\alpha ",
  β: "\\beta ",
  γ: "\\gamma ",
  δ: "\\delta ",
  ε: "\\varepsilon ",
  ϵ: "\\epsilon ",
  ζ: "\\zeta ",
  η: "\\eta ",
  θ: "\\theta ",
  ϑ: "\\vartheta ",
  ι: "\\iota ",
  κ: "\\kappa ",
  λ: "\\lambda ",
  μ: "\\mu ",
  ν: "\\nu ",
  ξ: "\\xi ",
  π: "\\pi ",
  ρ: "\\rho ",
  σ: "\\sigma ",
  τ: "\\tau ",
  υ: "\\upsilon ",
  φ: "\\varphi ",
  ϕ: "\\phi ",
  χ: "\\chi ",
  ψ: "\\psi ",
  ω: "\\omega ",
  Γ: "\\Gamma ",
  Δ: "\\Delta ",
  Θ: "\\Theta ",
  Λ: "\\Lambda ",
  Ξ: "\\Xi ",
  Π: "\\Pi ",
  Σ: "\\Sigma ",
  Φ: "\\Phi ",
  Ψ: "\\Psi ",
  Ω: "\\Omega ",
  ℝ: "\\mathbb{R}",
  ℕ: "\\mathbb{N}",
  ℤ: "\\mathbb{Z}",
  ℚ: "\\mathbb{Q}",
  ℂ: "\\mathbb{C}",
  "°": "^\\circ ",
};

function mapMathTextToLatex(rawText) {
  let out = "";
  const text = String(rawText || "");
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (Object.prototype.hasOwnProperty.call(UNICODE_TO_LATEX, ch)) {
      out += UNICODE_TO_LATEX[ch];
    } else {
      out += ch;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

function wrapBraces(latex) {
  const value = String(latex || "").trim();
  if (!value) return "{}";
  if (/^[A-Za-z0-9]$/.test(value)) return value;
  return `{${value}}`;
}

function getElementChildren(node) {
  return Array.from(node?.childNodes || []).filter((child) => child.nodeType === 1);
}

/**
 * Convierte un subárbol MathML (sin anotación LaTeX) a LaTeX limpio.
 */
export function mathMlToLatex(node) {
  if (!node) return "";
  if (node.nodeType === 3) {
    return mapMathTextToLatex(node.nodeValue || "");
  }
  if (node.nodeType !== 1) return "";

  const tag = (node.localName || node.tagName || "").toLowerCase();
  if (tag === "annotation" || tag === "annotation-xml") return "";

  if (tag === "semantics") {
    const first = getElementChildren(node)[0];
    return first ? mathMlToLatex(first) : "";
  }

  const children = getElementChildren(node);
  const childLatex = (index) => (children[index] ? mathMlToLatex(children[index]) : "");
  const joinChildren = () =>
    Array.from(node.childNodes || [])
      .map((child) => mathMlToLatex(child))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  if (tag === "math" || tag === "mrow" || tag === "mstyle" || tag === "mpadded" || tag === "mphantom") {
    return joinChildren();
  }
  if (tag === "mi" || tag === "mn" || tag === "mo") {
    return mapMathTextToLatex(node.textContent || "");
  }
  if (tag === "mtext") {
    const txt = (node.textContent || "").trim();
    return txt ? `\\text{${txt}}` : "";
  }
  if (tag === "mspace") return " ";
  if (tag === "mfrac") {
    return `\\frac{${childLatex(0)}}{${childLatex(1)}}`;
  }
  if (tag === "msqrt") {
    return `\\sqrt{${joinChildren()}}`;
  }
  if (tag === "mroot") {
    const base = childLatex(0);
    const idx = childLatex(1);
    return idx ? `\\sqrt[${idx}]{${base}}` : `\\sqrt{${base}}`;
  }
  if (tag === "msup") {
    return `${childLatex(0)}^${wrapBraces(childLatex(1))}`;
  }
  if (tag === "msub") {
    return `${childLatex(0)}_${wrapBraces(childLatex(1))}`;
  }
  if (tag === "msubsup") {
    return `${childLatex(0)}_${wrapBraces(childLatex(1))}^${wrapBraces(childLatex(2))}`;
  }
  if (tag === "mover") {
    const base = childLatex(0);
    const overRaw = (children[1]?.textContent || "").trim();
    if (["¯", "ˉ", "\u00AF", "\u0304", "\u203E", "_"].includes(overRaw)) return `\\bar{${base}}`;
    if (["^", "ˆ", "\u02C6", "\u0302"].includes(overRaw)) return `\\hat{${base}}`;
    if (["~", "˜", "\u02DC", "\u0303"].includes(overRaw)) return `\\tilde{${base}}`;
    if (["→", "\u20D7"].includes(overRaw)) return `\\vec{${base}}`;
    return `${base}^${wrapBraces(childLatex(1))}`;
  }
  if (tag === "munder") {
    return `${childLatex(0)}_${wrapBraces(childLatex(1))}`;
  }
  if (tag === "munderover") {
    return `${childLatex(0)}_${wrapBraces(childLatex(1))}^${wrapBraces(childLatex(2))}`;
  }
  if (tag === "mfenced") {
    const open = node.getAttribute?.("open") ?? "(";
    const close = node.getAttribute?.("close") ?? ")";
    const sep = node.getAttribute?.("separators") ?? ",";
    const inner = children.map((c) => mathMlToLatex(c)).join(sep ? `${sep[0]} ` : " ");
    const left = open === "{" ? "\\{" : open || ".";
    const right = close === "}" ? "\\}" : close || ".";
    return `\\left${left} ${inner} \\right${right}`;
  }
  if (tag === "mtable") {
    const rows = children
      .map((row) => mathMlToLatex(row))
      .filter(Boolean)
      .join(" \\\\ ");
    return `\\begin{matrix} ${rows} \\end{matrix}`;
  }
  if (tag === "mtr" || tag === "mlabeledtr") {
    return children
      .map((cell) => mathMlToLatex(cell))
      .join(" & ");
  }
  if (tag === "mtd") {
    return joinChildren();
  }

  return joinChildren();
}

function unwrapOuterBracesDirective(latex) {
  let out = String(latex || "").trim();
  const displayPrefixes = [
    /^\\displaystyle\s*/,
    /^\\textstyle\s*/,
    /^\\scriptstyle\s*/,
  ];
  for (const prefix of displayPrefixes) {
    out = out.replace(prefix, "").trim();
  }
  const wrappedDisplay = /^\{\s*\\(?:displaystyle|textstyle)\s+([\s\S]*)\}$/.exec(out);
  if (wrappedDisplay) {
    out = wrappedDisplay[1].trim();
  }
  if (out.startsWith("$$") && out.endsWith("$$") && out.length > 4) {
    out = out.slice(2, -2).trim();
  } else if (out.startsWith("\\[") && out.endsWith("\\]") && out.length > 4) {
    out = out.slice(2, -2).trim();
  } else if (out.startsWith("\\(") && out.endsWith("\\)") && out.length > 4) {
    out = out.slice(2, -2).trim();
  } else if (
    out.startsWith("$") &&
    out.endsWith("$") &&
    out.length > 2 &&
    !out.startsWith("$$")
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

function cleanLatexContent(rawLatex) {
  let out = unwrapOuterBracesDirective(rawLatex);
  // Preservar \\ de entornos multilínea pero colapsar saltos de línea del DOM.
  out = out.replace(/\r\n?/g, "\n").replace(/\s*\n+\s*/g, " ").trim();
  return out;
}

function extractLatexFromElement(el) {
  if (!el || el.nodeType !== 1) return "";

  for (const attr of ["data-math", "data-latex", "data-tex", "data-equation"]) {
    const val = el.getAttribute?.(attr);
    if (val && val.trim()) return cleanLatexContent(val);
  }

  const descendantAttr = el.querySelector?.("[data-math], [data-latex], [data-tex], [data-equation]");
  if (descendantAttr) {
    for (const attr of ["data-math", "data-latex", "data-tex", "data-equation"]) {
      const val = descendantAttr.getAttribute?.(attr);
      if (val && val.trim()) return cleanLatexContent(val);
    }
  }

  const annotations = Array.from(el.querySelectorAll?.("annotation") || []);
  for (const ann of annotations) {
    const enc = (ann.getAttribute?.("encoding") || "").toLowerCase();
    if (!enc || enc.includes("tex")) {
      const val = cleanLatexContent(ann.textContent || "");
      if (val) return val;
    }
  }

  const tag = (el.tagName || "").toLowerCase();
  if (tag === "script" && /^math\/tex/i.test(el.getAttribute?.("type") || "")) {
    return cleanLatexContent(el.textContent || "");
  }
  const scriptTex = el.querySelector?.('script[type^="math/tex"]');
  if (scriptTex) {
    const val = cleanLatexContent(scriptTex.textContent || "");
    if (val) return val;
  }

  const altSelf = el.getAttribute?.("alttext");
  if (altSelf && altSelf.trim()) return cleanLatexContent(altSelf);

  const mathEl = tag === "math" ? el : el.querySelector?.("math");
  if (mathEl) {
    const mathAlt = mathEl.getAttribute?.("alttext");
    if (mathAlt && mathAlt.trim()) return cleanLatexContent(mathAlt);
    const ml = cleanLatexContent(mathMlToLatex(mathEl));
    if (ml) return ml;
  }

  return "";
}

function isDisplayMathElement(el, rawLatex = "") {
  if (!el || el.nodeType !== 1) return false;
  const tag = (el.tagName || "").toLowerCase();
  const cls = String(el.getAttribute?.("class") || "");
  if (/\b(katex-display|math-block|math-display|ac-math-block|mwe-math-mathml-display)\b/.test(cls)) {
    return true;
  }
  if (el.querySelector?.(".katex-display, .math-block, .math-display, .ac-math-block, math[display='block'], mjx-container[display='true']")) {
    return true;
  }
  const displayAttr = (el.getAttribute?.("display") || "").toLowerCase();
  if (displayAttr === "block" || displayAttr === "true") return true;
  if (tag === "script" && /mode\s*=\s*display/i.test(el.getAttribute?.("type") || "")) return true;
  if (tag === "div" && !/\bmath-inline\b/.test(cls)) {
    return true;
  }
  if (/^\s*(\$\$|\\\[)/.test(rawLatex)) return true;

  // Si está envuelto directamente por un contenedor display explícito.
  const parent = el.parentElement;
  if (parent) {
    const parentCls = String(parent.getAttribute?.("class") || "");
    if (/\b(katex-display|math-block|math-display|ac-math-block|mwe-math-mathml-display)\b/.test(parentCls)) {
      return true;
    }
  }
  return false;
}

function hasMeaningfulDomContent(node) {
  if (!node) return false;
  if (node.nodeType === 3) return Boolean((node.nodeValue || "").trim());
  if (node.nodeType !== 1) return false;
  const tag = (node.tagName || "").toLowerCase();
  if (tag === "img" || tag === "hr") return true;
  return Array.from(node.childNodes || []).some(hasMeaningfulDomContent);
}

const SPLITTABLE_PARENTS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "strike",
  "mark",
  "span",
  "font",
  "a",
  "code",
  "small",
  "sup",
  "sub",
]);

function replaceWithDisplayParagraph(doc, el, latex) {
  let cur = el;
  while (cur.parentElement && SPLITTABLE_PARENTS.has((cur.parentElement.tagName || "").toLowerCase())) {
    const parent = cur.parentElement;
    const grand = parent.parentNode;
    if (!grand) break;
    const after = parent.cloneNode(false);
    while (cur.nextSibling) {
      after.appendChild(cur.nextSibling);
    }
    grand.insertBefore(cur, parent.nextSibling);
    if (hasMeaningfulDomContent(after)) {
      grand.insertBefore(after, cur.nextSibling);
    }
    if (!hasMeaningfulDomContent(parent)) {
      parent.remove();
    }
  }

  const p = doc.createElement("p");
  p.textContent = `$$${latex}$$`;
  cur.replaceWith(p);
}

const MATH_CONTAINER_SELECTOR = [
  "[data-math]",
  "[data-latex]",
  "[data-tex]",
  "[data-equation]",
  ".mwe-math-element",
  ".ac-math-block",
  ".ac-math-inline",
  ".katex-display",
  ".katex",
  ".katex-mathml",
  ".math-block",
  ".math-inline",
  ".math-display",
  "mjx-container",
  "math",
  'script[type^="math/tex"]',
].join(",");

const BLOCK_CONTAINERS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "hr",
  "details",
  "summary",
  "pre",
  "img",
]);

const TEXT_ALIGN_TAGS = new Set(["p", "h1", "h2", "h3", "blockquote"]);
const VALID_COLORS = new Set(["rojo", "naranja", "amarillo", "verde", "azul", "violeta"]);

function stripUnsafeAttrs(doc, root) {
  // Recorrer de abajo hacia arriba / snapshot para reestructurar sin perder orden.
  const all = Array.from(root.querySelectorAll("*"));
  for (const el of all) {
    if (!el.isConnected) continue;
    const tag = (el.tagName || "").toLowerCase();

    if (tag === "h4" || tag === "h5" || tag === "h6") {
      const h3 = doc.createElement("h3");
      while (el.firstChild) h3.appendChild(el.firstChild);
      el.replaceWith(h3);
      continue;
    }

    // Google Docs / editores suelen envolver todo el documento en <b style="font-weight:normal">.
    if (tag === "b") {
      const fw = (el.style?.fontWeight || "").toLowerCase().trim();
      if (fw === "normal" || fw === "400" || fw === "300") {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
    }

    if (tag === "a") {
      const href = sanitizeLinkUrl(el.getAttribute("href"));
      if (!href) {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      const display = el.getAttribute("data-link-display") === "mention" ? "mention" : "inline";
      for (const attr of Array.from(el.attributes)) {
        el.removeAttribute(attr.name);
      }
      el.setAttribute("href", href);
      el.setAttribute("data-link-display", display);
      continue;
    }

    if (tag === "span") {
      const dataColor = el.getAttribute("data-color");
      if (dataColor && VALID_COLORS.has(dataColor)) {
        for (const attr of Array.from(el.attributes)) {
          if (attr.name !== "data-color" && attr.name !== "style") {
            el.removeAttribute(attr.name);
          }
        }
      } else {
        el.replaceWith(...Array.from(el.childNodes));
      }
      continue;
    }

    if (tag === "div") {
      const dataType = el.getAttribute("data-type");
      if (dataType === "toggle-content" || el.hasAttribute("data-nf-toggle-content")) {
        continue;
      }
      if (el.hasAttribute("data-link-url")) {
        const url = sanitizeLinkUrl(el.getAttribute("data-link-url"));
        if (!url) {
          el.remove();
          continue;
        }
        const saved = {
          url,
          title: el.getAttribute("data-link-title") || "",
          desc: el.getAttribute("data-link-desc") || "",
          variant: el.getAttribute("data-link-variant") === "card" ? "card" : "bookmark",
        };
        for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
        el.setAttribute("data-link-url", saved.url);
        el.setAttribute("data-link-title", saved.title);
        el.setAttribute("data-link-desc", saved.desc);
        el.setAttribute("data-link-variant", saved.variant);
        el.replaceChildren();
        continue;
      }
      const hasBlockChild = Array.from(el.children || []).some((child) =>
        BLOCK_CONTAINERS.has((child.tagName || "").toLowerCase())
      );
      if (!hasBlockChild && hasMeaningfulDomContent(el)) {
        const p = doc.createElement("p");
        const align = /^(left|center|right)$/i.exec(el.style?.textAlign || "")?.[1]?.toLowerCase();
        if (align) p.style.textAlign = align;
        while (el.firstChild) p.appendChild(el.firstChild);
        el.replaceWith(p);
      } else {
        el.replaceWith(...Array.from(el.childNodes));
      }
      continue;
    }

    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      if (!src.startsWith("data:image/")) {
        el.remove();
        continue;
      }
      const width = /\b(\d{1,3})%/.exec(el.style?.width || el.getAttribute("width") || "")?.[1];
      for (const attr of Array.from(el.attributes)) {
        if (attr.name !== "src") el.removeAttribute(attr.name);
      }
      if (width) el.style.width = `${width}%`;
      continue;
    }

    // Conservar solo atributos seguros permitidos en TipTap.
    const savedAlign = TEXT_ALIGN_TAGS.has(tag)
      ? /^(left|center|right)$/i.exec(el.style?.textAlign || "")?.[1]?.toLowerCase()
      : null;
    const savedStart = tag === "ol" ? el.getAttribute("start") : null;
    const savedColspan = tag === "td" || tag === "th" ? el.getAttribute("colspan") : null;
    const savedRowspan = tag === "td" || tag === "th" ? el.getAttribute("rowspan") : null;
    const savedColwidth = tag === "td" || tag === "th" ? el.getAttribute("colwidth") : null;
    const savedType = tag === "details" ? el.getAttribute("data-type") : null;
    const savedOpen = tag === "details" && el.hasAttribute("open");
    const savedToggleAttr = tag === "details" && el.hasAttribute("data-nf-toggle");

    for (const attr of Array.from(el.attributes)) {
      el.removeAttribute(attr.name);
    }
    if (savedAlign) el.style.textAlign = savedAlign;
    if (savedStart) el.setAttribute("start", savedStart);
    if (savedColspan) el.setAttribute("colspan", savedColspan);
    if (savedRowspan) el.setAttribute("rowspan", savedRowspan);
    if (savedColwidth) el.setAttribute("colwidth", savedColwidth);
    if (savedType) el.setAttribute("data-type", savedType);
    if (savedOpen) el.setAttribute("open", "");
    if (savedToggleAttr) el.setAttribute("data-nf-toggle", "");
  }
}

function collapseHtmlWhitespaceInTextNodes(doc, root) {
  const walker = doc.createTreeWalker(root, 4);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) textNodes.push(node);

  const inlineParentBlocks = new Set(["p", "h1", "h2", "h3", "li", "blockquote", "td", "th", "summary"]);
  for (const tn of textNodes) {
    if (tn.parentElement?.closest?.("pre")) continue;
    let val = tn.nodeValue || "";
    if (!/[\r\n]/.test(val)) continue;
    val = val.replace(/\s*\r?\n\s*/g, " ");
    const parentTag = (tn.parentElement?.tagName || "").toLowerCase();
    if (inlineParentBlocks.has(parentTag)) {
      if (!tn.previousSibling) val = val.replace(/^\s+/, "");
      if (!tn.nextSibling) val = val.replace(/\s+$/, "");
    }
    tn.nodeValue = val;
  }

  // Eliminar nodos solo-whitespace entre bloques (indentación HTML entre </p> y <p>/<div>).
  const blockLevelContainers = new Set(["body", "blockquote", "ul", "ol", "table", "thead", "tbody", "tfoot", "tr", "details"]);
  const blockTagNames = new Set(["p", "h1", "h2", "h3", "div", "ul", "ol", "li", "blockquote", "table", "hr", "details", "pre"]);
  for (const tn of textNodes) {
    if (!tn.isConnected || /\S/.test(tn.nodeValue || "")) continue;
    const parentTag = (tn.parentElement?.tagName || "").toLowerCase();
    const prevTag = (tn.previousElementSibling?.tagName || "").toLowerCase();
    const nextTag = (tn.nextElementSibling?.tagName || "").toLowerCase();
    if (blockLevelContainers.has(parentTag) || blockTagNames.has(prevTag) || blockTagNames.has(nextTag)) {
      tn.remove();
    }
  }

  // Limpiar nodos solo-espacio directamente al principio o final de un bloque.
  for (const block of Array.from(root.querySelectorAll("p, h1, h2, h3, li, blockquote, td, th, summary"))) {
    while (block.firstChild?.nodeType === 3 && !block.firstChild.nodeValue.trim()) {
      block.firstChild.remove();
    }
    while (block.lastChild?.nodeType === 3 && !block.lastChild.nodeValue.trim()) {
      block.lastChild.remove();
    }
    if (block.firstChild?.nodeType === 3) {
      block.firstChild.nodeValue = block.firstChild.nodeValue.replace(/^\s+/, "");
    }
    if (block.lastChild?.nodeType === 3) {
      block.lastChild.nodeValue = block.lastChild.nodeValue.replace(/\s+$/, "");
    }
  }
}

function normalizeInlineMathDelimitersInTextNodes(root) {
  const doc = root.ownerDocument;
  if (!doc) return;
  const walker = doc.createTreeWalker(root, 4);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }
  for (const tn of textNodes) {
    const val = tn.nodeValue || "";
    if (!val.includes("\\(") && !val.includes("\\[") && !val.includes("$$")) continue;
    const segs = splitMathSegments(val);
    if (!segs.some((s) => s.type === "math")) continue;
    const rebuilt = segs
      .map((s) => {
        if (s.type !== "math") return s.text;
        const clean = cleanLatexContent(s.latex);
        return s.display ? `$$${clean}$$` : `$${clean}$`;
      })
      .join("");
    tn.nodeValue = rebuilt;
  }
}

function mergeMultilineMathParagraphsDom(doc, container) {
  const children = Array.from(container.children || []);
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    if (!child?.isConnected) {
      i += 1;
      continue;
    }
    const tag = (child.tagName || "").toLowerCase();
    if (tag === "blockquote" || tag === "li" || tag === "td" || tag === "th" || tag === "details") {
      mergeMultilineMathParagraphsDom(doc, child);
      i += 1;
      continue;
    }
    if (tag !== "p") {
      i += 1;
      continue;
    }

    const txt = (child.textContent || "").trim();
    const single = txt ? matchMathAt(txt, 0) : null;
    if (single && single.display && single.end === txt.length) {
      const normalized = cleanLatexContent(single.latex);
      if (txt !== `$$${normalized}$$`) {
        child.textContent = `$$${normalized}$$`;
      }
      i += 1;
      continue;
    }

    if ((txt.startsWith("$$") || txt.startsWith("\\[")) && !single) {
      let closeIdx = -1;
      let matched = null;
      for (let j = i + 1; j < children.length; j += 1) {
        if ((children[j]?.tagName || "").toLowerCase() !== "p") break;
        const combined = children
          .slice(i, j + 1)
          .map((el) => el.textContent || "")
          .join("\n")
          .trim();
        const cand = matchMathAt(combined, 0);
        if (cand && cand.display && cand.end === combined.length) {
          closeIdx = j;
          matched = cand;
          break;
        }
      }
      if (closeIdx !== -1 && matched) {
        child.textContent = `$$${cleanLatexContent(matched.latex)}$$`;
        for (let k = i + 1; k <= closeIdx; k += 1) {
          children[k].remove();
        }
        i = closeIdx + 1;
        continue;
      }
    }
    i += 1;
  }
}

/**
 * Normaliza HTML del portapapeles (ChatGPT, Gemini, Claude, KaTeX, MathJax,
 * Wikipedia, Notion, MathML) extrayendo fórmulas a $...$ / $$...$$ sin
 * duplicación de spans visuales ni contaminación de estilos de tema externo.
 */
export function normalizeClipboardHtml(html) {
  const input = html == null ? "" : String(html);
  if (!input.trim()) return "";
  if (typeof DOMParser === "undefined") return "";

  const doc = new DOMParser().parseFromString(input, "text/html");
  if (!doc || !doc.body) return "";

  // 1. Limpiar ruido UI antes de procesar matemáticas.
  for (const noise of Array.from(
    doc.body.querySelectorAll(
      'style, script:not([type^="math/tex"]), meta, link, noscript, svg, button, img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display'
    )
  )) {
    noise.remove();
  }

  // 2. Reemplazar contenedores matemáticos de afuera hacia adentro.
  for (const el of Array.from(doc.body.querySelectorAll(MATH_CONTAINER_SELECTOR))) {
    if (!el.isConnected || !doc.body.contains(el)) continue;
    const rawAttr =
      el.getAttribute?.("data-math") ||
      el.getAttribute?.("data-latex") ||
      el.getAttribute?.("data-tex") ||
      el.getAttribute?.("data-equation") ||
      "";
    const latex = extractLatexFromElement(el);
    if (!latex) continue;

    if (isDisplayMathElement(el, rawAttr)) {
      replaceWithDisplayParagraph(doc, el, latex);
    } else {
      el.replaceWith(doc.createTextNode(`$${latex}$`));
    }
  }

  // 3. Purgar cualquier resto visual de KaTeX/MathJax suelto tras extraer.
  for (const leftover of Array.from(
    doc.body.querySelectorAll('.katex-html, [aria-hidden="true"].katex-html, .mjx-chtml, mjx-assistive-mml, .MathJax, .MathJax_Display, .MathJax_SVG, .MathJax_Preview')
  )) {
    leftover.remove();
  }

  // 4. Limpiar atributos de estilos externos, tags no soportados y whitespace HTML.
  stripUnsafeAttrs(doc, doc.body);
  collapseHtmlWhitespaceInTextNodes(doc, doc.body);

  // 5. Normalizar delimitadores inline \(...\) -> $...$ y unir bloques multilínea $$ / \[.
  normalizeInlineMathDelimitersInTextNodes(doc.body);
  mergeMultilineMathParagraphsDom(doc, doc.body);
  for (const p of Array.from(doc.body.querySelectorAll("p"))) {
    if (!p.childElementCount && !hasMathSyntax(p.textContent || "")) {
      const txt = (p.textContent || "").trim();
      if (isStandaloneRawLatexLine(txt)) {
        p.textContent = `$$${cleanLatexContent(txt)}$$`;
      } else if (isStandaloneUnicodeMathLine(txt)) {
        p.textContent = `$$${convertUnicodeMathLineToLatex(txt)}$$`;
      }
    }
  }

  // 6. Quitar párrafos vacíos sobrantes generados al extraer wrappers.
  const bodyChildren = Array.from(doc.body.children || []);
  let prevEmpty = false;
  for (const child of bodyChildren) {
    const emptyP = (child.tagName || "").toLowerCase() === "p" && !hasMeaningfulDomContent(child);
    if (emptyP && prevEmpty) {
      child.remove();
    } else {
      prevEmpty = emptyP;
    }
  }
  while (
    doc.body.lastElementChild &&
    (doc.body.lastElementChild.tagName || "").toLowerCase() === "p" &&
    !hasMeaningfulDomContent(doc.body.lastElementChild)
  ) {
    doc.body.lastElementChild.remove();
  }
  while (
    doc.body.firstElementChild &&
    (doc.body.firstElementChild.tagName || "").toLowerCase() === "p" &&
    !hasMeaningfulDomContent(doc.body.firstElementChild)
  ) {
    doc.body.firstElementChild.remove();
  }

  return doc.body.innerHTML.trim();
}

// ---------------------------------------------------------------------------
// Conversión de portapapeles texto plano (Markdown + LaTeX + Unicode math)

const UNICODE_SUPER_CHARS = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
  "⁼": "=",
  "⁽": "(",
  "⁾": ")",
  "ⁿ": "n",
  "ⁱ": "i",
  "ᵏ": "k",
  "ʲ": "j",
  "ᵐ": "m",
  "ᵖ": "p",
  "ʳ": "r",
  "ˢ": "s",
  "ᵗ": "t",
  "ˣ": "x",
  "ʸ": "y",
  "ᶻ": "z",
  "ᵃ": "a",
  "ᵇ": "b",
  "ᶜ": "c",
  "ᵈ": "d",
  "ᵉ": "e",
  "ᶠ": "f",
  "ᵍ": "g",
  "ʰ": "h",
};

const UNICODE_SUB_CHARS = {
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "₊": "+",
  "₋": "-",
  "₌": "=",
  "₍": "(",
  "₎": ")",
  "ₐ": "a",
  "ₑ": "e",
  "ₕ": "h",
  "ᵢ": "i",
  "ⱼ": "j",
  "ₖ": "k",
  "ₗ": "l",
  "ₘ": "m",
  "ₙ": "n",
  "ₒ": "o",
  "ₚ": "p",
  "ᵣ": "r",
  "ₛ": "s",
  "ₜ": "t",
  "ᵤ": "u",
  "ᵥ": "v",
  "ₓ": "x",
};

const SUPER_CLASS = Object.keys(UNICODE_SUPER_CHARS).join("");
const SUB_CLASS = Object.keys(UNICODE_SUB_CHARS).join("");
const SUPER_RUN_RE = new RegExp(`[${SUPER_CLASS}]+`, "g");
const SUB_RUN_RE = new RegExp(`[${SUB_CLASS}]+`, "g");

function convertUnicodeMathLineToLatex(line) {
  let out = String(line || "").trim();
  out = out.replace(SUPER_RUN_RE, (run) => {
    const mapped = run
      .split("")
      .map((ch) => UNICODE_SUPER_CHARS[ch] || ch)
      .join("");
    return `^${wrapBraces(mapped)}`;
  });
  out = out.replace(SUB_RUN_RE, (run) => {
    const mapped = run
      .split("")
      .map((ch) => UNICODE_SUB_CHARS[ch] || ch)
      .join("");
    return `_${wrapBraces(mapped)}`;
  });
  return mapMathTextToLatex(out);
}

function isStandaloneUnicodeMathLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.length > 220) return false;
  if (hasMathSyntax(trimmed)) return false;
  // Evitar prose con algún m² suelto o listas numeradas: exigir signo relacional y señal matemática.
  if (!/[=≈≤≥≠⟹⟺]/.test(trimmed)) return false;
  if (/^\s*(?:#{1,6}\s|[-*•]\s|\d{1,3}\.\s|>\s|\*\*)/.test(trimmed)) return false;
  // Si contiene palabras largas de prosa (4+ letras seguidas más de una vez), probablemente no es ecuación pura.
  const proseWords = trimmed.match(/[A-Za-zÀ-ÿ]{4,}/g) || [];
  if (proseWords.length > 2) return false;
  const hasSuperOrSub = new RegExp(`[${SUPER_CLASS}${SUB_CLASS}]`).test(trimmed);
  const hasMathGlyph = /[⋯…∑∏∫∬∮√⟹⟸⟺≤≥≠≈≡±∓∞∂∇α-ωΑ-Ω]/.test(trimmed);
  return hasSuperOrSub || hasMathGlyph;
}

const RAW_LATEX_CMD_RE = /\\(?:frac|dfrac|tfrac|cdots|ldots|sum|prod|int|sqrt|implies|iff|bar|hat|vec|tilde|left|right|le|ge|neq|approx|alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|omega|cdot|times|infty|mathbb|text)\b/;

function isStandaloneRawLatexLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || hasMathSyntax(trimmed)) return false;
  if (/^\s*(?:#{1,6}\s|[-*•]\s|>\s)/.test(trimmed)) return false;
  return RAW_LATEX_CMD_RE.test(trimmed) || (/[=+\-*/]/.test(trimmed) && /[\^_]\{[^}]+\}/.test(trimmed));
}

function normalizeComparisonGlyphs(text) {
  return String(text || "")
    .replace(/\\(?:frac|dfrac|tfrac|cdots|ldots|sum|prod|int|sqrt|implies|bar|hat|vec|tilde|left|right|times|cdot|le|ge|neq|approx|to|infty)/g, "")
    .replace(/[^A-Za-z0-9=+\-*()]/g, "")
    .toLowerCase();
}

function isLikelyKatexDuplicateLine(rawLatexLine, candidateVisualLine) {
  const next = String(candidateVisualLine || "").trim();
  if (!next || hasMathSyntax(next)) return false;
  const converted = convertUnicodeMathLineToLatex(next);
  const a = normalizeComparisonGlyphs(rawLatexLine);
  const b = normalizeComparisonGlyphs(converted);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function inlineMarkdownSegmentToHtml(segment) {
  const tokens = [];
  const hold = (html) => {
    const token = `\uE070${tokens.length}\uE071`;
    tokens.push(html);
    return token;
  };

  // Extraer [texto](url) antes de escapar HTML/marcas para proteger guiones bajos en URLs.
  let withLinkTokens = "";
  let idx = 0;
  while (idx < segment.length) {
    if (segment[idx] === "[" && segment[idx + 1] !== "[") {
      const linkMatch = matchMarkdownLinkAt(segment, idx);
      if (linkMatch) {
        const innerHtml = inlineMarkdownSegmentToHtml(linkMatch.label);
        withLinkTokens += hold(
          `<a href="${escapeHtml(linkMatch.href)}" data-link-display="${linkMatch.display}">${innerHtml}</a>`
        );
        idx = linkMatch.end;
        continue;
      }
    }
    withLinkTokens += segment[idx];
    idx += 1;
  }

  let text = escapeHtml(withLinkTokens);

  text = text.replace(/\*\*([^*\n]+?)\*\*/g, (_, inner) => hold(`<strong>${inlineMarkdownSegmentToHtmlRaw(inner)}</strong>`));
  text = text.replace(/==([^=\n]+?)==/g, (_, inner) => hold(`<mark>${inlineMarkdownSegmentToHtmlRaw(inner)}</mark>`));
  text = text.replace(/__([^_\n]+?)__/g, (_, inner) => hold(`<u>${inlineMarkdownSegmentToHtmlRaw(inner)}</u>`));
  text = text.replace(/~~([^~\n]+?)~~/g, (_, inner) => hold(`<s>${inlineMarkdownSegmentToHtmlRaw(inner)}</s>`));
  text = text.replace(/(^|[^\w*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?=[^\w*]|$)/g, (_, pre, inner) => {
    return `${pre}${hold(`<em>${inner}</em>`)}`;
  });

  // Restaurar tokens desde afuera/adentro
  let prev;
  do {
    prev = text;
    text = text.replace(/\uE070(\d+)\uE071/g, (_, tIdx) => tokens[Number(tIdx)] || "");
  } while (text !== prev);

  return text;
}

function inlineMarkdownSegmentToHtmlRaw(rawInnerEscaped) {
  let inner = rawInnerEscaped;
  inner = inner.replace(/==([^=\n]+?)==/g, "<mark>$1</mark>");
  inner = inner.replace(/__([^_\n]+?)__/g, "<u>$1</u>");
  inner = inner.replace(/~~([^~\n]+?)~~/g, "<s>$1</s>");
  inner = inner.replace(/(^|[^\w*])\*([^\s*](?:[^*\n]*?[^\s*])?)\*(?=[^\w*]|$)/g, "$1<em>$2</em>");
  return inner;
}

function markdownInlineToHtml(text) {
  const segs = splitMathSegments(String(text || ""));
  if (!segs.length) return "";
  return segs
    .map((seg) => {
      if (seg.type === "math") {
        const clean = cleanLatexContent(seg.latex);
        return seg.display ? `$$${escapeHtml(clean)}$$` : `$${escapeHtml(clean)}$`;
      }
      return inlineMarkdownSegmentToHtml(seg.text);
    })
    .join("");
}

function parseTableCells(line) {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1);
  const values = [];
  let cell = "";
  let escaped = false;
  let code = false;
  for (const ch of text) {
    if (escaped) {
      cell += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "`") code = !code;
    if (ch === "|" && !code) {
      values.push(cell.trim());
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (escaped) cell += "\\";
  values.push(cell.trim());
  return values;
}

function hasMarkdownLink(text) {
  let idx = text.indexOf("[");
  while (idx !== -1) {
    if (matchMarkdownLinkAt(text, idx)) return true;
    idx = text.indexOf("[", idx + 1);
  }
  return false;
}

function hasMarkdownOrMathSignal(text) {
  if (hasMathSyntax(text)) return true;
  if (/(?:^|\n)\s*(?:\$\$|\\\[)/.test(text)) return true;
  if (/(?:^|\n)\s*#{1,6}\s+\S/.test(text)) return true;
  if (/\*\*[^*\n]+\*\*|==[^=\n]+==|~~[^~\n]+~~|__[^_\n]+__/.test(text)) return true;
  if (/(?:^|\n)\s*(?:[-*•]\s+\S|\d{1,4}\.\s+\S|>\s+\S|---+$)/.test(text)) return true;
  if (hasMarkdownLink(text)) return true;
  const lines = text.split("\n");
  if (lines.some((line) => isStandaloneRawLatexLine(line) || isStandaloneUnicodeMathLine(line))) {
    return true;
  }
  return false;
}

/**
 * Convierte texto plano de chats de IA (Markdown + LaTeX + bloques multilínea +
 * ecuaciones Unicode copiadas de renders) a HTML seguro para TipTap.
 * Devuelve `null` si el texto es prosa simple sin formato ni fórmulas.
 */
export function markdownClipboardToHtml(plain) {
  if (plain == null) return null;
  let text = String(plain).replace(/\r\n?/g, "\n");
  if (!text.trim()) return null;

  const fenced = /^```(?:markdown|md|latex|tex)?\s*\n([\s\S]*?)\n```$/.exec(text.trim());
  if (fenced) {
    text = fenced[1];
  }

  if (!hasMarkdownOrMathSignal(text)) return null;

  const lines = text.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 1. Bloque display math $$...$$ o \[...\] (una o múltiples líneas).
    const single = matchMathAt(trimmed, 0);
    if (single && single.display && single.end === trimmed.length) {
      out.push(`<p>$$${escapeHtml(cleanLatexContent(single.latex))}$$</p>`);
      i += 1;
      continue;
    }
    if ((trimmed.startsWith("$$") || trimmed.startsWith("\\[")) && !single) {
      let closeIdx = -1;
      let matched = null;
      for (let j = i + 1; j < lines.length; j += 1) {
        const combined = lines
          .slice(i, j + 1)
          .join("\n")
          .trim();
        const cand = matchMathAt(combined, 0);
        if (cand && cand.display && cand.end === combined.length) {
          closeIdx = j;
          matched = cand;
          break;
        }
      }
      if (closeIdx !== -1 && matched) {
        out.push(`<p>$$${escapeHtml(cleanLatexContent(matched.latex))}$$</p>`);
        i = closeIdx + 1;
        continue;
      }
    }

    // 2. Línea LaTeX cruda sin delimitadores (ej. pegado plain text desde KaTeX) + posible duplicado visual.
    if (isStandaloneRawLatexLine(trimmed)) {
      const cleanedLatex = cleanLatexContent(trimmed);
      out.push(`<p>$$${escapeHtml(cleanedLatex)}$$</p>`);
      let nextIdx = i + 1;
      while (nextIdx < lines.length && !lines[nextIdx].trim()) nextIdx += 1;
      if (nextIdx < lines.length && isLikelyKatexDuplicateLine(cleanedLatex, lines[nextIdx])) {
        i = nextIdx + 1;
        continue;
      }
      i += 1;
      continue;
    }

    // 3. Ecuación Unicode independiente (ej. V = c(1+i)⁻¹ + c(1+i)⁻² + ⋯ + c(1+i)⁻ⁿ).
    if (isStandaloneUnicodeMathLine(trimmed)) {
      out.push(`<p>$$${escapeHtml(convertUnicodeMathLineToLatex(trimmed))}$$</p>`);
      i += 1;
      continue;
    }

    // 4. Tabla Markdown pipe.
    if (i + 1 < lines.length && trimmed.includes("|")) {
      const sep = parseTableCells(lines[i + 1]);
      const head = parseTableCells(trimmed);
      if (
        head.length >= 2 &&
        sep.length === head.length &&
        sep.every((cell) => /^:?-{3,}:?$/.test(cell))
      ) {
        const rows = [head];
        let j = i + 2;
        while (j < lines.length && lines[j].trim().includes("|")) {
          const row = parseTableCells(lines[j]);
          if (row.length !== head.length) break;
          rows.push(row);
          j += 1;
        }
        const tableHtml = rows
          .map((row, rIdx) => {
            const tag = rIdx === 0 ? "th" : "td";
            return `<tr>${row.map((cell) => `<${tag}><p>${markdownInlineToHtml(cell)}</p></${tag}>`).join("")}</tr>`;
          })
          .join("");
        out.push(`<table><tbody>${tableHtml}</tbody></table>`);
        i = j;
        continue;
      }
    }

    // 5. Divisor horizontal.
    if (/^(?:---+|___+|\*\*\*+)$/.test(trimmed)) {
      out.push("<hr>");
      i += 1;
      continue;
    }

    // 6. Títulos Markdown (# .. ###### -> h1..h3).
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length);
      out.push(`<h${level}>${markdownInlineToHtml(headingMatch[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    // 7. Citas (> texto).
    if (/^>\s*/.test(trimmed)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s*/.test(lines[i].trim())) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ""));
        i += 1;
      }
      out.push(
        `<blockquote>${quoteLines.map((ql) => `<p>${markdownInlineToHtml(ql)}</p>`).join("")}</blockquote>`
      );
      continue;
    }

    // 8. Listas con viñetas (- / * / •).
    if (/^[-*•]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li><p>${markdownInlineToHtml(it)}</p></li>`).join("")}</ul>`);
      continue;
    }

    // 9. Listas numeradas (N. texto).
    const olMatch = /^(\d{1,4})\.\s+(.+)$/.exec(trimmed);
    if (olMatch) {
      const start = Number(olMatch[1]);
      const items = [];
      let expected = start;
      while (i < lines.length) {
        const m = /^(\d{1,4})\.\s+(.+)$/.exec(lines[i].trim());
        if (!m || (items.length > 0 && Number(m[1]) !== expected)) break;
        items.push(m[2]);
        expected += 1;
        i += 1;
      }
      const startAttr = start !== 1 ? ` start="${start}"` : "";
      out.push(`<ol${startAttr}>${items.map((it) => `<li><p>${markdownInlineToHtml(it)}</p></li>`).join("")}</ol>`);
      continue;
    }

    // 10. Párrafo con posible inline Markdown / LaTeX.
    // Si una línea contiene $$...$$ en medio de texto, convertirla en párrafos limpios.
    const segs = splitMathSegments(trimmed);
    const hasInlineDisplay = segs.some((s) => s.type === "math" && s.display);
    if (hasInlineDisplay) {
      let buffer = "";
      const flushText = () => {
        const part = buffer.trim();
        if (part) out.push(`<p>${inlineMarkdownSegmentToHtml(part)}</p>`);
        buffer = "";
      };
      for (const seg of segs) {
        if (seg.type === "math" && seg.display) {
          flushText();
          out.push(`<p>$$${escapeHtml(cleanLatexContent(seg.latex))}$$</p>`);
        } else if (seg.type === "math") {
          buffer += `$${cleanLatexContent(seg.latex)}$`;
        } else {
          buffer += seg.text;
        }
      }
      flushText();
    } else {
      out.push(`<p>${markdownInlineToHtml(trimmed)}</p>`);
    }
    i += 1;
  }

  return out.length ? out.join("") : null;
}

const MATH_OR_SEMANTIC_HTML_RE =
  /(?:data-(?:math|latex|tex|equation|link-url)\b|\bkatex(?:-display|-mathml)?\b|\bmath-(?:block|inline|display)\b|\bmwe-math-element\b|\b(?:ac|nf)-math-(?:block|inline)\b|<mjx-container\b|<math[\s>]|type\s*=\s*["']math\/tex|<(?:strong|em|u|s|del|mark|a|h[1-6]|ul|ol|li|table|blockquote|details)\b)/i;

function isPlainTextOnlyHtml(html, plain) {
  if (!html) return false;
  if (MATH_OR_SEMANTIC_HTML_RE.test(html)) return false;
  if (/<img\b/i.test(html)) return false;
  if (typeof DOMParser === "undefined") {
    return /<(?:b)\b/i.test(html);
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Google Docs <b style="font-weight:normal"> tampoco es negrita real.
  const hasRealBold = Array.from(doc?.body?.querySelectorAll("b") || []).some((b) => {
    const fw = (b.style?.fontWeight || "").toLowerCase().trim();
    return fw !== "normal" && fw !== "400" && fw !== "300";
  });
  return !hasRealBold && Boolean(plain && plain.trim());
}

function isSingleAnchorForSameUrl(html, plainTrimmed) {
  if (!html || !plainTrimmed || typeof DOMParser === "undefined") return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const anchors = Array.from(doc?.body?.querySelectorAll("a[href]") || []);
  if (anchors.length !== 1) return false;
  const bodyText = (doc.body.textContent || "").trim();
  const anchorText = (anchors[0].textContent || "").trim();
  const href = sanitizeLinkUrl(anchors[0].getAttribute("href"));
  return Boolean(href && bodyText === plainTrimmed && anchorText === plainTrimmed);
}

function htmlHasVisibleTextOrMath(html) {
  if (!html) return false;
  if (MATH_OR_SEMANTIC_HTML_RE.test(html)) return true;
  if (typeof DOMParser === "undefined") return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Boolean(doc?.body?.textContent?.trim());
}

/**
 * Decide la mejor representación para pegar clipboardData en TipTap:
 *  - { kind: "image", file } para imágenes / capturas puras
 *  - { kind: "url", url } para URLs independientes (auto-enlace sobre selección o popover)
 *  - { kind: "html", html } para fórmulas LaTeX/MathML/HTML/Markdown rico
 *  - null para delegar al comportamiento nativo
 */
export function clipboardToEditorHtml(clipboardData) {
  if (!clipboardData) return null;

  const html = typeof clipboardData.getData === "function" ? clipboardData.getData("text/html") || "" : "";
  const plain = typeof clipboardData.getData === "function" ? clipboardData.getData("text/plain") || "" : "";

  const items = clipboardData.items ? Array.from(clipboardData.items) : [];
  for (const item of items) {
    if (item && item.type && item.type.startsWith("image/")) {
      const file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      if (file && !plain.trim() && !htmlHasVisibleTextOrMath(html)) {
        return { kind: "image", file };
      }
    }
  }

  const trimmedPlain = plain.trim();
  if (
    trimmedPlain &&
    isStandaloneUrl(trimmedPlain) &&
    (!html || isPlainTextOnlyHtml(html, plain) || isSingleAnchorForSameUrl(html, trimmedPlain))
  ) {
    const safe = sanitizeLinkUrl(trimmedPlain);
    if (safe) return { kind: "url", url: safe };
  }

  if (html && !isPlainTextOnlyHtml(html, plain)) {
    const hasRichSignal =
      MATH_OR_SEMANTIC_HTML_RE.test(html) ||
      /<b\b/i.test(html) ||
      hasMathSyntax(plain);
    if (hasRichSignal) {
      const normalized = normalizeClipboardHtml(html);
      if (normalized) return { kind: "html", html: normalized };
    }
  }

  if (trimmedPlain) {
    const mdHtml = markdownClipboardToHtml(plain);
    if (mdHtml) return { kind: "html", html: mdHtml };
  }

  return null;
}

export function endsWithDisplayMathParagraph(html) {
  return /<p>\s*(?:\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])\s*<\/p>\s*$/i.test(String(html || ""));
}
