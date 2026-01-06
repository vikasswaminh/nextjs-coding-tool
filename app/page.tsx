'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { listFiles, getFile, writeFile, deleteFile, VFile } from '@/lib/vfs';
import { applyOperations, revertChangeSet, ChangeSet, FileOperation } from '@/lib/applyOps';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Home() {
  const [files, setFiles] = useState<VFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastChangeSet, setLastChangeSet] = useState<ChangeSet | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Load active file content
  useEffect(() => {
    if (activeFile) {
      loadFileContent(activeFile);
    }
  }, [activeFile]);

  async function loadFiles() {
    const allFiles = await listFiles();
    setFiles(allFiles);
  }

  async function loadFileContent(path: string) {
    const file = await getFile(path);
    if (file) {
      setEditorContent(file.content);
    }
  }

  async function handleEditorChange(value: string | undefined) {
    if (value !== undefined && activeFile) {
      setEditorContent(value);
      await writeFile(activeFile, value);
      await loadFiles(); // Refresh file list
    }
  }

  async function handleCreateFile() {
    const fileName = window.prompt('Enter file name:');
    if (fileName) {
      await writeFile(fileName, '');
      await loadFiles();
      setActiveFile(fileName);
    }
  }

  async function handleDeleteFile(path: string) {
    if (window.confirm(`Delete ${path}?`)) {
      await deleteFile(path);
      await loadFiles();
      if (activeFile === path) {
        setActiveFile(null);
        setEditorContent('');
      }
    }
  }

  async function handleSubmitPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt('');
    setIsStreaming(true);
    setStreamingContent('');

    try {
      // Get current files for context
      const allFiles = await listFiles();
      const fileContext = allFiles.map((f) => ({
        path: f.path,
        content: f.content,
      }));

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage.content,
          files: fileContext,
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventMatch = line.match(/event: (\w+)\ndata: (.+)/s);
            if (eventMatch) {
              const [, eventType, data] = eventMatch;
              const parsedData = JSON.parse(data);

              if (eventType === 'status') {
                // Status event - could be used for UI feedback
                console.log('Status:', parsedData.status);
              } else if (eventType === 'token') {
                setStreamingContent((prev) => prev + parsedData.delta);
              } else if (eventType === 'result') {
                // Apply operations
                const { message, ops } = parsedData as {
                  message: string;
                  ops: FileOperation[];
                };

                if (ops && ops.length > 0) {
                  const changeSet = await applyOperations(ops);
                  setLastChangeSet(changeSet);
                  await loadFiles();
                }

                // Replace streaming content with final message
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: message },
                ]);
                setStreamingContent('');
              } else if (eventType === 'error') {
                const errorMsg = parsedData.raw
                  ? `Error: ${parsedData.error}\n\nRaw output:\n${parsedData.raw}`
                  : `Error: ${parsedData.error}`;
                setMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: errorMsg },
                ]);
                setStreamingContent('');
              }
            }
          }
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}` },
      ]);
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleRevert() {
    if (lastChangeSet) {
      if (window.confirm('Revert the last AI change?')) {
        await revertChangeSet(lastChangeSet);
        setLastChangeSet(null);
        await loadFiles();
        if (activeFile) {
          await loadFileContent(activeFile);
        }
      }
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* File List Panel */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold mb-2">Files</h2>
          <button
            onClick={handleCreateFile}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
          >
            + New File
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <div className="p-4 text-gray-400 text-sm">
              No files yet. Create one to get started!
            </div>
          ) : (
            <ul>
              {files.map((file) => (
                <li
                  key={file.path}
                  className={`flex items-center justify-between px-4 py-2 hover:bg-gray-700 cursor-pointer ${
                    activeFile === file.path ? 'bg-gray-700' : ''
                  }`}
                >
                  <span
                    onClick={() => setActiveFile(file.path)}
                    className="flex-1 truncate text-sm"
                  >
                    {file.path}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(file.path);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs ml-2"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 bg-gray-800 border-b border-gray-700">
          <div className="text-sm font-medium">
            {activeFile || 'No file selected'}
          </div>
        </div>
        <div className="flex-1">
          {activeFile ? (
            <Editor
              height="100%"
              defaultLanguage="typescript"
              theme="vs-dark"
              value={editorContent}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Select a file to edit or create a new one
            </div>
          )}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">AI Assistant</h2>
          {lastChangeSet && (
            <button
              onClick={handleRevert}
              className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1.5 rounded text-sm"
            >
              ⟲ Revert Last AI Change
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded ${
                msg.role === 'user'
                  ? 'bg-blue-900 ml-8'
                  : 'bg-gray-700 mr-8'
              }`}
            >
              <div className="text-xs font-semibold mb-1 text-gray-300">
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
          {streamingContent && (
            <div className="p-3 rounded bg-gray-700 mr-8">
              <div className="text-xs font-semibold mb-1 text-gray-300">
                Assistant
              </div>
              <div className="text-sm whitespace-pre-wrap">
                {streamingContent}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleSubmitPrompt} className="p-4 border-t border-gray-700">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the AI to create or modify files..."
            className="w-full bg-gray-900 text-white border border-gray-600 rounded p-2 text-sm resize-none"
            rows={3}
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={isStreaming || !prompt.trim()}
            className="mt-2 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
          >
            {isStreaming ? 'Streaming...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
