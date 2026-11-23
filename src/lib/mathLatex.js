// Parser y scanner de expresiones matemáticas LaTeX en JS puro.
// Sin dependencias nativas ni DOM: sirve para RichText (nativo y web),
// richtext.js (protección de marcas) y editorSetup.js (Live Preview).

const GREEK_MAP = {
  alpha: "α",
  beta: "β",
  gamma: "γ",
  delta: "δ",
  epsilon: "ϵ",
  varepsilon: "ε",
  zeta: "ζ",
  eta: "η",
  theta: "θ",
  vartheta: "ϑ",
  iota: "ι",
  kappa: "κ",
  lambda: "λ",
  mu: "μ",
  nu: "ν",
  xi: "ξ",
  pi: "π",
  varpi: "ϖ",
  rho: "ρ",
  varrho: "ϱ",
  sigma: "σ",
  varsigma: "ς",
  tau: "τ",
  upsilon: "υ",
  phi: "ϕ",
  varphi: "φ",
  chi: "χ",
  psi: "ψ",
  omega: "ω",
  Gamma: "Γ",
  Delta: "Δ",
  Theta: "Θ",
  Lambda: "Λ",
  Xi: "Ξ",
  Pi: "Π",
  Sigma: "Σ",
  Upsilon: "Υ",
  Phi: "Φ",
  Psi: "Ψ",
  Omega: "Ω",
};

const SYMBOL_MAP = {
  ...GREEK_MAP,
  // Flechas
  implies: "⟹",
  impliedby: "⟸",
  iff: "⟺",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  leftrightarrow: "↔",
  mapsto: "↦",
  Rightarrow: "⇒",
  Leftarrow: "⇐",
  Leftrightarrow: "⇔",
  longrightarrow: "⟶",
  longleftarrow: "⟵",
  // Puntos
  cdots: "⋯",
  ldots: "…",
  dots: "…",
  vdots: "⋮",
  ddots: "⋱",
  // Relaciones y lógica
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  neq: "≠",
  ne: "≠",
  approx: "≈",
  equiv: "≡",
  sim: "∼",
  simeq: "≃",
  cong: "≅",
  propto: "∝",
  in: "∈",
  notin: "∉",
  ni: "∋",
  subset: "⊂",
  subseteq: "⊆",
  supset: "⊃",
  supseteq: "⊇",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  varnothing: "∅",
  forall: "∀",
  exists: "∃",
  nexists: "∄",
  neg: "¬",
  lnot: "¬",
  land: "∧",
  lor: "∨",
  wedge: "∧",
  vee: "∨",
  // Operadores y símbolos
  cdot: "·",
  times: "×",
  div: "÷",
  pm: "±",
  mp: "∓",
  ast: "∗",
  star: "⋆",
  circ: "∘",
  bullet: "•",
  oplus: "⊕",
  otimes: "⊗",
  infty: "∞",
  partial: "∂",
  nabla: "∇",
  angle: "∠",
  perp: "⊥",
  parallel: "∥",
  prime: "′",
  degree: "°",
  ell: "ℓ",
  hbar: "ℏ",
  Re: "ℜ",
  Im: "ℑ",
  aleph: "ℵ",
  // Delimitadores
  langle: "⟨",
  rangle: "⟩",
  lceil: "⌈",
  rceil: "⌉",
  lfloor: "⌊",
  rfloor: "⌋",
  lvert: "|",
  rvert: "|",
  lVert: "‖",
  rVert: "‖",
  // Escapes literales
  "%": "%",
  $: "$",
  "&": "&",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
};

const BLACKBOARD_MAP = {
  R: "ℝ",
  N: "ℕ",
  Z: "ℤ",
  Q: "ℚ",
  C: "ℂ",
  E: "𝔼",
  P: "ℙ",
};

const BIG_OPS = {
  sum: "∑",
  prod: "∏",
  coprod: "∐",
  int: "∫",
  iint: "∬",
  iiint: "∭",
  oint: "∮",
  bigcup: "⋃",
  bigcap: "⋂",
  bigoplus: "⨁",
  bigotimes: "⨂",
  lim: "lim",
  limsup: "lim sup",
  liminf: "lim inf",
  max: "max",
  min: "min",
  sup: "sup",
  inf: "inf",
  argmax: "arg max",
  argmin: "arg min",
};

const FUNCTIONS = new Set([
  "log",
  "ln",
  "lg",
  "exp",
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "arcsin",
  "arccos",
  "arctan",
  "sinh",
  "cosh",
  "tanh",
  "det",
  "dim",
  "ker",
  "deg",
  "gcd",
  "hom",
  "arg",
  "Pr",
  "mod",
  "bmod",
  "pmod",
]);

const ACCENTS = new Set([
  "bar",
  "overline",
  "underline",
  "hat",
  "widehat",
  "tilde",
  "widetilde",
  "vec",
  "dot",
  "ddot",
]);

const SPACE_WIDTHS = {
  ",": 0.17,
  ":": 0.22,
  ";": 0.28,
  "!": -0.05,
  " ": 0.3,
  quad: 1,
  qquad: 2,
  enspace: 0.5,
  thinspace: 0.17,
};

const TEXT_COMMANDS = new Set(["text", "textrm", "textup", "textnormal", "mbox", "mathrm", "operatorname"]);
const BOLD_COMMANDS = new Set(["mathbf", "textbf", "boldsymbol", "bm"]);

const isAsciiWordChar = (ch) => Boolean(ch && /[0-9A-Za-zÀ-ÿ]/.test(ch));

function isEscapedAt(text, index) {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

function isLikelyCurrencyOrProse(inner, nextAfterClose) {
  if (!inner || !inner.trim()) return true;
  if (isAsciiWordChar(nextAfterClose)) return true;
  if (/^\s|\s$/.test(inner)) return true;
  // Montos numéricos con palabras en prosa sin operadores matemáticos (ej: "$50 por mes").
  if (/^\d/.test(inner)) {
    const hasMathCue = /[\\^_=+\-*/<>|(){}[\]]/.test(inner);
    if (!hasMathCue && /\s+[A-Za-zÀ-ÿ]{2,}/.test(inner)) return true;
    // Ej. "$1.500" o "$100,50" sin operadores ni exponentes nunca llega acá sin un cierre,
    // pero si hubiese otro "$" en la línea como "$100,00 y $", el espacio previo ya falla.
    if (!hasMathCue && /\s/.test(inner)) return true;
  }
  return false;
}

/**
 * Intenta reconocer una expresión LaTeX ($...$, $$...$$, \(...\), \[...\])
 * exactamente en `start`. Devuelve { end, raw, latex, display } o null.
 */
export function matchMathAt(text, start) {
  if (!text || start < 0 || start >= text.length) return null;
  if (isEscapedAt(text, start)) return null;

  // 1. Display: $$...$$
  if (text.startsWith("$$", start)) {
    let cursor = start + 2;
    while (cursor < text.length) {
      const close = text.indexOf("$$", cursor);
      if (close === -1) return null;
      if (!isEscapedAt(text, close)) {
        const latex = text.slice(start + 2, close);
        if (latex.trim()) {
          return {
            end: close + 2,
            raw: text.slice(start, close + 2),
            latex: latex.trim(),
            display: true,
          };
        }
        return null;
      }
      cursor = close + 2;
    }
    return null;
  }

  // 2. Display: \[...\]
  if (text.startsWith("\\[", start)) {
    let cursor = start + 2;
    while (cursor < text.length) {
      const close = text.indexOf("\\]", cursor);
      if (close === -1) return null;
      if (!isEscapedAt(text, close)) {
        const latex = text.slice(start + 2, close);
        if (latex.trim()) {
          return {
            end: close + 2,
            raw: text.slice(start, close + 2),
            latex: latex.trim(),
            display: true,
          };
        }
        return null;
      }
      cursor = close + 2;
    }
    return null;
  }

  // 3. Inline: \(...\)
  if (text.startsWith("\\(", start)) {
    let cursor = start + 2;
    while (cursor < text.length) {
      const close = text.indexOf("\\)", cursor);
      if (close === -1) return null;
      if (!isEscapedAt(text, close)) {
        const latex = text.slice(start + 2, close);
        if (latex.includes("\n\n") || !latex.trim()) return null;
        return {
          end: close + 2,
          raw: text.slice(start, close + 2),
          latex: latex.trim(),
          display: false,
        };
      }
      cursor = close + 2;
    }
    return null;
  }

  // 4. Inline: $...$
  if (text[start] === "$") {
    const prev = start > 0 ? text[start - 1] : "";
    const next = text[start + 1] || "";
    if (isAsciiWordChar(prev)) return null;
    if (!next || next === "$" || /\s/.test(next)) return null;

    let cursor = start + 1;
    while (cursor < text.length) {
      const ch = text[cursor];
      if (ch === "\n") return null;
      if (ch === "$" && !isEscapedAt(text, cursor)) {
        if (text[cursor + 1] === "$") return null;
        const inner = text.slice(start + 1, cursor);
        const afterClose = text[cursor + 1] || "";
        if (isLikelyCurrencyOrProse(inner, afterClose)) return null;
        return {
          end: cursor + 1,
          raw: text.slice(start, cursor + 1),
          latex: inner.trim(),
          display: false,
        };
      }
      cursor += 1;
    }
  }

  return null;
}

/**
 * Divide un texto en segmentos { type: "text" | "math", ... } con índices exactos.
 */
export function splitMathSegments(text) {
  const input = text == null ? "" : String(text);
  if (!input) return [];
  const out = [];
  let textStart = 0;
  let i = 0;

  while (i < input.length) {
    if (input[i] === "$" || (input[i] === "\\" && (input[i + 1] === "(" || input[i + 1] === "["))) {
      const matched = matchMathAt(input, i);
      if (matched) {
        if (i > textStart) {
          out.push({
            type: "text",
            text: input.slice(textStart, i),
            from: textStart,
            to: i,
          });
        }
        out.push({
          type: "math",
          raw: matched.raw,
          latex: matched.latex,
          display: matched.display,
          from: i,
          to: matched.end,
        });
        i = matched.end;
        textStart = i;
        continue;
      }
    }
    i += 1;
  }

  if (textStart < input.length) {
    out.push({
      type: "text",
      text: input.slice(textStart),
      from: textStart,
      to: input.length,
    });
  }

  return out;
}

export function hasMathSyntax(text) {
  return splitMathSegments(text).some((seg) => seg.type === "math");
}

// ---------------------------------------------------------------------------
// Parser LaTeX -> AST para el renderer nativo (React Native + SVG)

function skipWhitespace(src, pos) {
  let i = pos;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  return i;
}

function readBalancedGroup(src, pos, openChar = "{", closeChar = "}") {
  if (src[pos] !== openChar) return null;
  let depth = 0;
  let i = pos;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && i + 1 < src.length) {
      i += 2;
      continue;
    }
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return { content: src.slice(pos + 1, i), next: i + 1 };
      }
    }
    i += 1;
  }
  return { content: src.slice(pos + 1), next: src.length };
}

function readCommandName(src, pos) {
  if (src[pos] !== "\\") return null;
  if (pos + 1 >= src.length) return { name: "", next: pos + 1 };
  const nextChar = src[pos + 1];
  if (!/[A-Za-z]/.test(nextChar)) {
    return { name: nextChar, next: pos + 2 };
  }
  let i = pos + 1;
  while (i < src.length && /[A-Za-z]/.test(src[i])) i += 1;
  return { name: src.slice(pos + 1, i), next: i };
}

function readArg(src, pos) {
  const i = skipWhitespace(src, pos);
  if (i >= src.length) return { node: { type: "group", items: [] }, next: i };
  if (src[i] === "{") {
    const grp = readBalancedGroup(src, i, "{", "}");
    return { node: parseLatex(grp.content), next: grp.next };
  }
  const atom = parseAtom(src, i);
  return atom;
}

function readOptionalBracketArg(src, pos) {
  const i = skipWhitespace(src, pos);
  if (src[i] !== "[") return null;
  const grp = readBalancedGroup(src, i, "[", "]");
  if (!grp) return null;
  return { node: parseLatex(grp.content), next: grp.next };
}

function parseMatrixBody(body, env) {
  const rows = [];
  let currentRow = [];
  let cellStart = 0;
  let braceDepth = 0;
  let i = 0;

  const pushCell = (end) => {
    currentRow.push(parseLatex(body.slice(cellStart, end)));
  };

  while (i < body.length) {
    const ch = body[i];
    if (ch === "{") {
      braceDepth += 1;
      i += 1;
      continue;
    }
    if (ch === "}") {
      braceDepth = Math.max(0, braceDepth - 1);
      i += 1;
      continue;
    }
    if (braceDepth === 0) {
      if (ch === "&") {
        pushCell(i);
        cellStart = i + 1;
        i += 1;
        continue;
      }
      if (body.startsWith("\\\\", i)) {
        pushCell(i);
        rows.push(currentRow);
        currentRow = [];
        i += 2;
        if (body[i] === "[") {
          const skip = readBalancedGroup(body, i, "[", "]");
          if (skip) i = skip.next;
        }
        cellStart = i;
        continue;
      }
    }
    if (ch === "\\" && i + 1 < body.length) {
      i += 2;
      continue;
    }
    i += 1;
  }

  const tail = body.slice(cellStart);
  if (tail.trim() || currentRow.length > 0) {
    currentRow.push(parseLatex(tail));
    rows.push(currentRow);
  }

  return { type: "matrix", env, rows };
}

function findMatchingEnd(src, start, envName) {
  const beginTag = `\\begin{${envName}}`;
  const endTag = `\\end{${envName}}`;
  let depth = 1;
  let i = start;
  while (i < src.length) {
    if (src.startsWith(beginTag, i)) {
      depth += 1;
      i += beginTag.length;
      continue;
    }
    if (src.startsWith(endTag, i)) {
      depth -= 1;
      if (depth === 0) {
        return { content: src.slice(start, i), next: i + endTag.length };
      }
      i += endTag.length;
      continue;
    }
    i += 1;
  }
  return { content: src.slice(start), next: src.length };
}

function findMatchingRight(src, start) {
  let depth = 1;
  let i = start;
  while (i < src.length) {
    if (src.startsWith("\\left", i) && !/[A-Za-z]/.test(src[i + 5] || "")) {
      depth += 1;
      i += 5;
      continue;
    }
    if (src.startsWith("\\right", i) && !/[A-Za-z]/.test(src[i + 6] || "")) {
      depth -= 1;
      if (depth === 0) {
        let j = skipWhitespace(src, i + 6);
        let rightDelim = "";
        if (src[j] === "\\") {
          const cmd = readCommandName(src, j);
          rightDelim = SYMBOL_MAP[cmd.name] || cmd.name;
          j = cmd.next;
        } else if (j < src.length) {
          rightDelim = src[j];
          j += 1;
        }
        if (rightDelim === ".") rightDelim = "";
        return { content: src.slice(start, i), rightDelim, next: j };
      }
      i += 6;
      continue;
    }
    i += 1;
  }
  return { content: src.slice(start), rightDelim: "", next: src.length };
}

function parseAtom(src, pos) {
  const i = skipWhitespace(src, pos);
  if (i >= src.length) return { node: { type: "group", items: [] }, next: i };

  const ch = src[i];
  if (ch === "{") {
    const grp = readBalancedGroup(src, i, "{", "}");
    return { node: parseLatex(grp.content), next: grp.next };
  }

  if (ch !== "\\") {
    if (/[A-Za-z]/.test(ch)) {
      return { node: { type: "symbol", value: ch, italic: true }, next: i + 1 };
    }
    if (/[0-9]/.test(ch)) {
      let end = i + 1;
      while (end < src.length && /[0-9.,]/.test(src[end]) && !(src[end] === "," && !/[0-9]/.test(src[end + 1] || ""))) {
        end += 1;
      }
      return { node: { type: "symbol", value: src.slice(i, end), italic: false }, next: end };
    }
    const mapped = ch === "-" ? "−" : ch;
    const isOp = "+−=<>~".includes(mapped);
    return {
      node: { type: "symbol", value: mapped, italic: false, operator: isOp },
      next: i + 1,
    };
  }

  const cmd = readCommandName(src, i);
  const name = cmd.name;
  let next = cmd.next;

  if (name === "left") {
    let j = skipWhitespace(src, next);
    let leftDelim = "";
    if (src[j] === "\\") {
      const dCmd = readCommandName(src, j);
      leftDelim = SYMBOL_MAP[dCmd.name] || dCmd.name;
      j = dCmd.next;
    } else if (j < src.length) {
      leftDelim = src[j];
      j += 1;
    }
    if (leftDelim === ".") leftDelim = "";
    const inside = findMatchingRight(src, j);
    return {
      node: {
        type: "delim",
        left: leftDelim,
        right: inside.rightDelim,
        body: parseLatex(inside.content),
      },
      next: inside.next,
    };
  }

  if (name === "begin") {
    const j = skipWhitespace(src, next);
    const envGrp = src[j] === "{" ? readBalancedGroup(src, j, "{", "}") : null;
    if (envGrp) {
      const env = envGrp.content.trim();
      const bodyInfo = findMatchingEnd(src, envGrp.next, env);
      return {
        node: parseMatrixBody(bodyInfo.content, env),
        next: bodyInfo.next,
      };
    }
  }

  if (name === "frac" || name === "dfrac" || name === "tfrac" || name === "cfrac") {
    const num = readArg(src, next);
    const den = readArg(src, num.next);
    return {
      node: { type: "frac", num: num.node, den: den.node },
      next: den.next,
    };
  }

  if (name === "binom" || name === "dbinom" || name === "tbinom") {
    const num = readArg(src, next);
    const den = readArg(src, num.next);
    return {
      node: { type: "binom", num: num.node, den: den.node },
      next: den.next,
    };
  }

  if (name === "sqrt") {
    const rootIdx = readOptionalBracketArg(src, next);
    const arg = readArg(src, rootIdx ? rootIdx.next : next);
    return {
      node: { type: "sqrt", index: rootIdx ? rootIdx.node : null, body: arg.node },
      next: arg.next,
    };
  }

  if (ACCENTS.has(name)) {
    const arg = readArg(src, next);
    return {
      node: { type: "accent", accent: name, body: arg.node },
      next: arg.next,
    };
  }

  if (TEXT_COMMANDS.has(name)) {
    const argPos = skipWhitespace(src, next);
    if (src[argPos] === "{") {
      const grp = readBalancedGroup(src, argPos, "{", "}");
      return { node: { type: "text", value: grp.content, bold: false }, next: grp.next };
    }
  }

  if (BOLD_COMMANDS.has(name)) {
    const arg = readArg(src, next);
    return { node: { type: "styled", style: "bold", body: arg.node }, next: arg.next };
  }

  if (name === "mathbb") {
    const argPos = skipWhitespace(src, next);
    if (src[argPos] === "{") {
      const grp = readBalancedGroup(src, argPos, "{", "}");
      const mapped = grp.content
        .split("")
        .map((c) => BLACKBOARD_MAP[c] || c)
        .join("");
      return { node: { type: "text", value: mapped, bold: false }, next: grp.next };
    }
  }

  if (name === "mathcal" || name === "mathit") {
    const arg = readArg(src, next);
    return { node: { type: "styled", style: "italic", body: arg.node }, next: arg.next };
  }

  if (Object.prototype.hasOwnProperty.call(SPACE_WIDTHS, name)) {
    return { node: { type: "space", em: SPACE_WIDTHS[name] }, next };
  }

  if (Object.prototype.hasOwnProperty.call(BIG_OPS, name)) {
    return { node: { type: "bigop", op: name, symbol: BIG_OPS[name] }, next };
  }

  if (FUNCTIONS.has(name)) {
    return { node: { type: "text", value: name, bold: false }, next };
  }

  if (Object.prototype.hasOwnProperty.call(SYMBOL_MAP, name)) {
    const value = SYMBOL_MAP[name];
    const isGreekLower = Boolean(GREEK_MAP[name] && /^[a-z]/.test(name));
    return { node: { type: "symbol", value, italic: isGreekLower }, next };
  }

  // Ignorar comandos puramente tipográficos sin argumento o desconocidos con degradación limpia
  if (["limits", "nolimits", "displaystyle", "textstyle", "scriptstyle", "rm", "bf", "it"].includes(name)) {
    return { node: { type: "space", em: 0 }, next };
  }

  return {
    node: { type: "text", value: name ? `\\${name}` : "\\", bold: false },
    next,
  };
}

/**
 * Parsea un string LaTeX a un AST de nodos estructurados. Nunca lanza excepción.
 */
export function parseLatex(source) {
  const src = source == null ? "" : String(source).trim();
  if (!src) return { type: "group", items: [] };

  const items = [];
  let i = 0;

  while (i < src.length) {
    i = skipWhitespace(src, i);
    if (i >= src.length) break;

    if (src[i] === "_" || src[i] === "^") {
      // Script sin base previa (ej. en inicio de expresión o tras espacio)
      const base = items.length > 0 ? items.pop() : { type: "text", value: "", bold: false };
      let sub = base.type === "script" ? base.sub : null;
      let sup = base.type === "script" ? base.sup : null;
      const actualBase = base.type === "script" ? base.base : base;

      while (i < src.length) {
        const j = skipWhitespace(src, i);
        if (src[j] === "_" && !sub) {
          const arg = readArg(src, j + 1);
          sub = arg.node;
          i = arg.next;
        } else if (src[j] === "^" && !sup) {
          const arg = readArg(src, j + 1);
          sup = arg.node;
          i = arg.next;
        } else {
          break;
        }
      }

      items.push({ type: "script", base: actualBase, sub, sup });
      continue;
    }

    const atom = parseAtom(src, i);
    let node = atom.node;
    i = atom.next;

    // Adjuntar subíndice y/o superíndice inmediatamente posteriores
    let sub = null;
    let sup = null;
    while (i < src.length) {
      const j = skipWhitespace(src, i);
      if (src[j] === "_" && !sub) {
        const arg = readArg(src, j + 1);
        sub = arg.node;
        i = arg.next;
      } else if (src[j] === "^" && !sup) {
        const arg = readArg(src, j + 1);
        sup = arg.node;
        i = arg.next;
      } else {
        break;
      }
    }

    if (sub || sup) {
      node = { type: "script", base: node, sub, sup };
    }
    if (node.type !== "space" || node.em !== 0) {
      items.push(node);
    }
  }

  return { type: "group", items };
}
