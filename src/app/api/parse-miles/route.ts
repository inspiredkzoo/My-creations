import { NextRequest, NextResponse } from 'next/server';
import { parseSingleMileage } from '@/lib/claude';
import type { ParseMilesRequest, ParseMilesResponse } from '@/types/trip';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ParseMilesResponse>> {
  try {
    const body: ParseMilesRequest = await request.json();
    const { voice_text } = body;

    if (
      !voice_text ||
      typeof voice_text !== 'string' ||
      voice_text.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, error: 'Voice text is required' },
        { status: 400 }
      );
    }

    const { miles, notes } = await parseSingleMileage(voice_text);
    return NextResponse.json({ success: true, miles, notes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[parse-miles]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
