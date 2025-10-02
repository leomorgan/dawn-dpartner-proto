// app/api/vectors/nearest-ctas/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { findNearestPrimaryCtas, getStyleProfileByRunId } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const runId = searchParams.get('runId');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  try {
    const profile = await getStyleProfileByRunId(runId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const nearest = await findNearestPrimaryCtas(profile.id, limit);

    return NextResponse.json({
      reference: {
        id: profile.id,
        url: profile.source_url,
        runId
      },
      nearest
    });
  } catch (error: any) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
