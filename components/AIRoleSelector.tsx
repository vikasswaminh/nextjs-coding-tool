'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface AIRole {
  id: string;
  role_name: string;
  system_prompt: string;
  description: string;
  icon: string;
}

interface AIRoleSelectorProps {
  selectedRole: string;
  onRoleChange: (role: string, prompt: string) => void;
}

export default function AIRoleSelector({ selectedRole, onRoleChange }: AIRoleSelectorProps) {
  const [roles, setRoles] = useState<AIRole[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('ai_role_prompts')
        .select('*')
        .order('role_name');

      if (error) {
        console.error('Error loading roles:', error);
        return;
      }

      setRoles(data || []);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  }

  function handleRoleSelect(role: AIRole) {
    onRoleChange(role.role_name, role.system_prompt);
    setIsOpen(false);
  }

  const currentRole = roles.find(r => r.role_name === selectedRole) || roles[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded border border-gray-600 text-sm"
      >
        <div className="flex items-center gap-2">
          <span>{currentRole?.icon}</span>
          <span className="font-medium capitalize">{currentRole?.role_name || 'Developer'}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-20 max-h-96 overflow-y-auto">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role)}
                className={`w-full flex items-start gap-3 px-3 py-2 hover:bg-gray-600 text-left ${
                  role.role_name === selectedRole ? 'bg-gray-650' : ''
                }`}
              >
                <span className="text-lg">{role.icon}</span>
                <div className="flex-1">
                  <div className="font-medium capitalize">{role.role_name}</div>
                  <div className="text-xs text-gray-400">{role.description}</div>
                </div>
                {role.role_name === selectedRole && (
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
