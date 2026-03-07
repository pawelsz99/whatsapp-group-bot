import cron from "node-cron";
import { sendEvent, EventDetails, sendMessage } from "./whatsapp";
import {
  logger,
  GROUP_JID,
  WEEKLY_EVENT_CRON_SCHEDULE,
  WEEKLY_EVENT_NAME,
  WEEKLY_EVENT_DESCRIPTION,
  WEEKLY_EVENT_HOUR,
  WEEKLY_EVENT_MINUTE,
  WEEKLY_EVENT_END_HOUR,
  WEEKLY_EVENT_END_MINUTE,
  LOG_GROUP_JID,
  DEBUG_MESSAGE_CRON_SCHEDULE,
  DEBUG_MODE,
} from "./config";

export async function runWeeklyEvent() {
  if (!GROUP_JID) {
    logger.info("Weekly event skipped: GROUP_JID not set");
    return;
  }

  const now = new Date();
  const eventDate = new Date(now);
  eventDate.setDate(now.getDate() + 1);
  eventDate.setHours(WEEKLY_EVENT_HOUR, WEEKLY_EVENT_MINUTE, 0, 0);

  let endTime: Date | undefined;
  if (
    WEEKLY_EVENT_END_HOUR !== undefined &&
    WEEKLY_EVENT_END_MINUTE !== undefined
  ) {
    endTime = new Date(eventDate);
    endTime.setHours(WEEKLY_EVENT_END_HOUR, WEEKLY_EVENT_END_MINUTE, 0, 0);
  }

  logger.info(
    `Running scheduled weekly event: ${WEEKLY_EVENT_NAME} at ${eventDate.toISOString()}`,
  );

  try {
    await sendEvent(GROUP_JID, {
      name: WEEKLY_EVENT_NAME,
      description: WEEKLY_EVENT_DESCRIPTION,
      startTime: eventDate,
      endTime,
    });
    logger.info("Weekly event sent successfully!");
  } catch (error) {
    logger.error(error, "Failed to send weekly event");
  }
}

export async function sendDebugMessage() {
  if (!DEBUG_MODE) {
    return;
  }

  logger.info(
    `Running scheduled debug message: at ${new Date().toISOString()} `,
  );

  if (!LOG_GROUP_JID) {
    logger.info("Debug message skipped: LOG_GROUP_JID not set");
    return;
  }

  try {
    await sendMessage(
      LOG_GROUP_JID,
      "This is a debug message sent at scheduled time.",
    );
    logger.info("Debug message sent successfully!");
  } catch (error) {
    logger.error(error, "Failed to send debug message");
  }
}

export function startScheduler() {
  logger.info(`Weekly event scheduler: ${WEEKLY_EVENT_CRON_SCHEDULE}`);
  logger.info(
    ` debug message scheduler: ${DEBUG_MESSAGE_CRON_SCHEDULE} only in debug mode: ${DEBUG_MODE}`,
  );

  cron.schedule(WEEKLY_EVENT_CRON_SCHEDULE, runWeeklyEvent);
  cron.schedule(DEBUG_MESSAGE_CRON_SCHEDULE, sendDebugMessage);
}
