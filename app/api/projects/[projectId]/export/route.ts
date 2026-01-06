import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

// Helper to verify CLI token
async function verifyCliToken(supabase: SupabaseClient, token: string): Promise<string | null> {
  const { data: tokens } = await supabase
    .from('cli_tokens')
    .select('token_hash, owner_id')
    .is('revoked_at', null);

  if (!tokens) return null;

  for (const tokenData of tokens) {
    const isValid = await bcrypt.compare(token, tokenData.token_hash);
    if (isValid) {
      return tokenData.owner_id;
    }
  }

  return null;
}

// GET /api/projects/[projectId]/export - Export project as bundle
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  try {
    const { projectId } = await params;
    const supabase = await createClient();
    
    // Check authentication - support both web session and CLI token
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      userId = await verifyCliToken(supabase, token);
      if (!userId) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, owner_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.owner_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all files
    const { data: files, error: filesError } = await supabase
      .from('project_files')
      .select('path, content')
      .eq('project_id', projectId)
      .order('path');

    if (filesError) {
      console.error('Error fetching files:', filesError);
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
      },
      files: files || [],
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
