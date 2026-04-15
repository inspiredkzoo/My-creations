import { google } from 'googleapis';
import type { ParsedTrip } from '@/types/trip';

function getAuth() {
  // Vercel stores private keys with literal \n — convert to real newlines
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function appendTripRow(trip: ParsedTrip): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const milesDriven = trip.end_miles - trip.start_miles;
  const loggedAt = new Date().toISOString();
  const tripTypeLabel =
    trip.trip_type.charAt(0).toUpperCase() + trip.trip_type.slice(1);

  // Column order matches the header row:
  // Date | Trip Type | Start Miles | End Miles | Miles Driven | Purpose/Notes | Logged At
  const row = [
    trip.date,
    tripTypeLabel,
    trip.start_miles,
    trip.end_miles,
    milesDriven,
    trip.notes,
    loggedAt,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    range: 'Sheet1!A:G',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}
