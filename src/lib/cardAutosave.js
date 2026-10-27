import { createCard, getCard, updateCardText } from "../db/cards";
import { getSetting, setSetting } from "../db/settings";
import { hasRichContent } from "./richtext";

const keyFor = (deckId, cardId) => `cardDraft:${deckId}:${cardId ?? "new"}`;
export async function readCardDraft(deckId, cardId = null) {
  const stored = await getSetting(keyFor(deckId, cardId));
  if (stored) return { ...stored, keyId: cardId };
  if (cardId != null) {
    const created = await getSetting(keyFor(deckId, null));
    if (created?.cardId === cardId) return { ...created, keyId: null };
  }
  return null;
}
const complete = (draft) => [draft.front, draft.back].every(hasRichContent);

// Una sola cola por sesión: si se sigue escribiendo durante un INSERT/UPDATE,
// la siguiente vuelta guarda el texto nuevo, con la identidad y base recién
// confirmadas. Los borradores incompletos quedan locales y no entran a FSRS.
export function createCardAutosave({ deckId, card = null, restored = null, onSaved = () => {}, onStatus = () => {} }) {
  const key = keyFor(deckId, restored?.keyId !== undefined ? restored.keyId : card?.id);
  let baseline = card ? { ...card, ...(restored?.expected || {}) } : null;
  let draft = restored || card || { front: "", back: "" };
  let revision = 0;
  let persisted = 0;
  let pending = null;
  let timer;
  const flush = () => {
    clearTimeout(timer);
    if (pending) return pending;
    pending = (async () => {
      try {
        while (persisted < revision) {
          const savingRevision = revision;
          const snapshot = { front: draft.front.trim(), back: draft.back.trim() };
          await setSetting(key, { ...snapshot, cardId: baseline?.id ?? null,
            expected: baseline ? { front: baseline.front, back: baseline.back } : null });
          if (!complete(snapshot)) {
            persisted = savingRevision;
            onStatus("draft");
            continue;
          }
          if (!baseline) {
            // Una recuperación interrumpida puede haber dejado ya una identidad.
            const recovered = restored?.cardId ? await getCard(restored.cardId) : null;
            if (restored?.cardId && !recovered) throw new Error("Esta tarjeta se eliminó en otro dispositivo. Conservamos tu borrador local.");
            if (recovered) baseline = { ...recovered, ...(restored.expected || {}) };
            else {
              const id = await createCard({ deckId, ...snapshot, draftKey: key });
              baseline = { id, deck_id: deckId, source: "manual", ...snapshot };
              await setSetting(key, { ...snapshot, cardId: id, expected: snapshot });
            }
          }
          if (snapshot.front !== baseline.front || snapshot.back !== baseline.back) {
            await updateCardText(baseline.id, snapshot.front, snapshot.back, { markReviewed: true, expected: {
              front: baseline.front, back: baseline.back,
            } });
            baseline = { ...baseline, ...snapshot, source: baseline.source === "ai" ? "manual" : baseline.source };
          }
          persisted = savingRevision;
          onSaved(baseline);
          await setSetting(key, null);
          onStatus("saved");
        }
        return true;
      } catch (error) {
        onStatus("error", error.message || "No pudimos guardar. Tu edición sigue abierta.");
        return false;
      }
    })().finally(() => { pending = null; });
    return pending;
  };
  return {
    change(next) {
      draft = next;
      revision++;
      onStatus("saving");
      clearTimeout(timer);
      timer = setTimeout(flush, 350);
    },
    flush,
    dispose: flush,
    isPending: () => persisted < revision,
    async cancel() { clearTimeout(timer); await pending; persisted = revision; await setSetting(key, null); },
  };
}
