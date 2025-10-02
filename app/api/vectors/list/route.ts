// app/api/vectors/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllStyleProfiles } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  try {
    const profiles = await getAllStyleProfiles();
    return NextResponse.json({ profiles });
  } catch (error: any) {
    console.error('[API Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
