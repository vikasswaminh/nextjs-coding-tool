'use client';

import { useEffect, useState } from 'react';

interface Suggestion {
  id: string;
  suggestion_type: string;
  content: string;
  context: any;
  created_at: string;
}

interface AISuggestionsProps {
  projectId: string | null;
  onDismiss: (id: string) => void;
  onAccept: (suggestion: Suggestion) => void;
}

export default function AISuggestions({ projectId, onDismiss, onAccept }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (projectId) {
      loadSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function loadSuggestions() {
    if (!projectId) return;

    try {
      const response = await fetch(`/api/suggestions?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  }

  async function handleDismiss(id: string) {
    try {
      const response = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId: id }),
      });

      if (response.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
        onDismiss(id);
      }
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
    }
  }

  if (!projectId || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-gray-700 p-3 bg-blue-900 bg-opacity-20">
      <div className="text-xs font-semibold text-blue-300 mb-2">💡 AI Suggestions</div>
      <div className="space-y-2">
        {suggestions.slice(0, 3).map((suggestion) => (
          <div
            key={suggestion.id}
            className="bg-gray-800 rounded p-2 text-sm border border-blue-700"
          >
            <div className="text-blue-200 mb-1 font-medium capitalize">
              {suggestion.suggestion_type.replace(/_/g, ' ')}
            </div>
            <div className="text-gray-300 text-xs mb-2">{suggestion.content}</div>
            <div className="flex gap-2">
              <button
                onClick={() => onAccept(suggestion)}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
              >
                Apply
              </button>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
