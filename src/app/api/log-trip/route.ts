import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceInput } from '@/lib/claude';
import { appendTripRow } from '@/lib/sheets';
import type { LogTripRequest, LogTripResponse } from '@/types/trip';

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogTripResponse>> {
  try {
    const body: LogTripRequest = await request.json();
    const { voice_text, trip_type } = body;

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
    if (trip_type !== 'business' && trip_type !== 'personal') {
      return NextResponse.json(
        { success: false, error: 'trip_type must be "business" or "personal"' },
        { status: 400 }
      );
    }

    // Use server-side date so the log is always in UTC
    const todayDate = new Date().toISOString().split('T')[0];

    const trip = await parseVoiceInput(voice_text, trip_type, todayDate);
    await appendTripRow(trip);

    return NextResponse.json({ success: true, trip });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('[log-trip]', message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
