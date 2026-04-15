import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SINGLE_MILES_SYSTEM_PROMPT = `You are an odometer reading extractor. The user will say a number and possibly a short trip description. Extract the odometer reading and any description.

Return ONLY valid JSON with no markdown, no explanation, no code fences:
{"miles": <integer>, "notes": "<description or empty string>"}

Rules:
- Ignore commas in numbers (e.g. "45,231" becomes 45231)
- If you cannot extract a number, return {"error": "Could not extract odometer reading"}
- Return only the raw JSON object, nothing else`;

export async function parseSingleMileage(
  voiceText: string
): Promise<{ miles: number; notes: string }> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 128,
    system: SINGLE_MILES_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: voiceText,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No response from Claude');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(textBlock.text.trim());
  } catch {
    throw new Error(
      'Could not understand your voice input. Please say the odometer number clearly.'
    );
  }

  if ('error' in parsed) {
    throw new Error(String(parsed.error));
  }

  const miles = Number(parsed.miles);
  if (!Number.isFinite(miles) || miles <= 0) {
    throw new Error(
      'Could not read the odometer number. Please try again.'
    );
  }

  return {
    miles,
    notes: String(parsed.notes ?? ''),
  };
}
