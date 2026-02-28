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

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const GROUP_JID = process.env.GROUP_JID || '';
const LOG_GROUP_JID = process.env.LOG_GROUP_JID || '';

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
      const QRCode = await import('qrcode');
      qrCodeDataUrl = await QRCode.default.toDataURL(qr);
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
  startTime: number;
  endTime?: number;
  location?: string;
}

async function sendEvent(jid: string, event: EventDetails) {
  if (!sock) throw new Error('WhatsApp not connected');

  const startTime = new Date(event.startTime);
  await sock.sendMessage(jid,  { event: { name: event.name, description: event.description || '', startDate: startTime } });
  console.log(`Event sent to ${jid}: ${event.name}`);
}

app.get('/', (req, res) => {
  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 16);
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
      <label>Date & Time:</label><br>
      <input type="datetime-local" name="startTime" style="width: 300px"><br><br>
      <input name="location" placeholder="Location (optional)" style="width: 300px"><br><br>
      <button type="submit">Create Event</button>
    </form>
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
  const { jid, name, description, startTime, location } = req.body;
  if (!name || !startTime) {
    return res.status(400).json({ error: 'name and startTime required' });
  }
  const targetJid = jid || GROUP_JID;
  if (!targetJid) return res.status(400).json({ error: 'jid required' });

  const timestamp = Math.floor(new Date(startTime).getTime() / 1000);

  try {
    console.log('Sending event:', { name, description, startTime: timestamp, location, jid: targetJid });
    await sendEvent(targetJid, {
      name,
      description,
      startTime: timestamp,
      location
    });
    res.json({ success: true, jid: targetJid, event: name });
  } catch (error: any) {
    console.error('Event error:', error);
    res.status(500).json({ error: String(error), details: error.message });
  }
});

async function main() {
  console.log('Connecting to WhatsApp...');
  await connectWhatsApp();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
