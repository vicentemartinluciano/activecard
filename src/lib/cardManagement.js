import { deleteCard, setCardDeck } from '../db/cards';
import { setSetting } from '../db/settings';

export async function removeManagedCard({ deckId, autosave, resolveCard }) {
  await autosave?.pause();
  try {
    // Un INSERT ya iniciado puede haber asignado un ID mientras esperábamos.
    const card = resolveCard();
    if (!card) throw new Error('Esta tarjeta ya no está disponible.');
    if (card.id === 'new') await setSetting(autosave?.draftKey || `cardDraft:${deckId}:new`, null);
    else await deleteCard(card.id);
    autosave?.forget();
    return card;
  } catch (error) { autosave?.resume(); throw error; }
}

export async function moveManagedCard({ autosave, resolveCard, targetDeckId }) {
  if (autosave && !await autosave.flush()) throw new Error('No pudimos guardar antes de mover. Tu edición sigue abierta.');
  await autosave?.pause();
  try {
    const card = resolveCard();
    if (!card || card.id === 'new') throw new Error('Completá la tarjeta antes de moverla.');
    await setCardDeck(card.id, targetDeckId);
    autosave?.forget();
    return card;
  } catch (error) { autosave?.resume(); throw error; }
}
