import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/protected_money_dev?schema=public'),
  DIRECT_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ENABLE_DEMO_PERSONAS: z.string().default('true').transform((val) => val === 'true'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default('https://mock-demo-auth.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default('demo-anon-key-placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('demo-service-key-placeholder'),
  AUTH_SECRET: z.string().min(16).default('protected-money-companion-super-secret-session-key-2026'),
  CRON_SECRET: z.string().default('demo-cron-secret-change-in-production'),
  GEMINI_API_KEY: z.string().optional(),
  PAYPAL_SANDBOX_CLIENT_ID: z.string().optional(),
  PAYPAL_SANDBOX_CLIENT_SECRET: z.string().optional(),
  PAYPAL_SANDBOX_MERCHANT_ID: z.string().optional(),
  PAYPAL_SANDBOX_MERCHANT_EMAIL: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/protected_money_dev?schema=public',
  DIRECT_URL: process.env.DIRECT_URL,
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_DEMO_PERSONAS: process.env.ENABLE_DEMO_PERSONAS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AUTH_SECRET: process.env.AUTH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PAYPAL_SANDBOX_CLIENT_ID: process.env.PAYPAL_SANDBOX_CLIENT_ID,
  PAYPAL_SANDBOX_CLIENT_SECRET: process.env.PAYPAL_SANDBOX_CLIENT_SECRET,
  PAYPAL_SANDBOX_MERCHANT_ID: process.env.PAYPAL_SANDBOX_MERCHANT_ID,
  PAYPAL_SANDBOX_MERCHANT_EMAIL: process.env.PAYPAL_SANDBOX_MERCHANT_EMAIL,
  PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
});

