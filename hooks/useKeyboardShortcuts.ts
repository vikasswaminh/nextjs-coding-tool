'use client';

import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlOrCmd: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsProps) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmdPressed = isMac ? event.metaKey : event.ctrlKey;

      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = !shortcut.ctrlOrCmd || ctrlOrCmdPressed;
        const shiftMatches = !shortcut.shift || event.shiftKey;
        const altMatches = !shortcut.alt || event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          // Prevent default only if all modifiers match
          if (shortcut.ctrlOrCmd || shortcut.shift || shortcut.alt) {
            event.preventDefault();
            shortcut.action();
            break;
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}
