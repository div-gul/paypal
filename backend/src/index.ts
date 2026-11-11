import { createApp } from './app.js';
import { config } from './config.js';
import { getDatabase, closeDatabase } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { AuthService } from './services/AuthService.js';
import { seedProductCatalog } from './db/productCatalog.js';

// Initialize and migrate database
const db = getDatabase();
console.log('📦 Initializing SQLite database');
runMigrations(db);
seedProductCatalog(db);
const isDemoAllowed = config.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true' || Boolean(process.env.RENDER) || Boolean(process.env.RENDER_EXTERNAL_URL);
if (isDemoAllowed) {
  const guestAlreadySeeded = db.prepare('SELECT 1 FROM users WHERE LOWER(email) = ?').get('guest_paypal@example.com');
  if (!guestAlreadySeeded) seedDatabase(db);
  new AuthService(db).seedGuest();
}
console.log('✅ Database migrations & seed completed.');

const app = createApp();

const server = app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`🚀 ShopPilot AI Backend running on http://localhost:${config.PORT}`);
  console.log(`   - Environment: ${config.NODE_ENV}`);
  console.log(`   - PayPal Mode: ${config.PAYPAL_MODE}`);
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
