import express from "express";
import {
  getConnectionStatus,
  sendMessage,
  sendEvent,
  getGroups,
} from "./whatsapp";
import { runWeeklyEvent } from "./scheduler";
import {
  GROUP_JID,
  LOG_GROUP_JID,
  WEEKLY_EVENT_HOUR,
  WEEKLY_EVENT_MINUTE,
  PORT,
} from "./config";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  const timeStr =
    String(WEEKLY_EVENT_HOUR).padStart(2, "0") +
    ":" +
    String(WEEKLY_EVENT_MINUTE).padStart(2, "0");
  res.send(`
    <h1>WhatsApp Event Bot</h1>
    <p><a href="/qr">View QR Code</a></p>
    <p><a href="/status">Check Status</a></p>
    ${
      LOG_GROUP_JID
        ? `<p><strong>Log Group JID:</strong> ${LOG_GROUP_JID}</p>`
        : '<p style="color: red;">LOG_GROUP_JID not set</p>'
    }
    ${
      GROUP_JID
        ? `<p><strong>Group JID:</strong> ${GROUP_JID}</p>`
        : '<p style="color: red;">GROUP_JID not set</p>'
    }
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

app.get("/qr", (req, res) => {
  const { qrCodeDataUrl } = getConnectionStatus();
  if (!qrCodeDataUrl) {
    return res.send("Waiting for QR code... Refresh in a moment.");
  }
  res.send(`
    <h1>Scan QR Code</h1>
    <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 300px; height: 300px;">
    <p>WhatsApp → Settings → Linked Devices → Link Device</p>
  `);
});

app.get("/status", (req, res) => {
  const { isConnected } = getConnectionStatus();
  res.json({ connected: isConnected, jid: GROUP_JID || null });
});

app.get("/groups", async (req, res) => {
  try {
    const groups = await getGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post("/send", async (req, res) => {
  const { jid, message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  const targetJid = jid || GROUP_JID;
  if (!targetJid) return res.status(400).json({ error: "jid required" });

  try {
    await sendMessage(targetJid, message);
    res.json({ success: true, jid: targetJid });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post("/event", async (req, res) => {
  const { jid, name, description, startDate } = req.body;
  if (!name || !startDate) {
    return res.status(400).json({ error: "name and startDate required" });
  }
  const targetJid = jid || GROUP_JID;
  if (!targetJid) return res.status(400).json({ error: "jid required" });

  const eventDate = new Date(startDate);

  try {
    await sendEvent(targetJid, {
      name,
      description,
      startTime: eventDate,
    });
    res.json({ success: true, jid: targetJid, event: name });
  } catch (error: any) {
    res.status(500).json({ error: String(error), details: error.message });
  }
});

app.post("/api/weekly-event", async (req, res) => {
  try {
    await runWeeklyEvent();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: String(error) });
  }
});

export { app, PORT };
