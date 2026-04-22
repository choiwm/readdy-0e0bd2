function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Copy .env.example to .env and fill in the values.`
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  'VITE_PUBLIC_SUPABASE_URL',
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_ANON_KEY = required(
  'VITE_PUBLIC_SUPABASE_ANON_KEY',
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY,
);
