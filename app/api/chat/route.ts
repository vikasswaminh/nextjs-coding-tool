import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/chat?projectId=xxx - Get or create conversation for project
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

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get or create conversation
    let conversation = await supabase
      .from('chat_conversations')
      .select('id, created_at, updated_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationData = conversation.data;

    if (!conversationData) {
      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from('chat_conversations')
        .insert({ project_id: projectId })
        .select()
        .single();

      if (createError || !newConversation) {
        console.error('Error creating conversation:', createError);
        return NextResponse.json({ error: createError?.message || 'Failed to create conversation' }, { status: 500 });
      }

      conversationData = newConversation;
    }

    // Ensure we have conversation data
    if (!conversationData) {
      return NextResponse.json({ error: 'Failed to get or create conversation' }, { status: 500 });
    }

    // Get messages for this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, role, content, file_context, created_at')
      .eq('conversation_id', conversationData.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      conversation: conversationData,
      messages: messages || []
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/chat - Save a message to conversation
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, role, content, fileContext } = body;

    if (!conversationId || !role || !content) {
      return NextResponse.json({ 
        error: 'conversationId, role, and content are required' 
      }, { status: 400 });
    }

    // Verify conversation ownership
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('id, project_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', conversation.project_id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        file_context: fileContext || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update conversation timestamp
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
