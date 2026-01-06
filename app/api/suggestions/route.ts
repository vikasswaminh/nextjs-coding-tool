import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/suggestions?projectId=xxx - Get AI suggestions for project
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Get undismissed suggestions
    const { data: suggestions, error } = await supabase
      .from('ai_suggestions')
      .select('id, suggestion_type, content, context, created_at')
      .eq('project_id', projectId)
      .eq('dismissed', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suggestions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ suggestions: suggestions || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/suggestions - Create a new suggestion
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, suggestionType, content, context } = body;

    if (!projectId || !suggestionType || !content) {
      return NextResponse.json({ 
        error: 'projectId, suggestionType, and content are required' 
      }, { status: 400 });
    }

    // Insert suggestion
    const { data: suggestion, error: insertError } = await supabase
      .from('ai_suggestions')
      .insert({
        project_id: projectId,
        suggestion_type: suggestionType,
        content,
        context: context || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting suggestion:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/suggestions - Dismiss a suggestion
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { suggestionId } = body;

    if (!suggestionId) {
      return NextResponse.json({ error: 'suggestionId is required' }, { status: 400 });
    }

    // Update suggestion
    const { error: updateError } = await supabase
      .from('ai_suggestions')
      .update({ dismissed: true })
      .eq('id', suggestionId);

    if (updateError) {
      console.error('Error dismissing suggestion:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
