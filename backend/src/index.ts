import { createApp } from './app.js';
import { config } from './config.js';
import { getDatabase, closeDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

// Initialize and migrate database
const db = getDatabase();
console.log(`📦 Initializing SQLite database at: ${config.DATABASE_PATH}`);
runMigrations(db);
seedDatabase(db);
console.log('✅ Database migrations & seed completed.');

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`🚀 ShopPilot AI Backend running on http://localhost:${config.PORT}`);
  console.log(`   - Environment: ${config.NODE_ENV}`);
  console.log(`   - PayPal Mode: ${config.PAYPAL_MODE}`);
  console.log(`   - Quote Source: ${config.QUOTE_SOURCE}`);
  console.log(`   - Health check: http://localhost:${config.PORT}/api/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
