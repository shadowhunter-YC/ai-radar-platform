export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      const { initScheduler } = await import('./lib/scheduler.mjs');
      initScheduler();
    } catch (err) {
      console.error('[Instrumentation] Failed to initialize scheduler:', err);
    }
  }
}
