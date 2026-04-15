import { NextRequest, NextResponse } from 'next/server';
import { appendTripRow } from '@/lib/sheets';
import type { LogTripRequest, LogTripResponse, ParsedTrip } from '@/types/trip';

export async function POST(
  request: NextRequest
): Promise<NextResponse<LogTripResponse>> {
  try {
    const body: LogTripRequest = await request.json();
    const { start_miles, end_miles, trip_type, date, notes } = body;

    if (trip_type !== 'business' && trip_type !== 'personal') {
      return NextResponse.json(
        { success: false, error: 'trip_type must be "business" or "personal"' },
        { status: 400 }
      );
    }
    if (!Number.isFinite(start_miles) || !Number.isFinite(end_miles)) {
      return NextResponse.json(
        { success: false, error: 'start_miles and end_miles must be numbers' },
        { status: 400 }
      );
    }
    if (end_miles < start_miles) {
      return NextResponse.json(
        {
          success: false,
          error: `End miles (${end_miles}) can't be less than start miles (${start_miles})`,
        },
        { status: 400 }
      );
    }

    const trip: ParsedTrip = { start_miles, end_miles, trip_type, date, notes };
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
