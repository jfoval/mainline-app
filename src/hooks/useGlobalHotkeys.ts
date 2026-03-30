'use client';

import { useEffect, useRef } from 'react';

type HotkeyMap = Record<string, () => void>;

function isInputFocused(): boolean {
  const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

/**
 * Two-key chord hotkeys with a leader key (default: 'g').
 * Press leader, then a second key within 1 second to trigger the action.
 * Also supports direct Shift+key shortcuts via the shiftKeys map.
 */
export function useChordHotkeys(
  chordMap: HotkeyMap,
  shiftMap: HotkeyMap = {},
  leader = 'g'
) {
  const leaderPressed = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearLeader() {
      leaderPressed.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;

      // Handle Shift+key shortcuts
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toUpperCase();
        if (shiftMap[key]) {
          e.preventDefault();
          shiftMap[key]();
          clearLeader();
          return;
        }
      }

      // Don't process chords if modifier keys are held
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      const key = e.key.toLowerCase();

      if (leaderPressed.current) {
        clearLeader();
        if (chordMap[key]) {
          e.preventDefault();
          chordMap[key]();
        }
        return;
      }

      if (key === leader) {
        leaderPressed.current = true;
        timerRef.current = setTimeout(clearLeader, 1000);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearLeader();
    };
  }, [chordMap, shiftMap, leader]);
}

/**
 * Simple single-key hotkeys (for page-specific shortcuts like 1-9).
 */
export function useHotkeys(keyMap: HotkeyMap) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      const key = e.key.toLowerCase();
      if (keyMap[key]) {
        e.preventDefault();
        keyMap[key]();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyMap]);
}
