export type TripType = 'business' | 'personal';

export interface ParsedTrip {
  start_miles: number;
  end_miles: number;
  date: string; // ISO 8601: YYYY-MM-DD
  trip_type: TripType;
  notes: string;
}

// Saved to localStorage while a trip is in progress
export interface ActiveTrip {
  trip_type: TripType;
  start_miles: number;
  start_date: string; // ISO 8601: YYYY-MM-DD
  notes: string;
}

// POST /api/parse-miles — extract a single odometer reading from voice
export interface ParseMilesRequest {
  voice_text: string;
}
export interface ParseMilesResponse {
  success: boolean;
  miles?: number;
  notes?: string;
  error?: string;
}

// POST /api/log-trip — write a completed trip to Google Sheets
export interface LogTripRequest {
  start_miles: number;
  end_miles: number;
  trip_type: TripType;
  date: string;
  notes: string;
}
export interface LogTripResponse {
  success: boolean;
  trip?: ParsedTrip;
  error?: string;
}
