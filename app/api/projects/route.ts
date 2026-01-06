import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/projects - List user's projects
export async function GET() {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's projects
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, created_at, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, seedTemplate } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name,
        owner_id: user.id,
      })
      .select()
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
      return NextResponse.json({ error: projectError.message }, { status: 500 });
    }

    // Seed with minimal Next.js template if requested
    if (seedTemplate) {
      const templateFiles = [
        {
          project_id: project.id,
          path: 'package.json',
          content: JSON.stringify({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            version: '0.1.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
            },
            dependencies: {
              react: '^18.3.1',
              'react-dom': '^18.3.1',
              next: '^15.1.2',
            },
          }, null, 2),
        },
        {
          project_id: project.id,
          path: 'app/page.tsx',
          content: `export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to ${name}</h1>
    </main>
  );
}
`,
        },
        {
          project_id: project.id,
          path: 'app/layout.tsx',
          content: `export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
        },
      ];

      const { error: filesError } = await supabase
        .from('project_files')
        .insert(templateFiles);

      if (filesError) {
        console.error('Error creating template files:', filesError);
        // Don't fail the project creation, just log the error
      }
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
