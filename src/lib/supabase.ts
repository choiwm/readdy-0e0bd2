import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'sb-session',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // NOTE: timeout 제거 — Edge Function (generate-image 등)이 내부적으로 최대 55초 대기하므로
  // 클라이언트 레벨 timeout이 있으면 응답 전에 abort 됨
});

export interface GalleryItemDB {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  model: string;
  ratio: string;
  liked: boolean;
  duration?: string | null;
  created_at: string;
  user_id: string;
  source?: string | null;
}

export interface AutomationProjectDB {
  id: string;
  title: string;
  topic: string;
  status: 'completed' | 'generating' | 'draft' | 'failed';
  duration: number;
  ratio: string;
  style: string;
  thumbnail: string;
  views: number;
  likes: number;
  model: string;
  mode: string;
  cuts: number;
  progress?: number | null;
  created_at: string;
  updated_at: string;
}
