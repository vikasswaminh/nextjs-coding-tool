import { getFile, writeFile, deleteFile, VFile } from './vfs';

export interface FileOperation {
  op: 'writeFile' | 'deleteFile';
  path: string;
  content?: string;
}

export interface ChangeSet {
  operations: FileOperation[];
  before: Map<string, string | null>; // null means file didn't exist
}

export async function applyOperations(
  ops: FileOperation[]
): Promise<ChangeSet> {
  const before = new Map<string, string | null>();

  // Capture before state for all affected files
  for (const operation of ops) {
    const existingFile = await getFile(operation.path);
    before.set(operation.path, existingFile?.content ?? null);
  }

  // Apply operations
  for (const operation of ops) {
    if (operation.op === 'writeFile' && operation.content !== undefined) {
      await writeFile(operation.path, operation.content);
    } else if (operation.op === 'deleteFile') {
      await deleteFile(operation.path);
    }
  }

  return {
    operations: ops,
    before,
  };
}

export async function revertChangeSet(changeSet: ChangeSet): Promise<void> {
  // Revert in reverse order
  for (let i = changeSet.operations.length - 1; i >= 0; i--) {
    const operation = changeSet.operations[i];
    const beforeContent = changeSet.before.get(operation.path);

    if (beforeContent === null) {
      // File didn't exist before, delete it
      await deleteFile(operation.path);
    } else if (beforeContent !== undefined) {
      // File existed, restore its content
      await writeFile(operation.path, beforeContent);
    }
  }
}
