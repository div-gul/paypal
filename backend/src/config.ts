import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend secrets first, then shared repository settings without overriding them.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_PATH: z.string().default('./data/shoppilot.db'),

  // PayPal Sandbox Integration
  PAYPAL_MODE: z.enum(['mock', 'sandbox', 'live']).default('mock'),
  ALLOW_LIVE_PAYMENTS: z.preprocess(value => value === 'true' || value === true, z.boolean()).default(false),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_BASE_URL: z.string().url().default('https://api-m.sandbox.paypal.com'),
  PAYPAL_CURRENCY: z.enum(['INR', 'USD']).default('INR'),
  PAYPAL_INR_PER_USD: z.preprocess(
    value => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.coerce.number().positive().optional()
  ),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().url().optional(),

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // LLM Configuration
  LLM_API_KEY: z.string().optional(),

}).superRefine((data, ctx) => {
  const paypalHost = new URL(data.PAYPAL_BASE_URL).hostname.toLowerCase();
  const sandboxHost = paypalHost === 'api-m.sandbox.paypal.com' || paypalHost === 'api.sandbox.paypal.com';
  const liveHost = paypalHost === 'api-m.paypal.com';
  if (!sandboxHost && !(data.PAYPAL_MODE === 'live' && data.ALLOW_LIVE_PAYMENTS && liveHost)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PAYPAL_BASE_URL'], message: 'Use the PayPal Sandbox API host; live payments require PAYPAL_MODE=live and ALLOW_LIVE_PAYMENTS=true.' });
  }
  if (data.PAYPAL_MODE === 'live' && (!data.ALLOW_LIVE_PAYMENTS || !liveHost)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ALLOW_LIVE_PAYMENTS'], message: 'Live payments require the live PayPal API host and ALLOW_LIVE_PAYMENTS=true.' });
  }
  if (data.PAYPAL_MODE !== 'mock') {
    if (!data.PAYPAL_CLIENT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYPAL_CLIENT_ID'],
        message: 'PAYPAL_CLIENT_ID is required when PAYPAL_MODE is "sandbox"',
      });
    }
    if (!data.PAYPAL_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYPAL_CLIENT_SECRET'],
        message: 'PAYPAL_CLIENT_SECRET is required when PAYPAL_MODE is "sandbox"',
      });
    }
    if (data.PAYPAL_CURRENCY === 'USD' && !data.PAYPAL_INR_PER_USD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYPAL_INR_PER_USD'],
        message: 'Set an explicit PAYPAL_INR_PER_USD conversion rate before charging in USD',
      });
    }
  }
  if (data.NODE_ENV === 'production') {
    for (const [key, value] of [['APP_BASE_URL', data.APP_BASE_URL], ['PUBLIC_APP_URL', data.PUBLIC_APP_URL || data.APP_BASE_URL]] as const) {
      if (new URL(value).protocol !== 'https:') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: `${key} must use HTTPS in production.` });
      }
    }
    if (data.PUBLIC_APP_URL && new URL(data.PUBLIC_APP_URL).origin !== new URL(data.APP_BASE_URL).origin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['PUBLIC_APP_URL'], message: 'PUBLIC_APP_URL and APP_BASE_URL must use the same origin.' });
    }
  }

});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function parseAppConfig(input: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = ConfigSchema.safeParse(input);
  if (!result.success) throw new Error('Invalid server configuration. Check your environment variables.');
  return result.data;
}

let cachedConfig: AppConfig | null = null;

function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  try {
    cachedConfig = parseAppConfig();
    return cachedConfig;
  } catch {
    console.error('❌ Configuration validation failed:');
    throw new Error('Fatal: Invalid server configuration. Check your environment variables.');
  }
}

export const config = loadConfig();
