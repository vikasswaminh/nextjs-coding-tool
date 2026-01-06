'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  content: string;
  fileName: string | null;
  onSave: (content: string) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave({
  content,
  fileName,
  onSave,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousContent = useRef<string>(content);
  const isSaving = useRef<boolean>(false);

  const save = useCallback(async () => {
    if (!fileName || !enabled || isSaving.current) return;
    
    isSaving.current = true;
    try {
      await onSave(content);
      previousContent.current = content;
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      isSaving.current = false;
    }
  }, [content, fileName, enabled, onSave]);

  useEffect(() => {
    if (!fileName || !enabled) return;

    // Only save if content actually changed
    if (content === previousContent.current) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      save();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, fileName, delay, enabled, save]);

  const hasUnsavedChanges = content !== previousContent.current && !!fileName;

  return { hasUnsavedChanges, forceSave: save };
}
