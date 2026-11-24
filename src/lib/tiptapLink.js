import { Mark, Node, mergeAttributes } from "@tiptap/core";

import { linkDisplayTitle, linkDomain, linkPlatformInfo, openExternalLink, sanitizeLinkUrl } from "./richLink";

export const WebLink = Mark.create({
  name: "webLink",
  priority: 1000,
  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => sanitizeLinkUrl(element.getAttribute("href")),
        renderHTML: (attrs) => (attrs.href ? { href: sanitizeLinkUrl(attrs.href) || "" } : {}),
      },
      display: {
        default: "inline",
        parseHTML: (element) => (element.getAttribute("data-link-display") === "mention" ? "mention" : "inline"),
        renderHTML: (attrs) => ({
          "data-link-display": attrs.display === "mention" ? "mention" : "inline",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[href]",
        getAttrs: (element) => {
          const href = sanitizeLinkUrl(element.getAttribute("href"));
          if (!href) return false;
          return {
            href,
            display: element.getAttribute("data-link-display") === "mention" ? "mention" : "inline",
          };
        },
      },
    ];
  },

  renderHTML({ mark, HTMLAttributes }) {
    const attrs = mark?.attrs || {};
    const href = sanitizeLinkUrl(attrs.href ?? HTMLAttributes.href) || "";
    const rawDisplay = attrs.display ?? HTMLAttributes["data-link-display"];
    const display = rawDisplay === "mention" ? "mention" : "inline";
    const platform = linkPlatformInfo(href);
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href,
        "data-link-display": display,
        "data-link-platform": platform.id,
        "data-link-icon": platform.icon,
        class: `nf-link nf-link-${display}`,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      0,
    ];
  },
});

function buildLinkBlockContent(dom, attrs, { editable = true, onEdit = null } = {}) {
  const url = sanitizeLinkUrl(attrs.url) || String(attrs.url || "");
  const variant = attrs.variant === "card" ? "card" : "bookmark";
  const platform = linkPlatformInfo(url);
  const domain = linkDomain(url) || url;
  const titleText = linkDisplayTitle(url, attrs.title);
  const descText = String(attrs.description || "").trim();

  dom.className = `nf-link-block nf-link-block-${variant}`;
  dom.setAttribute("data-link-url", url);
  dom.setAttribute("data-link-title", attrs.title || "");
  dom.setAttribute("data-link-desc", descText);
  dom.setAttribute("data-link-variant", variant);
  dom.setAttribute("data-link-platform", platform.id);
  dom.contentEditable = "false";
  dom.replaceChildren();

  const stopEditEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "nf-link-block-edit";
  editBtn.textContent = "✎";
  editBtn.setAttribute("aria-label", "Editar enlace");
  editBtn.title = "Editar enlace";
  editBtn.hidden = !editable;
  editBtn.addEventListener("pointerdown", stopEditEvent);
  editBtn.addEventListener("mousedown", stopEditEvent);
  editBtn.addEventListener("click", (event) => {
    stopEditEvent(event);
    onEdit?.();
  });

  if (variant === "card") {
    const header = document.createElement("div");
    header.className = "nf-link-block-header";
    header.style.setProperty("--nf-link-accent", platform.accent);

    const badge = document.createElement("span");
    badge.className = "nf-link-block-badge";
    const iconEl = document.createElement("span");
    iconEl.className = "nf-link-block-icon";
    iconEl.textContent = platform.icon;
    const platEl = document.createElement("span");
    platEl.className = "nf-link-block-platform";
    platEl.textContent = platform.name;
    badge.append(iconEl, platEl);

    header.append(badge, editBtn);

    const body = document.createElement("div");
    body.className = "nf-link-block-body";

    const titleEl = document.createElement("div");
    titleEl.className = "nf-link-block-title";
    titleEl.textContent = titleText;
    body.appendChild(titleEl);

    if (descText) {
      const descEl = document.createElement("div");
      descEl.className = "nf-link-block-desc";
      descEl.textContent = descText;
      body.appendChild(descEl);
    }

    const urlEl = document.createElement("div");
    urlEl.className = "nf-link-block-meta";
    urlEl.textContent = domain;
    body.appendChild(urlEl);

    dom.append(header, body);
    return;
  }

  const left = document.createElement("div");
  left.className = "nf-link-block-body";

  const titleEl = document.createElement("div");
  titleEl.className = "nf-link-block-title";
  titleEl.textContent = titleText;
  left.appendChild(titleEl);

  if (descText) {
    const descEl = document.createElement("div");
    descEl.className = "nf-link-block-desc";
    descEl.textContent = descText;
    left.appendChild(descEl);
  }

  const meta = document.createElement("div");
  meta.className = "nf-link-block-meta";
  const iconEl = document.createElement("span");
  iconEl.className = "nf-link-block-icon";
  iconEl.style.color = platform.accent;
  iconEl.textContent = platform.icon;
  const domainEl = document.createElement("span");
  domainEl.textContent = domain;
  meta.append(iconEl, domainEl);
  left.appendChild(meta);

  dom.append(left, editBtn);
}

export const WebBookmark = Node.create({
  name: "webBookmark",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (element) => sanitizeLinkUrl(element.getAttribute("data-link-url")) || "",
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-link-title") || "",
      },
      description: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-link-desc") || "",
      },
      variant: {
        default: "bookmark",
        parseHTML: (element) => (element.getAttribute("data-link-variant") === "card" ? "card" : "bookmark"),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-link-url]",
        getAttrs: (element) => {
          const url = sanitizeLinkUrl(element.getAttribute("data-link-url"));
          if (!url) return false;
          return {
            url,
            title: element.getAttribute("data-link-title") || "",
            description: element.getAttribute("data-link-desc") || "",
            variant: element.getAttribute("data-link-variant") === "card" ? "card" : "bookmark",
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const { url, title, description, variant } = node.attrs;
    const safeUrl = sanitizeLinkUrl(url) || "";
    const safeVariant = variant === "card" ? "card" : "bookmark";
    return [
      "div",
      {
        class: `nf-link-block nf-link-block-${safeVariant}`,
        "data-link-url": safeUrl,
        "data-link-title": title || "",
        "data-link-desc": description || "",
        "data-link-variant": safeVariant,
      },
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      let currentNode = node;
      const dom = document.createElement("div");
      const triggerEdit = () => {
        if (!editor.isEditable) return;
        const pos = typeof getPos === "function" ? getPos() : null;
        if (typeof pos === "number") {
          dom
            .closest?.(".nf-root")
            ?.dispatchEvent(
              new CustomEvent("nf:edit-link-block", { bubbles: true, detail: { pos, node: currentNode, anchor: dom } })
            );
        }
      };
      buildLinkBlockContent(dom, currentNode.attrs, { editable: editor.isEditable, onEdit: triggerEdit });

      let downState = null;
      dom.addEventListener("pointerdown", (event) => {
        downState = { x: event.clientX, y: event.clientY, time: Date.now() };
      });
      dom.addEventListener("click", (event) => {
        if (event.target.closest?.(".nf-link-block-edit")) return;
        if (downState) {
          const moved = Math.hypot(event.clientX - downState.x, event.clientY - downState.y) > 6;
          const held = Date.now() - downState.time > 380;
          downState = null;
          if (moved || held) return;
        }
        event.preventDefault();
        event.stopPropagation();
        openExternalLink(currentNode.attrs.url, dom);
      });

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== "webBookmark") return false;
          currentNode = updatedNode;
          buildLinkBlockContent(dom, updatedNode.attrs, { editable: editor.isEditable, onEdit: triggerEdit });
          return true;
        },
        stopEvent(event) {
          return Boolean(event.target?.closest?.(".nf-link-block-edit"));
        },
      };
    };
  },
});
