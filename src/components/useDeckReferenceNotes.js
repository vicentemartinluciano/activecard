import { useEffect, useRef, useState } from "react";
import { listNotesForDeck } from "../db/notes";

export default function useDeckReferenceNotes(deckId, refreshKey = 0) {
  const cacheRef = useRef({ key: refreshKey, map: new Map() });
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    if (cacheRef.current.key !== refreshKey) {
      cacheRef.current = { key: refreshKey, map: new Map() };
    }
    if (!deckId || Number.isNaN(Number(deckId))) {
      setNotes([]);
      return;
    }
    const targetId = Number(deckId);
    const cached = cacheRef.current.map.get(targetId);
    if (cached) {
      setNotes(cached);
      return;
    }
    let alive = true;
    Promise.resolve(listNotesForDeck?.(targetId, { includeBody: true }))
      .then((res) => {
        if (!alive) return;
        const list = res?.all || [];
        cacheRef.current.map.set(targetId, list);
        setNotes(list);
      })
      .catch(() => {
        if (alive) setNotes([]);
      });
    return () => {
      alive = false;
    };
  }, [deckId, refreshKey]);

  return notes;
}
