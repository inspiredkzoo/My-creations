import Anthropic from '@anthropic-ai/sdk';
import type { ParsedTrip, TripType } from '@/types/trip';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a mileage log data extractor. The user will give you a voice transcript of a trip log entry. Extract structured data and return ONLY valid JSON with no markdown, no explanation, no code fences.

Required fields in your JSON output:
- start_miles: integer odometer reading at trip start
- end_miles: integer odometer reading at trip end
- date: ISO 8601 date string (YYYY-MM-DD). If not mentioned, use today's date provided in the user message.
- notes: string describing the trip purpose (empty string if not mentioned)

Rules:
- Ignore commas in numbers (e.g. "45,231" becomes 45231)
- If you cannot confidently extract start_miles or end_miles, return {"error": "Could not extract odometer readings"}
- Never include extra fields or explanation text outside the JSON object
- Return only the raw JSON object, nothing else`;

export async function parseVoiceInput(
  voiceText: string,
  tripType: TripType,
  todayDate: string
): Promise<ParsedTrip> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Today's date: ${todayDate}\nTrip type: ${tripType}\nVoice transcript: ${voiceText}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textBlock.text.trim());
  } catch {
    throw new Error(`Could not understand your voice input. Please try again with clearer odometer readings.`);
  }

  if ('error' in parsed) {
    throw new Error(String(parsed.error));
  }

  const startMiles = Number(parsed.start_miles);
  const endMiles = Number(parsed.end_miles);

  if (!Number.isFinite(startMiles) || !Number.isFinite(endMiles)) {
    throw new Error('Could not read odometer numbers. Please say the start and end miles clearly.');
  }
  if (endMiles < startMiles) {
    throw new Error(
      `End miles (${endMiles}) can't be less than start miles (${startMiles}). Please try again.`
    );
  }

  return {
    start_miles: startMiles,
    end_miles: endMiles,
    date: String(parsed.date ?? todayDate),
    trip_type: tripType,
    notes: String(parsed.notes ?? ''),
  };
}
