/** @jest-environment jsdom */
import React from 'react';
import { Platform } from 'react-native';
import { act, create } from 'react-test-renderer';

import useStudyKeyboard from '../useStudyKeyboard';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback) => require('react').useEffect(callback, [callback]),
}));

let screen;
let previousOS;
const flip = jest.fn();
const grade = jest.fn().mockResolvedValue(undefined);

function StudyKeyboard() {
  useStudyKeyboard({ enabled: true, flipped: true, flip, grade });
  return null;
}

beforeEach(async () => {
  previousOS = Platform.OS;
  Platform.OS = 'web';
  await act(async () => { screen = create(<StudyKeyboard />); });
});

afterEach(async () => {
  await act(async () => screen.unmount());
  Platform.OS = previousOS;
  document.body.innerHTML = '';
  jest.clearAllMocks();
});

test.each(['button', 'link'])('un control con role=%s no dispara además el atajo de la tarjeta', async (role) => {
  const control = document.createElement('div');
  control.setAttribute('role', role);
  const icon = document.createElement('span');
  control.append(icon);
  document.body.append(control);
  await act(async () => {
    icon.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    icon.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  });
  expect(flip).not.toHaveBeenCalled();
  expect(grade).not.toHaveBeenCalled();
});

test('Espacio y la flecha siguen funcionando sobre el área de estudio', async () => {
  const card = document.createElement('div');
  document.body.append(card);
  await act(async () => {
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  });
  expect(flip).toHaveBeenCalledTimes(1);
  expect(grade).toHaveBeenCalledWith('hard');
});
