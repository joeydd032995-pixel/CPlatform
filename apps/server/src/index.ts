import { loadEnv, logger } from '@cplatform/shared';
import { createApp } from './createApp.js';

// Local/traditional-host entrypoint: builds the app via createApp() (shared
// with the Vercel serverless entrypoint in api/index.ts) and binds it to a
// real listening socket. Vercel's entrypoint does the same setup but
// exports the app instead of calling listen(), since Vercel invokes it
// per-request rather than giving it a persistent socket.
createApp()
  .then((app) => {
    const { PORT } = loadEnv();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'apps/server listening');
    });
  })
  .catch((err) => {
    logger.error({ err }, 'Failed to start apps/server');
    process.exit(1);
  });
