# WhatsApp Weekly Event Bot

A simple bot that posts weekly events to a WhatsApp group with "Going" / "Not Going" RSVP functionality.

## How It Works

- **WhatsApp Connection**: Uses Baileys library to connect to WhatsApp Web (no business account needed)
- **Weekly Events**: Posts event message every week using node-cron scheduler
- **Interactive RSVP**: Sends message with inline buttons for "Going" / "Not Going"
- **Tracks Responses**: Stores RSVPs in a JSON file

## Tech Stack

- **Language**: TypeScript
- **WhatsApp Library**: Baileys (`@adiwajshing/baileys`)
- **Server**: Express.js
- **Scheduler**: node-cron
- **Hosting**: Render.com or Fly.io (free tier)

## Requirements

- [mise](https://mise.jdx.dev/) - Version manager for Node.js, etc.
- Regular WhatsApp account (personal account works)
- GitHub account (for deployment)

## Setup

### 1. Install mise

```bash
# macOS / Linux
curl https://mise.jdx.dev/install.sh | sh

# or via brew
brew install mise
```

### 2. Local Development

```bash
# Clone the repository
git clone <your-repo>
cd whatsappbot

# Install Node.js via mise
mise use -g node

# Install dependencies
mise run -- npm install

# Copy environment file
cp .env.example .env

# Edit .env with your settings
# - GROUP_JID: Your WhatsApp group JID (format: groupname@g.us)
# - CRON_SCHEDULE: Cron expression for when to post event
# - EVENT_MESSAGE: The event text to post

# Run the bot (uses mise to run with correct node version)
mise run dev
```

### 2. Connect WhatsApp

1. Run the bot locally
2. A QR code will appear in terminal
3. Scan it with your WhatsApp (Settings → Linked Devices → Link Device)
4. The session will be saved locally in `auth_info/` folder

### 3. Deploy to Cloud (Free)

#### Option A: Render.com

1. Push code to GitHub
2. Create account at render.com
3. Create new Web Service
4. Connect your GitHub repo
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Add environment variables in Render dashboard

#### Option B: Fly.io

1. Install flyctl: `curl -L https://fly.io/install.sh | sh`
2. Run `fly launch`
3. Follow prompts - choose "Yes" for HTTP service
4. Run `fly deploy`

**Note**: For cloud deployment, you'll need persistent storage for the auth session. Use Render's persistent disk or Fly's volume.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GROUP_JID` | WhatsApp group JID | `1234567890@g.us` |
| `CRON_SCHEDULE` | When to post event (default: every Friday 6pm) | `0 18 * * 5` |
| `EVENT_TITLE` | Event title | `Friday Pizza Night` |
| `EVENT_MESSAGE` | Full event message text | See .env.example |

## Cron Schedule Examples

- `0 18 * * 5` - Every Friday at 6 PM
- `0 10 * * 1` - Every Monday at 10 AM
- `0 12 1 * *` - First day of every month at noon

## Project Structure

```
whatsappbot/
├── src/
│   ├── index.ts          # Main entry point
│   ├── bot.ts            # WhatsApp bot logic
│   ├── scheduler.ts      # Weekly event scheduler
│   ├── rsvp.ts           # Handle RSVP responses
│   └── storage.ts        # JSON file storage
├── auth_info/            # WhatsApp session (auto-generated)
├── .env                 # Your settings
├── package.json
└── tsconfig.json
```

## Bot Features

1. **Weekly Event Post**: Automatically posts to group at scheduled time
2. **Interactive Buttons**: Users click "Going" or "Not Going"
3. **RSVP Tracking**: Stores who responded
4. **Session Persistence**: Stays connected across restarts

## Known Limitations

- Uses WhatsApp Web protocol (your phone must be online for bot to work)
- Free hosting has limits (sleep on inactivity, limited hours)
- WhatsApp may ban accounts using automation (use responsibly)

## Troubleshooting

### Bot goes offline
- Check that your phone has internet connection
- Re-scan QR code if session expired

### Messages not sending
- Verify GROUP_JID is correct
- Make sure bot was invited to the group

### Deployment issues
- Ensure persistent storage is configured for auth session
- Check hosting provider logs
