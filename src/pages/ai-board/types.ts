export interface ReferenceSlot { id: string; label: string; icon: string; imageUrl: string | null; }
export interface ShotCard { id: string; index: number; imageUrl: string | null; prompt: string; shotType: string; isGenerating: boolean; progress: number; error: string | null; }
export interface Project { id: string; title: string; aspectRatio: string; model: string; resolution: string; outputMode: 'image' | 'video'; shots: ShotCard[]; refSlots: ReferenceSlot[]; }

export const SHOT_TYPES = ['Wide Shot', 'Medium Shot', 'Close Up', 'Over Shoulder', 'Two Shot', 'POV', 'Aerial', 'Tracking'];
export const CREDITS_PER_CUT = 3;
