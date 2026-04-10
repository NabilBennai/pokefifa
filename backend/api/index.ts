import { createConfiguredApp } from '../src/app-bootstrap';

let cachedHandler: ((req: unknown, res: unknown) => unknown) | null = null;

export default async function handler(req: unknown, res: unknown) {
  if (!cachedHandler) {
    const app = await createConfiguredApp();
    await app.init();
    cachedHandler = app.getHttpAdapter().getInstance();
  }

  const activeHandler = cachedHandler;
  if (!activeHandler) {
    throw new Error('Vercel handler failed to initialize.');
  }
  return activeHandler(req, res);
}
