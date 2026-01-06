'use client';

import { VFile } from '@/lib/vfs';

interface FileTreeProps {
  files: VFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onFileDelete: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

function buildTree(files: VFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  // Sort files by path
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  sortedFiles.forEach((file) => {
    const parts = file.path.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;

      let existingNode = currentLevel.find((n) => n.name === part);

      if (!existingNode) {
        const node: TreeNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          children: isFile ? undefined : [],
        };
        currentLevel.push(node);
        map.set(currentPath, node);
        existingNode = node;
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });

  return root;
}

function TreeNodeComponent({
  node,
  activeFile,
  onFileSelect,
  onFileDelete,
  level = 0,
}: {
  node: TreeNode;
  activeFile: string | null;
  onFileSelect: (path: string) => void;
  onFileDelete: (path: string) => void;
  level?: number;
}) {
  const isActive = node.type === 'file' && node.path === activeFile;
  const paddingLeft = `${level * 12 + 8}px`;

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className="flex items-center py-1 px-2 hover:bg-gray-700 cursor-pointer text-sm"
          style={{ paddingLeft }}
        >
          <span className="mr-2">📁</span>
          <span className="text-gray-300">{node.name}</span>
        </div>
        {node.children?.map((child) => (
          <TreeNodeComponent
            key={child.path}
            node={child}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
            onFileDelete={onFileDelete}
            level={level + 1}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between py-1 px-2 hover:bg-gray-700 cursor-pointer text-sm group ${
        isActive ? 'bg-gray-700' : ''
      }`}
      style={{ paddingLeft }}
    >
      <div className="flex items-center flex-1" onClick={() => onFileSelect(node.path)}>
        <span className="mr-2">📄</span>
        <span className="truncate">{node.name}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onFileDelete(node.path);
        }}
        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs ml-2"
      >
        ✕
      </button>
    </div>
  );
}

export default function FileTree({ files, activeFile, onFileSelect, onFileDelete }: FileTreeProps) {
  const tree = buildTree(files);

  return (
    <div className="flex-1 overflow-y-auto">
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          onFileDelete={onFileDelete}
        />
      ))}
    </div>
  );
}
