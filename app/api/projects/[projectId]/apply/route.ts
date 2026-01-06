import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

interface FileOperation {
  op: 'writeFile' | 'deleteFile';
  path: string;
  content?: string;
}

// POST /api/projects/[projectId]/apply - Apply file operations to DB
export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { operations } = body as { operations: FileOperation[] };

    if (!Array.isArray(operations)) {
      return NextResponse.json({ error: 'Operations must be an array' }, { status: 400 });
    }

    // Verify project exists and user owns it
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Store the changeset
    const { error: changesetError } = await supabase
      .from('project_changesets')
      .insert({
        project_id: projectId,
        ops: operations,
        status: 'applied',
      });

    if (changesetError) {
      console.error('Error storing changeset:', changesetError);
      // Continue anyway, this is just for history
    }

    // Apply operations
    const results = [];
    for (const op of operations) {
      if (op.op === 'writeFile') {
        // Upsert file
        const { error } = await supabase
          .from('project_files')
          .upsert({
            project_id: projectId,
            path: op.path,
            content: op.content || '',
          }, {
            onConflict: 'project_id,path',
          });

        if (error) {
          console.error(`Error writing file ${op.path}:`, error);
          results.push({ path: op.path, success: false, error: error.message });
        } else {
          results.push({ path: op.path, success: true });
        }
      } else if (op.op === 'deleteFile') {
        // Delete file
        const { error } = await supabase
          .from('project_files')
          .delete()
          .eq('project_id', projectId)
          .eq('path', op.path);

        if (error) {
          console.error(`Error deleting file ${op.path}:`, error);
          results.push({ path: op.path, success: false, error: error.message });
        } else {
          results.push({ path: op.path, success: true });
        }
      }
    }

    // Update project's updated_at
    await supabase
      .from('projects')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', projectId);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
