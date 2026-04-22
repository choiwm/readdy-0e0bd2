import { useCredits } from '@/hooks/useCredits';

export const SOUND_COSTS = {
  tts_flash: 0,
  tts_v3: 2,
  sfx: 2,
  music: 6,
  transcribe: 3,
  clean_noise: 1,
  clean_isolate: 2,
  clean_separate: 4,
  sync: 1,
} as const;

export type SoundCostKey = keyof typeof SOUND_COSTS;

export function useSoundCredits() {
  const { credits, maxCredits, deduct, refund, canAfford } = useCredits();

  const deductSound = (key: SoundCostKey): boolean => {
    const cost = SOUND_COSTS[key];
    if (cost === 0) return true;
    return deduct(cost);
  };

  const canAffordSound = (key: SoundCostKey): boolean => {
    return canAfford(SOUND_COSTS[key]);
  };

  return { credits, maxCredits, deduct: deductSound, refund, canAfford: canAffordSound, SOUND_COSTS };
}
