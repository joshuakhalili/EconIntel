/**
 * The Vercel entry point.
 *
 * Deliberately three lines. Everything that decides how the application
 * behaves lives in `src/server/app.js`, and every host imports that same file
 * — because the alternative, which Vercel's own documentation encourages, is
 * one function per endpoint, and that would break this app.
 *
 * WHY ONE FUNCTION AND NOT ONE PER ROUTE
 *
 * The routes here are order-dependent in ways that are invisible if you look
 * at any single one:
 *
 *   /api/me      is registered BEFORE `app.use('/api', requireReader())`, so a
 *                signed-out reader can ask whether they are signed in. Move it
 *                after the gate and it 401s, and the client can never discover
 *                that sign-in exists.
 *   /healthz     sits outside the gate for the same reason — a health check
 *                that requires a session reports a healthy service as broken.
 *   /waitlist    is answered before `express.static`, or the static handler
 *                serves the retired page first.
 *
 * Split into files, that ordering becomes a property of a directory listing.
 * One app, one function, and the order is the order in the source.
 *
 * The cost is that a request for `/api/status` boots the module that also
 * defines the news routes. That module is a few hundred lines of route
 * definitions over a shared pool; it is not the cold start worth optimising.
 */

export { app as default } from '../src/server/app.js';
