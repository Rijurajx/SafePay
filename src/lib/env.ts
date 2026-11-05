import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ENABLE_DEMO_PERSONAS: z.string().default('true').transform((val) => val === 'true'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default('https://mock-demo-auth.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default('demo-anon-key-placeholder'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('demo-service-key-placeholder'),
  AUTH_SECRET: z.string().min(16).default('protected-money-companion-super-secret-session-key-2026'),
  CRON_SECRET: z.string().default('demo-cron-secret-change-in-production'),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_DEMO_PERSONAS: process.env.ENABLE_DEMO_PERSONAS,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AUTH_SECRET: process.env.AUTH_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
});

