/**
 * The long-lived server: bind a port, hold it open, close cleanly.
 *
 * This is everything `app.js` deliberately does not do. The split exists
 * because `app.listen` used to run as an import side effect, so any consumer
 * that merely wanted the routes — a test, a script, a serverless handler —
 * opened a port by looking at the file. On Vercel that is fatal rather than
 * untidy, since the platform imports the module and calls the handler itself.
 *
 * Keep this file boring. Anything that belongs to the application belongs in
 * `app.js`, or it will exist on one host and not the other.
 */

import { app } from './app.js';
import { config, describeIntegrations } from './config.js';
import { closePool } from './db/pool.js';

const server = app.listen(config.port, () => {
  console.log(`\n  Diffusion listening on http://localhost:${config.port}`);
  console.log(`  health: http://localhost:${config.port}/healthz\n`);

  const integrations = describeIntegrations();
  const ready = integrations.filter((i) => i.ready).length;
  console.log(`  ${ready}/${integrations.length} integrations configured\n`);
});

/**
 * Close the pool before exiting so in-flight queries finish and Postgres is not
 * left holding connections. A host sends SIGTERM on every redeploy, so without
 * this each deploy leaks connections until the database refuses new ones.
 */
async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  // Do not wait forever for a wedged connection to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };
