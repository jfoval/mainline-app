// Set required env vars before any module is loaded so db.ts doesn't throw
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
