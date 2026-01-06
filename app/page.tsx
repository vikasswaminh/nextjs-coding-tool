'use client';

import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { listFiles, getFile, writeFile, deleteFile, VFile } from '@/lib/vfs';
import { applyOperations, revertChangeSet, ChangeSet, FileOperation } from '@/lib/applyOps';
import ProjectsManager from '@/components/ProjectsManager';
import FileTree from '@/components/FileTree';
import AISuggestions from '@/components/AISuggestions';
import { useToast } from '@/components/ToastProvider';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SavedMessage {
  id: string;
  role: string;
  content: string;
  file_context: any;
  created_at: string;
}

export default function Home() {
  const { showToast } = useToast();
  const [files, setFiles] = useState<VFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastChangeSet, setLastChangeSet] = useState<ChangeSet | null>(null);
  const [pendingOperations, setPendingOperations] = useState<FileOperation[]>([]);
  const [showProjectsManager, setShowProjectsManager] = useState(false);
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);
  const [showRunLocally, setShowRunLocally] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
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

  // Load conversation when project changes
  useEffect(() => {
    if (currentProject) {
      loadConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject]);

  async function loadConversation() {
    if (!currentProject) return;

    try {
      const response = await fetch(`/api/chat?projectId=${currentProject.id}`);
      if (response.ok) {
        const data = await response.json();
        setConversationId(data.conversation.id);
        
        // Load message history
        const savedMessages: Message[] = data.messages.map((m: SavedMessage) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(savedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }

  async function saveMessage(role: 'user' | 'assistant', content: string) {
    if (!conversationId || !currentProject) return;

    try {
      const fileContext = {
        files: files.map(f => ({ path: f.path, size: f.content.length })),
        activeFile,
      };

      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          role,
          content,
          fileContext,
        }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  }

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

    // Save user message to database
    if (conversationId) {
      await saveMessage('user', userMessage.content);
    }

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
          conversationHistory: messages.slice(-10), // Last 10 messages
          projectId: currentProject?.id,
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
                const { message, ops, suggestions: aiSuggestions } = parsedData as {
                  message: string;
                  ops: FileOperation[];
                  suggestions?: string[];
                };

                if (ops && ops.length > 0) {
                  // Store pending operations instead of auto-applying
                  setPendingOperations(ops);
                  const changeSet = await applyOperations(ops);
                  setLastChangeSet(changeSet);
                  await loadFiles();
                }

                // Store AI suggestions
                if (aiSuggestions && aiSuggestions.length > 0) {
                  setSuggestions(aiSuggestions);
                }

                // Replace streaming content with final message
                const assistantMessage = { role: 'assistant' as const, content: message };
                setMessages((prev) => [
                  ...prev,
                  assistantMessage,
                ]);
                setStreamingContent('');
                
                // Save assistant message to database
                if (conversationId) {
                  await saveMessage('assistant', message);
                }
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
        setPendingOperations([]);
        await loadFiles();
        if (activeFile) {
          await loadFileContent(activeFile);
        }
      }
    }
  }

  async function handleApplyToProject() {
    if (!currentProject || pendingOperations.length === 0) {
      showToast('No project selected or no pending changes', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: pendingOperations }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply changes to project');
      }

      showToast('Changes applied to project successfully!', 'success');
      setPendingOperations([]);
    } catch (error) {
      console.error('Error applying changes:', error);
      showToast('Failed to apply changes to project', 'error');
    }
  }

  async function handleLoadProject(projectId: string, projectName: string) {
    try {
      // Load project files
      const response = await fetch(`/api/projects/${projectId}/files?includeContent=true`);
      
      if (!response.ok) {
        throw new Error('Failed to load project files');
      }

      const data = await response.json();
      
      // Clear current VFS and load project files
      const currentFiles = await listFiles();
      for (const file of currentFiles) {
        await deleteFile(file.path);
      }

      // Load project files into VFS
      for (const file of data.files) {
        await writeFile(file.path, file.content);
      }

      setCurrentProject({ id: projectId, name: projectName });
      setShowProjectsManager(false);
      await loadFiles();
      
      if (data.files.length > 0) {
        setActiveFile(data.files[0].path);
      }
      
      showToast(`Loaded project: ${projectName}`, 'success');
    } catch (error) {
      console.error('Error loading project:', error);
      showToast('Failed to load project', 'error');
    }
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* File List Panel */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold mb-2">
            {currentProject ? currentProject.name : 'Local Files'}
          </h2>
          <div className="space-y-2">
            <button
              onClick={() => setShowProjectsManager(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-sm"
            >
              📁 Projects
            </button>
            <button
              onClick={handleCreateFile}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
            >
              + New File
            </button>
            {currentProject && (
              <button
                onClick={() => setShowRunLocally(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm"
              >
                ▶ Run Locally
              </button>
            )}
          </div>
        </div>
        <FileTree
          files={files}
          activeFile={activeFile}
          onFileSelect={setActiveFile}
          onFileDelete={handleDeleteFile}
        />
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
          {currentProject && pendingOperations.length > 0 && (
            <button
              onClick={handleApplyToProject}
              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm"
            >
              ✓ Apply {pendingOperations.length} Change(s) to Project
            </button>
          )}
        </div>
        
        {/* AI Suggestions */}
        {currentProject && (
          <AISuggestions
            projectId={currentProject.id}
            onDismiss={() => {}}
            onAccept={(suggestion) => {
              setPrompt(suggestion.content);
            }}
          />
        )}
        
        {/* Next Steps Suggestions */}
        {suggestions.length > 0 && (
          <div className="border-b border-gray-700 p-3 bg-green-900 bg-opacity-20">
            <div className="text-xs font-semibold text-green-300 mb-2">📝 Suggested Next Steps</div>
            <div className="space-y-1">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(suggestion)}
                  className="w-full text-left text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded border border-green-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
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

      {/* Projects Manager Modal */}
      {showProjectsManager && (
        <ProjectsManager
          onProjectSelected={handleLoadProject}
          onClose={() => setShowProjectsManager(false)}
        />
      )}

      {/* Run Locally Modal */}
      {showRunLocally && currentProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Run Project Locally</h2>
              <button
                onClick={() => setShowRunLocally(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-gray-300 mb-4">
                  To run this project locally, use the following command:
                </p>
                <div className="bg-gray-900 p-4 rounded border border-gray-700 font-mono text-sm">
                  <code className="text-green-400">
                    npx nextjs-coding-tool dev {currentProject.id}
                  </code>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`npx nextjs-coding-tool dev ${currentProject.id}`);
                    showToast('Command copied to clipboard!', 'success');
                  }}
                  className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                >
                  📋 Copy Command
                </button>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <p className="text-gray-400 text-sm mb-2">
                  The CLI tool will:
                </p>
                <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                  <li>Download your project files from Supabase</li>
                  <li>Set up a local development environment</li>
                  <li>Start the Next.js development server</li>
                  <li>Watch for changes and sync back to Supabase</li>
                </ul>
              </div>

              <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded p-3 text-sm">
                <p className="text-yellow-200">
                  <strong>Note:</strong> The CLI tool is a placeholder command. 
                  Implementation would require a separate npm package.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
