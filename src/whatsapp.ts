import { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  proto,
  WAMessageKey,
  WAMessageContent,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import {
  logger,
  AUTH_DIR,
  ensureAuthDir,
  cleanOldAuthData,
} from "./config";

export interface EventDetails {
  name: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
}

let sock: ReturnType<typeof makeWASocket> | null = null;
let isConnected = false;
let qrCodeDataUrl = "";

export function getConnectionStatus() {
  return { isConnected, qrCodeDataUrl };
}

export function getSock(): ReturnType<typeof makeWASocket> | null {
  return sock;
}

async function getMessage(
  key: WAMessageKey,
): Promise<WAMessageContent | undefined> {
  return proto.Message.create({ conversation: "placeholder" });
}

export async function connectWhatsApp(): Promise<ReturnType<typeof makeWASocket>> {
  ensureAuthDir();

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

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeDataUrl = await QRCode.toDataURL(qr);
      logger.info("QR Code ready! Open http://localhost:3000/qr");
    }

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        cleanOldAuthData();
        logger.info("Session invalidated, need to scan QR again");
      } else {
        logger.info("Reconnecting to WhatsApp...");
        connectWhatsApp();
      }
    } else if (connection === "open") {
      isConnected = true;
      qrCodeDataUrl = "";
      logger.info("WhatsApp connected!");
    }
  });

  return sock;
}

export async function sendMessage(jid: string, message: string) {
  if (!sock) {
    logger.error("Cannot send message, WhatsApp not connected");
    throw new Error("WhatsApp not connected");
  }
  await sock.sendMessage(jid, { text: message });
}

export async function sendEvent(jid: string, event: EventDetails) {
  if (!sock) {
    logger.error("Cannot send event, WhatsApp not connected");
    throw new Error("WhatsApp not connected");
  }

  const eventPayload: any = {
    event: {
      name: event.name,
      description: event.description || "",
      startDate: event.startTime,
    },
  };

  if (event.endTime) {
    eventPayload.event.endTime = String(
      Math.floor(event.endTime.getTime() / 1000),
    );
  }

  await sock.sendMessage(jid, eventPayload);
  logger.info(`Event sent to ${jid}: ${event.name}`);
}

export async function getGroups() {
  if (!sock) throw new Error("Not connected");
  const chats = await sock.groupFetchAllParticipating();
  return Object.values(chats).map((g) => ({
    name: g.subject,
    jid: g.id,
  }));
}
