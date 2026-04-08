import { createConfiguredApp } from './app-bootstrap';

async function bootstrap() {
  const app = await createConfiguredApp();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
