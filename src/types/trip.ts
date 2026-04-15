export type TripType = 'business' | 'personal';

export interface ParsedTrip {
  start_miles: number;
  end_miles: number;
  date: string; // ISO 8601: YYYY-MM-DD
  trip_type: TripType;
  notes: string;
}

export interface LogTripRequest {
  voice_text: string;
  trip_type: TripType;
}

export interface LogTripResponse {
  success: boolean;
  trip?: ParsedTrip;
  error?: string;
}
