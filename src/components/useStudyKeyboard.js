import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { studyKeyAction } from '../lib/studyKeyboard';

export default function useStudyKeyboard({ enabled, flipped, flip, grade }) {
  const handlers = useRef(null);
  handlers.current = { enabled, flipped, flip, grade };
  const pending = useRef(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return;
    const keydown = (event) => {
      const current = handlers.current;
      if (!current.enabled || pending.current || event.target.closest?.('input, textarea, select, button, a, [contenteditable="true"]')) return;
      const action = studyKeyAction(event, current.flipped);
      if (!action) return;
      event.preventDefault();
      if (action === 'flip') current.flip();
      else {
        pending.current = true;
        setError('');
        Promise.resolve(current.grade(action)).catch(() => { setError('No pudimos guardar el repaso. Volvé a intentar.'); }).finally(() => { pending.current = false; });
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, []));
  return error;
}
