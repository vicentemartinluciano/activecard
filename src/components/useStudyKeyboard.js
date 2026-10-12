import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { studyKeyAction } from '../lib/studyKeyboard';
import { isStudyControl } from '../lib/studyControls';

export default function useStudyKeyboard({ enabled, flipped, flip, grade, isBusy }) {
  const handlers = useRef(null);
  handlers.current = { enabled, flipped, flip, grade, isBusy };
  const pending = useRef(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web') return;
    const keydown = (event) => {
      const current = handlers.current;
      if (!current.enabled || pending.current || current.isBusy?.()) return;
      if (isStudyControl(event.target)) return;
      const action = studyKeyAction(event, current.flipped);
      if (!action) return;
      event.preventDefault();
      // Resolver antes del handler de la cara o de PressResponder: Espacio
      // debe girar una sola vez y no convertirse además en un click.
      event.stopPropagation();
      if (action === 'flip') current.flip();
      else {
        pending.current = true;
        setError('');
        Promise.resolve(current.grade(action)).catch(() => { setError('No pudimos guardar el repaso. Volvé a intentar.'); }).finally(() => { pending.current = false; });
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => document.removeEventListener('keydown', keydown, true);
  }, []));
  return error;
}
