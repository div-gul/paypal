import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from repository root .env or local .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_PATH: z.string().default('./data/shoppilot.db'),

  // PayPal Sandbox Integration
  PAYPAL_MODE: z.enum(['mock', 'sandbox']).default('mock'),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // LLM Configuration
  LLM_API_KEY: z.string().optional(),

  // Grocery Quote Source
  QUOTE_SOURCE: z.enum(['mock', 'channel3', 'hybrid']).default('mock'),
  CHANNEL3_API_KEY: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.PAYPAL_MODE === 'sandbox') {
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
  }

  if (data.QUOTE_SOURCE === 'channel3' || data.QUOTE_SOURCE === 'hybrid') {
    if (!data.CHANNEL3_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CHANNEL3_API_KEY'],
        message: `CHANNEL3_API_KEY is required when QUOTE_SOURCE is "${data.QUOTE_SOURCE}"`,
      });
    }
  }
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Configuration validation failed:');
    result.error.issues.forEach(issue => {
      console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
    });
    throw new Error('Fatal: Invalid server configuration. Check your environment variables.');
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export const config = loadConfig();
