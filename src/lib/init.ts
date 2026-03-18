import { initializeDatabase } from './schema';

let initialized = false;

export async function ensureDb() {
  if (!initialized) {
    await initializeDatabase();
    initialized = true;
  }
}
