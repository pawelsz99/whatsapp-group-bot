import P from "pino";
import * as fs from "fs";

export const logger = P({ level: "debug" });

export const PORT = process.env.PORT || 3000;
export const GROUP_JID = process.env.GROUP_JID || "";
export const LOG_GROUP_JID = process.env.LOG_GROUP_JID || "";
export const AUTH_DIR = "./auth_info";


// Weekly event configuration
export const WEEKLY_EVENT_CRON_SCHEDULE = process.env.WEEKLY_EVENT_CRON_SCHEDULE || "0 11 * * 3";
export const WEEKLY_EVENT_NAME = process.env.WEEKLY_EVENT_NAME || "Weekly Event";
export const WEEKLY_EVENT_DESCRIPTION =
  process.env.WEEKLY_EVENT_DESCRIPTION || "Join us this week!";
export const WEEKLY_EVENT_HOUR = parseInt(process.env.WEEKLY_EVENT_HOUR || "19");
export const WEEKLY_EVENT_MINUTE = parseInt(process.env.WEEKLY_EVENT_MINUTE || "0");
export const WEEKLY_EVENT_END_HOUR =
  (parseInt(process.env.WEEKLY_EVENT_END_HOUR || "0") || undefined);
export const WEEKLY_EVENT_END_MINUTE =
  (parseInt(process.env.WEEKLY_EVENT_END_MINUTE || "0") || undefined);

// DEBUG: Cron schedule for testing (every 10 minutes)
export const DEBUG_MESSAGE_CRON_SCHEDULE = process.env.DEBUG_MESSAGE_CRON_SCHEDULE || "*/10 * * * *";
export const DEBUG_MODE = process.env.DEBUG_MODE === "true";

export function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    logger.info("Creating auth directory");
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

export function cleanOldAuthData() {
  if (fs.existsSync(AUTH_DIR)) {
    logger.info("Deleting auth state");
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
}
