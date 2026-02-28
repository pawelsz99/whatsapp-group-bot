import 'dotenv/config';
import express from 'express';
import { Boom } from '@hapi/boom';
import makeWASocket, { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState, 
  makeCacheableSignalKeyStore,
  proto,
  WAMessageKey,
  WAMessageContent
} from '@whiskeysockets/baileys';
import P from 'pino';
import * as fs from 'fs';
import QRCode from 'qrcode';
import cron from 'node-cron';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const GROUP_JID = process.env.GROUP_JID || '';
const LOG_GROUP_JID = process.env.LOG_GROUP_JID || '';

// Weekly event scheduler settings
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 11 * * 3'; // Every Wednesday at 11:00
const WEEKLY_EVENT_NAME = process.env.WEEKLY_EVENT_NAME || 'Weekly Event';
const WEEKLY_EVENT_DESCRIPTION = process.env.WEEKLY_EVENT_DESCRIPTION || 'Join us this week!';
const WEEKLY_EVENT_HOUR = parseInt(process.env.WEEKLY_EVENT_HOUR || '19');
const WEEKLY_EVENT_MINUTE = parseInt(process.env.WEEKLY_EVENT_MINUTE || '0');
const WEEKLY_EVENT_END_HOUR = parseInt(process.env.WEEKLY_EVENT_END_HOUR || '0') || undefined;
const WEEKLY_EVENT_END_MINUTE = parseInt(process.env.WEEKLY_EVENT_END_MINUTE || '0') || undefined;

const AUTH_DIR = './auth_info';
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

const logger = P({ level: 'debug' });

let sock: ReturnType<typeof makeWASocket> | null = null;
let isConnected = false;
let qrCodeDataUrl = '';

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    getMessage,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeDataUrl = await QRCode.toDataURL(qr);
      console.log('QR Code ready! Open http://localhost:3000/qr');
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        connectWhatsApp();
      }
    } else if (connection === 'open') {
      isConnected = true;
      console.log('✓ WhatsApp connected!');
    }
  });

  return sock;
}

async function getMessage(key: WAMessageKey): Promise<WAMessageContent | undefined> {
  return proto.Message.create({ conversation: 'placeholder' });
}

async function sendMessage(jid: string, message: string) {
  if (!sock) throw new Error('WhatsApp not connected');
  await sock.sendMessage(jid, { text: message });
}

interface EventDetails {
  name: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
}

async function sendEvent(jid: string, event: EventDetails) {
  if (!sock) throw new Error('WhatsApp not connected');

  const eventPayload: any = { 
    event: { 
      name: event.name, 
      description: event.description || '', 
      startDate: event.startTime
    } 
  };

  if (event.endTime) {
    eventPayload.event.endTime = String(Math.floor(event.endTime.getTime() / 1000));
  }

  await sock.sendMessage(jid, eventPayload);
  console.log(`Event sent to ${jid}: ${event.name}`);
}

app.get('/', (req, res) => {
    const timeStr = String(WEEKLY_EVENT_HOUR).padStart(2, '0') + ':' + String(WEEKLY_EVENT_MINUTE).padStart(2, '0');
    res.send(`
    <h1>WhatsApp Event Bot</h1>
    <p><a href="/qr">View QR Code</a></p>
    <p><a href="/status">Check Status</a></p>
    ${LOG_GROUP_JID ? `<p><strong>Log Group JID:</strong> ${LOG_GROUP_JID}</p>` : '<p style="color: red;">LOG_GROUP_JID not set</p>'}
    ${GROUP_JID ? `<p><strong>Group JID:</strong> ${GROUP_JID}</p>` : '<p style="color: red;">GROUP_JID not set</p>'}
    <hr>
    <h3>Send Message</h3>
    <form action="/send" method="POST">
      <input name="jid" placeholder="Group JID" value="${GROUP_JID}" style="width: 300px"><br><br>
      <input name="message" placeholder="Message" style="width: 300px"><br><br>
      <button type="submit">Send</button>
    </form>
    <hr>
    <h3>Create Event</h3>
    <form action="/event" method="POST">
      <input name="jid" placeholder="Group JID" value="${GROUP_JID}" style="width: 300px"><br><br>
      <input name="name" placeholder="Event Name (e.g. Pizza Night)" style="width: 300px"><br><br>
      <input name="description" placeholder="Description" style="width: 300px"><br><br>
      <label for="startDate">Start time:</label>
      <input
        type="datetime-local"
        id="startDate"
        name="startDate"
        step="60"
        style="width: 300px"
      />
      <br><br>
      <button type="submit">Create Event</button>
    </form>
    <hr>
    <h3>Weekly Event</h3>
    <button onclick="createWeeklyEvent()">Create Weekly Event (Tomorrow ${timeStr})</button>
    <p id="weeklyResult"></p>
    <script>
      async function createWeeklyEvent() {
        const btn = document.querySelector('button[onclick="createWeeklyEvent()"]');
        btn.disabled = true;
        btn.textContent = 'Creating...';
        try {
          const res = await fetch('/api/weekly-event', { method: 'POST' });
          const data = await res.json();
          document.getElementById('weeklyResult').textContent = data.success ? 'Event created!' : 'Error: ' + data.error;
        } catch(e) {
          document.getElementById('weeklyResult').textContent = 'Error: ' + e.message;
        }
        btn.disabled = false;
        btn.textContent = 'Create Weekly Event (Tomorrow ${timeStr})';
      }
    </script>
  `);
});

app.get('/qr', (req, res) => {
  if (!qrCodeDataUrl) {
    return res.send('Waiting for QR code... Refresh in a moment.');
  }
  res.send(`
    <h1>Scan QR Code</h1>
    <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 300px; height: 300px;">
    <p>WhatsApp → Settings → Linked Devices → Link Device</p>
  `);
});

app.get('/status', (req, res) => {
  res.json({ connected: isConnected, jid: GROUP_JID || null });
});

app.get('/groups', async (req, res) => {
  if (!sock) return res.status(500).json({ error: 'Not connected' });
  try {
    const chats = await sock.groupFetchAllParticipating();
    const groups = Object.values(chats).map(g => ({ name: g.subject, jid: g.id }));
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/send', async (req, res) => {
  const { jid, message } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });
  const targetJid = jid || GROUP_JID;
  if (!targetJid) return res.status(400).json({ error: 'jid required' });

  try {
    await sendMessage(targetJid, message);
    res.json({ success: true, jid: targetJid });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/event', async (req, res) => {
  const { jid, name, description, startDate } = req.body;
  if (!name || !startDate) {
    return res.status(400).json({ error: 'name and startDate required' });
  }
  const targetJid = jid || GROUP_JID;
  if (!targetJid) return res.status(400).json({ error: 'jid required' });

  const eventDate = new Date(startDate);


  try {
    console.log('Sending event:', { name, description, startTime: eventDate, jid: targetJid });
    await sendEvent(targetJid, {
      name,
      description,
      startTime: eventDate
    });
    res.json({ success: true, jid: targetJid, event: name });
  } catch (error: any) {
    console.error('Event error:', error);
    res.status(500).json({ error: String(error), details: error.message });
  }
});

app.post('/api/weekly-event', async (req, res) => {
  try {
    await runWeeklyEvent();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: String(error) });
  }
});

async function runWeeklyEvent() {
  if (!GROUP_JID) {
    console.log('Weekly event skipped: GROUP_JID not set');
    return;
  }

  const now = new Date();
  const eventDate = new Date(now);
  eventDate.setDate(now.getDate() + 1);
  eventDate.setHours(WEEKLY_EVENT_HOUR, WEEKLY_EVENT_MINUTE, 0, 0);

  let endTime: Date | undefined;
  if (WEEKLY_EVENT_END_HOUR !== undefined && WEEKLY_EVENT_END_MINUTE !== undefined) {
    endTime = new Date(eventDate);
    endTime.setHours(WEEKLY_EVENT_END_HOUR, WEEKLY_EVENT_END_MINUTE, 0, 0);
  }

  console.log(`Running scheduled weekly event: ${WEEKLY_EVENT_NAME} at ${eventDate.toISOString()}`);

  try {
    await sendEvent(GROUP_JID, {
      name: WEEKLY_EVENT_NAME,
      description: WEEKLY_EVENT_DESCRIPTION,
      startTime: eventDate,
      endTime
    });
    console.log('Weekly event sent successfully!');
  } catch (error) {
    console.error('Failed to send weekly event:', error);
  }
}

async function main() {
  console.log('Connecting to WhatsApp...');
  await connectWhatsApp();

  // Schedule weekly event
  console.log(`Weekly event scheduler: ${CRON_SCHEDULE}`);
  cron.schedule(CRON_SCHEDULE, runWeeklyEvent);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
