import { focusStudyCard, studyKeyAction } from '../studyKeyboard';

test('el teclado exige ver la respuesta y respeta las tres notas de FSRS', () => {
  expect(studyKeyAction({ key: '1' }, false)).toBeNull();
  expect(studyKeyAction({ key: ' ' }, false)).toBe('flip');
  expect(studyKeyAction({ key: 'ArrowLeft' }, true)).toBe('again');
  expect(studyKeyAction({ key: 'ArrowUp' }, true)).toBe('hard');
  expect(studyKeyAction({ key: 'ArrowRight' }, true)).toBe('good');
  expect(studyKeyAction({ key: '4' }, true)).toBeNull();
});

test('al avanzar devuelve el foco desde el botón de nota sin mover el scroll', () => {
  const node = { focus: jest.fn() };
  focusStudyCard(node, { closest: () => null });
  expect(node.focus).toHaveBeenCalledWith({ preventScroll: true });
});

test('no roba el foco cuando se escribe o se selecciona en otro control', () => {
  const node = { focus: jest.fn() };
  focusStudyCard(node, { closest: () => ({ tagName: 'INPUT' }) });
  expect(node.focus).not.toHaveBeenCalled();
});
test('mantener una tecla o escribir con composición no repite un repaso', () => {
  expect(studyKeyAction({ key: '3', repeat: true }, true)).toBeNull();
  expect(studyKeyAction({ key: '3', isComposing: true }, true)).toBeNull();
  expect(studyKeyAction({ key: '3', ctrlKey: true }, true)).toBeNull();
});
