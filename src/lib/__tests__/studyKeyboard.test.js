import { studyKeyAction } from '../studyKeyboard';

test('el teclado exige ver la respuesta y respeta las tres notas de FSRS', () => {
  expect(studyKeyAction({ key: '1' }, false)).toBeNull();
  expect(studyKeyAction({ key: ' ' }, false)).toBe('flip');
  expect(studyKeyAction({ key: 'ArrowLeft' }, true)).toBe('again');
  expect(studyKeyAction({ key: 'ArrowUp' }, true)).toBe('hard');
  expect(studyKeyAction({ key: 'ArrowRight' }, true)).toBe('good');
  expect(studyKeyAction({ key: '4' }, true)).toBeNull();
});
test('mantener una tecla o escribir con composición no repite un repaso', () => {
  expect(studyKeyAction({ key: '3', repeat: true }, true)).toBeNull();
  expect(studyKeyAction({ key: '3', isComposing: true }, true)).toBeNull();
  expect(studyKeyAction({ key: '3', ctrlKey: true }, true)).toBeNull();
});
