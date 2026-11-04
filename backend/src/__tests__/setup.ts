// Keep backend tests independent of a developer's local PayPal .env settings.
process.env.PAYPAL_MODE = 'mock';
