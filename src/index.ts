import "dotenv/config";
import { connectWhatsApp } from "./whatsapp";
import { app, PORT } from "./routes";
import { startScheduler } from "./scheduler";
import { logger } from "./config";

async function main() {
  logger.info("Connecting to WhatsApp...");
  await connectWhatsApp();

  startScheduler();

  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

main();
