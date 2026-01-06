import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

// GET /api/projects/[projectId]/files - List/get project files
export async function GET(
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

    const { searchParams } = new URL(req.url);
    const includeContent = searchParams.get('includeContent') === 'true';

    // Fetch files
    let query = supabase
      .from('project_files')
      .select(includeContent ? 'id, path, content, updated_at' : 'id, path, updated_at')
      .eq('project_id', projectId)
      .order('path');

    const { data: files, error } = await query;

    if (error) {
      console.error('Error fetching files:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
