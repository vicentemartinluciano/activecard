// La pastilla sigue el extremo activo de la selección, sin mover el documento.
// El foco y el cursor solos no muestran controles sobre la escritura.
import { positionEditorPanel } from "./editorGeometry";
import { NodeSelection } from "@tiptap/pm/state";
export function currentFormatLabel(editor) {
  if (editor.isActive("heading")) return `Título ${editor.getAttributes("heading").level}`;
  if (editor.isActive("blockquote")) return "Cita";
  if (editor.isActive("bulletList")) return "Viñetas";
  if (editor.isActive("orderedList")) return "Numerada";
  return "Texto";
}
export function hasToolbarSelection(editor) {
  const { selection } = editor.state;
  const blockSelected =
    selection instanceof NodeSelection &&
    ["paragraph", "heading", "bulletList", "orderedList", "blockquote"].includes(selection.node.type.name);
  return !selection.empty && (blockSelected || selection.$from.parent.isTextblock || editor.isActive("image"));
}

export function attachEditorToolbar(editor, host, bubble) {
  let frame = null;
  const dismiss = () => {
    host.classList.remove("nf-command", "nf-selection", "nf-inserting");
    bubble.hidden = true;
    bubble.querySelectorAll(".open").forEach((panel) => panel.classList.remove("open"));
    host.dispatchEvent(new Event("nf:close-menus"));
    host.dispatchEvent(new Event("nf:layout"));
  };
  const onBlur = () => {
    if (!host.classList.contains("nf-picking")) dismiss();
    schedule();
  };
  const onInput = () => {
    dismiss();
    schedule();
  };
  const onPointer = (event) => {
    if (!bubble.contains(event.target)) dismiss();
  };
  const onAction = (event) => {
    const label = event.target.closest("button")?.getAttribute("aria-label");
    if (["Color del texto", "Cambiar formato", "Insertar"].includes(label)) return;
    host.classList.remove("nf-command");
    host.dispatchEvent(new Event("nf:viewport"));
    schedule();
  };
  const beforeAction = (event) => {
    const button = event.target.closest('button,[role="button"]');
    if (!button || ["Color del texto", "Cambiar formato", "Insertar"].includes(button.getAttribute("aria-label")))
      return;
    host.dispatchEvent(new Event("nf:consume-command"));
  };
  const position = () => {
    frame = null;
    if (editor.isDestroyed || !host.isConnected) return;
    const formatLabel = bubble.querySelector(".nf-format-label");
    if (formatLabel) formatLabel.textContent = currentFormatLabel(editor);
    const selection = editor.state.selection;
    const selected = editor.isEditable && editor.isFocused && (hasToolbarSelection(editor) || selection.$from.parent.content.size === 0);
    host.classList.toggle("nf-selection", selected);
    bubble.hidden = !(
      (editor.isEditable && editor.isFocused && (selected || host.classList.contains("nf-command"))) ||
      host.classList.contains("nf-inserting") ||
      host.classList.contains("nf-picking")
    );
    if (host.classList.contains("nf-block-format") || host.classList.contains("nf-dragging")) bubble.hidden = true;
    if (getComputedStyle(bubble).display === "none") {
      host.dispatchEvent(new Event("nf:layout"));
      return;
    }
    const root = host.getBoundingClientRect();
    const cursor = editor.view.coordsAtPos(selection.head);
    const width = Math.min(host.classList.contains("nf-page") ? 322 : 350, root.width - 8);
    bubble.style.width = `${width}px`;
    bubble.style.maxWidth = `${width}px`;
    const bounds = bubble.getBoundingClientRect();
    const x = Math.min(
      Math.max(4, cursor.left - root.left - bounds.width / 2),
      Math.max(4, root.width - bounds.width - 4)
    );
    bubble.style.left = `${x}px`;
    positionEditorPanel(host, bubble, cursor, true);
  };
  const schedule = () => {
    if (frame != null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(bubble);
  resize.observe(editor.view.dom);
  editor.on("transaction", schedule);
  editor.on("focus", schedule);
  editor.on("blur", onBlur);
  editor.view.dom.addEventListener("beforeinput", onInput);
  document.addEventListener("pointerdown", onPointer);
  bubble.addEventListener("click", onAction);
  bubble.addEventListener("pointerdown", beforeAction, true);
  bubble.addEventListener("click", beforeAction, true);
  host.addEventListener("nf:dismiss-controls", dismiss);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  host.addEventListener("nf:position-toolbar", schedule);
  host.addEventListener("nf:viewport", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  schedule();
  return () => {
    if (frame != null) cancelAnimationFrame(frame);
    resize.disconnect();
    editor.off("transaction", schedule);
    editor.off("focus", schedule);
    editor.off("blur", onBlur);
    editor.view.dom.removeEventListener("beforeinput", onInput);
    document.removeEventListener("pointerdown", onPointer);
    bubble.removeEventListener("click", onAction);
    bubble.removeEventListener("pointerdown", beforeAction, true);
    bubble.removeEventListener("click", beforeAction, true);
    host.removeEventListener("nf:dismiss-controls", dismiss);
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    host.removeEventListener("nf:position-toolbar", schedule);
    host.removeEventListener("nf:viewport", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
  };
}
