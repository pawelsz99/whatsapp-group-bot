import 'dotenv/config';
import express from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const GROUP_JID = process.env.GROUP_JID || '';

let qrCodeUrl = '';
let qrCodeDataUrl = '';

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: 'auth_info' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', async (qr) => {
  qrCodeUrl = qr;
  qrCodeDataUrl = await QRCode.toDataURL(qr);
  console.log('QR Code ready! Open http://localhost:3000/qr in your browser');
});

client.on('ready', () => {
  console.log('✓ WhatsApp Client is ready!\n');
});

client.on('disconnected', () => {
  console.log('Client disconnected, reconnecting...');
});

async function sendMessage(jid: string, message: string) {
  await client.sendMessage(jid, message);
  console.log(`Message sent to ${jid}`);
}

app.get('/', (req, res) => {
  res.send(`
    <h1>WhatsApp Bot</h1>
    <p><a href="/qr">View QR Code</a></p>
    <p><a href="/status">Check Status</a></p>
    ${GROUP_JID ? `<p><strong>Group JID:</strong> ${GROUP_JID}</p>` : '<p style="color: red;">GROUP_JID not set in .env</p>'}
    <form action="/send" method="POST">
      <input name="jid" placeholder="Group JID (e.g. 123456789@g.us)" value="${GROUP_JID}" style="width: 300px">
      <input name="message" placeholder="Message" style="width: 300px">
      <button type="submit">Send</button>
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
    <p>Open WhatsApp → Settings → Linked Devices → Link Device</p>
  `);
});

app.get('/status', (req, res) => {
  const state = client.info ? 'Connected' : 'Not connected';
  res.send(`Status: ${state}`);
});

app.get('/groups', async (req, res) => {
  try {
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);
    res.json(groups.map(g => ({ name: g.name, jid: g.id._serialized })));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/send', async (req, res) => {
  console.log('Received body:', req.body);
  const { jid, message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message required', received: req.body });
  }
  const targetJid = jid || GROUP_JID;
  if (!targetJid) {
    return res.status(400).json({ error: 'jid required (set GROUP_JID in .env or pass in body)' });
  }
  try {
    await sendMessage(targetJid, message);
    res.json({ success: true, jid: targetJid });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/send-to-group', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message required' });
  }
  if (!GROUP_JID) {
    return res.status(400).json({ error: 'GROUP_JID not set in .env' });
  }
  try {
    await sendMessage(GROUP_JID, message);
    res.json({ success: true, jid: GROUP_JID });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

async function main() {
  console.log('Starting WhatsApp Client...');
  client.initialize();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

main();
