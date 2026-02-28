# WhatsApp Weekly Event Bot

A bot that creates real WhatsApp events in your group with "Going" / "Not Going" RSVP functionality.

## How It Works

- **WhatsApp Connection**: Uses Baileys library to connect to WhatsApp Web (no business account needed)
- **Real WhatsApp Events**: Creates native WhatsApp events that appear in the group
- **RSVP**: Group members can tap "Going" or "Not Going" directly in WhatsApp
- **Web Interface**: Simple UI to create events and send messages

## Tech Stack

- **Language**: TypeScript
- **WhatsApp Library**: `@whiskeysockets/baileys`
- **Server**: Express.js
- **Package Manager**: mise

## Requirements

- [mise](https://mise.jdx.dev/) - Version manager
- Regular WhatsApp account (personal works)
- Group must be part of a Community (for events feature)

## Setup

### 1. Install mise

```bash
# macOS / Linux
curl https://mise.jdx.dev/install.sh | sh

# or via brew
brew install mise
```

### 2. Clone & Install

```bash
git clone <your-repo>
cd whatsappbot

# Install dependencies
mise run -- npm install
```

### 3. Configure

Copy and edit `.env` file:

```bash
cp .env.example .env
```

Set your `GROUP_JID` in `.env`:
```
GROUP_JID=120363405829555887@g.us
CRON_SCHEDULE=0 11 * * 3
WEEKLY_EVENT_NAME=Weekly Event
WEEKLY_EVENT_DESCRIPTION=Join us this week!
```

### Cron Schedule Examples

- `0 11 * * 3` - Every Wednesday at 11:00 (default)
- `0 18 * * 5` - Every Friday at 18:00
- `0 10 * * 1` - Every Monday at 10:00

See https://crontab.guru/ for more

### 4. Run

```bash
mise run dev
```

### 5. Connect WhatsApp

1. Open http://localhost:3000/qr in your browser
2. Scan QR code with WhatsApp: Settings → Linked Devices → Link Device
3. Session saves automatically in `auth_info/` folder

## Web Interface

Visit http://localhost:3000 to:
- View QR code
- Send messages to group
- Create custom events
- Create weekly event (one click)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Web interface |
| GET | `/qr` | View QR code |
| GET | `/status` | Check connection status |
| GET | `/groups` | List all groups |
| POST | `/send` | Send message |
| POST | `/event` | Create custom event |
| POST | `/event/weekly` | Create weekly event (next day 19:00) |

### Examples

```bash
# Send a message
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'

# Create custom event
curl -X POST http://localhost:3000/event \
  -H "Content-Type: application/json" \
  -d '{"name": "Pizza Night", "description": "Bring snacks!", "startDate": "2026-03-15T19:00"}'

# Create weekly event (tomorrow at 19:00)
curl -X POST http://localhost:3000/event/weekly
```

## Event Request Format

For `/event` endpoint:

```json
{
  "jid": "120363405829555887@g.us",
  "name": "Pizza Night",
  "description": "Bring snacks!",
  "startDate": "2026-03-15T19:00"
}
```

## Deployment

### Render.com

1. Push code to GitHub
2. Create account at render.com
3. Create Web Service → connect repo
4. Build: `npm install`
5. Start: `npm run build && npm start`
6. Add `GROUP_JID` env var

### Fly.io

```bash
curl -L https://fly.io/install.sh | sh
fly launch
fly deploy
```

**Note**: Auth session needs persistent storage on cloud.

## Known Limitations

- Phone must be online for bot to work
- Group must be part of a Community for events
- WhatsApp may ban accounts using automation (use responsibly)
- Free hosting has limits (may sleep on inactivity)

## Troubleshooting

### Bot disconnects
- Check phone has internet
- Re-scan QR code

### Event creation fails
- Make sure group is in a Community
- Bot needs to be admin in the group

### Get Group JID
- Add bot to group
- Visit http://localhost:3000/groups
