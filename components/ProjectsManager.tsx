'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ProjectsManagerProps {
  onProjectSelected: (projectId: string, projectName: string) => void;
  onClose: () => void;
}

export default function ProjectsManager({ onProjectSelected, onClose }: ProjectsManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      loadProjects();
    } else {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/projects');
      
      if (!response.ok) {
        throw new Error('Failed to load projects');
      }
      
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          seedTemplate: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const data = await response.json();
      setNewProjectName('');
      await loadProjects();
      
      // Auto-select the newly created project
      onProjectSelected(data.project.id, data.project.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleSignIn() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (error) {
      setError(error.message);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-4">Sign In Required</h2>
          <p className="text-gray-300 mb-6">
            Please sign in to manage your projects. Projects are stored in Supabase and synced across devices.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleSignIn}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Sign In with GitHub
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">My Projects</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New project name..."
              className="flex-1 bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
              disabled={creating}
            />
            <button
              onClick={handleCreateProject}
              disabled={creating || !newProjectName.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium"
            >
              {creating ? 'Creating...' : '+ Create'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No projects yet. Create one to get started!
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-gray-700 rounded hover:bg-gray-650 cursor-pointer"
                  onClick={() => onProjectSelected(project.id, project.name)}
                >
                  <div className="flex-1">
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-gray-400">
                      Updated {new Date(project.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-blue-400 text-sm">Open →</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
