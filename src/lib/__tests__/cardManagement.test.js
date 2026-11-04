import { createCardAutosave } from '../cardAutosave';
import { moveManagedCard, removeManagedCard } from '../cardManagement';
import { createCard, deleteCard, setCardDeck, updateCardText } from '../../db/cards';
import { setSetting } from '../../db/settings';

jest.mock('../../db/cards', () => ({ createCard: jest.fn(), deleteCard: jest.fn(), setCardDeck: jest.fn(), updateCardText: jest.fn(), getCard: jest.fn() }));
jest.mock('../../db/settings', () => ({ getSetting: jest.fn(), setSetting: jest.fn() }));
beforeEach(() => { jest.useFakeTimers(); jest.resetAllMocks(); });
afterEach(() => jest.useRealTimers());

test('descartar antes del debounce no inserta una tarjeta ni resucita al desmontar', async () => {
  const saver = createCardAutosave({ deckId: 7 });
  saver.change({ front: 'Pregunta', back: 'Respuesta' });
  await removeManagedCard({ deckId: 7, autosave: saver, resolveCard: () => ({ id: 'new' }) });
  await saver.dispose(); jest.runOnlyPendingTimers();
  expect(createCard).not.toHaveBeenCalled(); expect(deleteCard).not.toHaveBeenCalled();
  expect(setSetting).toHaveBeenCalledWith('cardDraft:7:new', null);
});

test('eliminar durante un INSERT espera su identidad y elimina esa tarjeta una sola vez', async () => {
  let finish, card = { id: 'new' };
  createCard.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const saver = createCardAutosave({ deckId: 7, onSaved: (saved) => { card = saved; } });
  saver.change({ front: 'Pregunta', back: 'Respuesta' });
  const saving = saver.flush();
  await Promise.resolve(); await Promise.resolve();
  const removal = removeManagedCard({ deckId: 7, autosave: saver, resolveCard: () => card });
  expect(deleteCard).not.toHaveBeenCalled();
  finish(12); await saving; await removal;
  expect(deleteCard).toHaveBeenCalledWith(12); expect(createCard).toHaveBeenCalledTimes(1);
  await saver.dispose(); expect(createCard).toHaveBeenCalledTimes(1);
});

test('un fallo al eliminar conserva el texto y reanuda su guardado', async () => {
  const card = { id: 12, front: 'Anterior', back: 'Respuesta' };
  const saver = createCardAutosave({ deckId: 7, card });
  saver.change({ front: 'Mi edición', back: 'Respuesta' });
  deleteCard.mockRejectedValueOnce(new Error('Disco ocupado'));
  await expect(removeManagedCard({ deckId: 7, autosave: saver, resolveCard: () => card })).rejects.toThrow('Disco ocupado');
  expect(await saver.flush()).toBe(true);
  expect(updateCardText).toHaveBeenCalledWith(12, 'Mi edición', 'Respuesta', expect.anything());
});

test('un conflicto de autoguardado impide mover y conserva el borrador', async () => {
  const card = { id: 12, front: 'Anterior', back: 'Respuesta' };
  const saver = createCardAutosave({ deckId: 7, card });
  saver.change({ front: 'Mi edición', back: 'Respuesta' });
  updateCardText.mockRejectedValueOnce(new Error('Conflicto'));
  await expect(moveManagedCard({ autosave: saver, resolveCard: () => card, targetDeckId: 8 })).rejects.toThrow('No pudimos guardar');
  expect(setCardDeck).not.toHaveBeenCalled(); expect(saver.isPending()).toBe(true);
});

test('mover guarda antes y reanuda el editor si falla el destino', async () => {
  const card = { id: 12, front: 'Anterior', back: 'Respuesta' };
  const saver = createCardAutosave({ deckId: 7, card });
  saver.change({ front: 'Mi edición', back: 'Respuesta' });
  setCardDeck.mockRejectedValueOnce(new Error('Destino eliminado'));
  await expect(moveManagedCard({ autosave: saver, resolveCard: () => card, targetDeckId: 8 })).rejects.toThrow('Destino eliminado');
  saver.change({ front: 'Seguí escribiendo', back: 'Respuesta' });
  expect(await saver.flush()).toBe(true);
  expect(updateCardText).toHaveBeenLastCalledWith(12, 'Seguí escribiendo', 'Respuesta', expect.anything());
});
