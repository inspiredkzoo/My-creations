# Mileage Tracker

A voice-enabled Progressive Web App (PWA) for logging business and personal vehicle miles directly to Google Sheets.

## How It Works

1. Open the app on your phone
2. Toggle **Business** or **Personal**
3. Hold the mic button and say your trip (e.g. *"Started at 45,231, ended at 45,412, client meeting downtown"*)
4. Release — Claude AI parses your speech and logs the trip to Google Sheets automatically

## Google Sheets Output

Each trip creates a row with these columns:

| Date | Trip Type | Start Miles | End Miles | Miles Driven | Purpose/Notes | Logged At |
|------|-----------|-------------|-----------|--------------|---------------|-----------|
| 2026-04-15 | Business | 45231 | 45412 | 181 | client meeting downtown | 2026-04-15T... |

---

## Setup Guide

### Step 1 — Get an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and generate an API key
3. Save it — you'll need it in Step 4

### Step 2 — Set Up Google Sheets

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name the first tab **Sheet1** (it usually is by default)
3. Add this header row in Row 1:

   ```
   A1: Date
   B1: Trip Type
   C1: Start Miles
   D1: End Miles
   E1: Miles Driven
   F1: Purpose/Notes
   G1: Logged At
   ```

4. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_LONG_STRING`**`/edit`

### Step 3 — Create a Google Service Account

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (e.g. "mileage-tracker")
3. Go to **APIs & Services → Enable APIs** and enable **Google Sheets API**
4. Go to **APIs & Services → Credentials → Create Credentials → Service Account**
5. Name it anything (e.g. "mileage-writer"), click through to finish
6. Click on the service account → **Keys** tab → **Add Key → Create new key → JSON**
7. Download the JSON file — open it and copy:
   - `client_email` → this is your `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → this is your `GOOGLE_PRIVATE_KEY`
8. Back in Google Sheets, click **Share** on your spreadsheet and share it with the service account email, giving it **Editor** access

### Step 4 — Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

```env
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_SERVICE_ACCOUNT_EMAIL=mileage-writer@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
```

### Step 5 — Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone (must be on the same Wi-Fi network — use your computer's local IP address instead of localhost).

### Step 6 — Deploy to Vercel (Recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import your repo
3. Under **Environment Variables**, add the four variables from `.env.local`
   - For `GOOGLE_PRIVATE_KEY`, paste the full key including the `-----BEGIN...-----` headers
4. Click **Deploy**
5. Vercel gives you a public URL — open it on your phone and tap **Add to Home Screen** for a native-app feel

---

## Voice Examples

The app understands natural speech:

- *"Start 45231 end 45412"*
- *"Started at 45,231, ended at 45,412, dentist appointment"*
- *"Odometer was 45231 at start, 45412 at end, March 15th"*
- *"Begin mileage 45231 finish 45412 trip to warehouse"*

If you don't mention a date, today's date is used automatically.

---

## Browser Support

| Browser | Voice Input |
|---------|-------------|
| Chrome (Android) | Full support |
| Safari (iOS 16.4+) | Full support |
| Samsung Internet | Full support |
| Firefox | Not supported |

---

## Tech Stack

- [Next.js 14](https://nextjs.org) — full-stack React framework
- [Tailwind CSS](https://tailwindcss.com) — mobile-first styling
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — browser-native voice recognition (no extra cost)
- [Claude Haiku](https://anthropic.com) — AI parsing of natural language (~$0.0002 per trip)
- [Google Sheets API](https://developers.google.com/sheets/api) — trip data storage
