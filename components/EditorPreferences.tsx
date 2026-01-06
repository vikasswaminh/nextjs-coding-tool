'use client';

import { useState, useEffect } from 'react';

interface ThemeOption {
  id: string;
  name: string;
  monaco: string;
}

export const EDITOR_THEMES: ThemeOption[] = [
  { id: 'vs-dark', name: 'Dark (Default)', monaco: 'vs-dark' },
  { id: 'light', name: 'Light', monaco: 'light' },
  { id: 'hc-black', name: 'High Contrast Dark', monaco: 'hc-black' },
];

export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24];

interface EditorPreferences {
  theme: string;
  fontSize: number;
  minimap: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
}

const DEFAULT_PREFERENCES: EditorPreferences = {
  theme: 'vs-dark',
  fontSize: 14,
  minimap: true,
  wordWrap: false,
  lineNumbers: true,
};

export function useEditorPreferences() {
  const [preferences, setPreferences] = useState<EditorPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('editorPreferences');
    if (saved) {
      try {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) });
      } catch (e) {
        console.error('Failed to load editor preferences:', e);
      }
    }
  }, []);

  const updatePreferences = (updates: Partial<EditorPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    localStorage.setItem('editorPreferences', JSON.stringify(newPrefs));
  };

  return { preferences, updatePreferences };
}

interface EditorPreferencesProps {
  preferences: EditorPreferences;
  onUpdate: (updates: Partial<EditorPreferences>) => void;
  onClose: () => void;
}

export function EditorPreferencesPanel({ preferences, onUpdate, onClose }: EditorPreferencesProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Editor Preferences</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <select
              value={preferences.theme}
              onChange={(e) => onUpdate({ theme: e.target.value })}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white"
            >
              {EDITOR_THEMES.map(theme => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Font Size: {preferences.fontSize}px
            </label>
            <input
              type="range"
              min={10}
              max={24}
              value={preferences.fontSize}
              onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>10px</span>
              <span>24px</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm">Show Minimap</span>
              <input
                type="checkbox"
                checked={preferences.minimap}
                onChange={(e) => onUpdate({ minimap: e.target.checked })}
                className="w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">Word Wrap</span>
              <input
                type="checkbox"
                checked={preferences.wordWrap}
                onChange={(e) => onUpdate({ wordWrap: e.target.checked })}
                className="w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">Line Numbers</span>
              <input
                type="checkbox"
                checked={preferences.lineNumbers}
                onChange={(e) => onUpdate({ lineNumbers: e.target.checked })}
                className="w-4 h-4"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
