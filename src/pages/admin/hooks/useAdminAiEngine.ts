import { useCallback, useState } from 'react';
import type { PromptTemplate } from '../types';

const INITIAL_PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: 'PT-01', name: '유튜브 광고용 스크립트', category: '영상', model: 'GPT-4o', lastUpdated: '2026.04.10', usageCount: 8420, active: true },
  { id: 'PT-02', name: '음악 제작 마스터 프롬프트', category: '음악', model: 'Suno', lastUpdated: '2026.04.08', usageCount: 3210, active: true },
  { id: 'PT-03', name: '이미지 생성 기본 템플릿', category: '이미지', model: 'Stable Diffusion', lastUpdated: '2026.04.12', usageCount: 21840, active: true },
  { id: 'PT-04', name: '쇼츠 자동화 나레이션', category: '음성', model: 'ElevenLabs', lastUpdated: '2026.04.05', usageCount: 5670, active: true },
  { id: 'PT-05', name: '광고 카피라이팅 템플릿', category: '텍스트', model: 'GPT-4o', lastUpdated: '2026.04.01', usageCount: 2890, active: false },
];

export function useAdminAiEngine() {
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(INITIAL_PROMPT_TEMPLATES);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null | 'new'>('new' as const);
  const [promptEditOpen, setPromptEditOpen] = useState(false);

  const toggleTemplateActive = useCallback((id: string): PromptTemplate | undefined => {
    let previous: PromptTemplate | undefined;
    setPromptTemplates((prev) => {
      previous = prev.find((p) => p.id === id);
      return prev.map((pt) => (pt.id === id ? { ...pt, active: !pt.active } : pt));
    });
    return previous;
  }, []);

  const upsertTemplate = useCallback((template: PromptTemplate) => {
    setPromptTemplates((prev) => {
      const exists = prev.find((p) => p.id === template.id);
      if (exists) return prev.map((p) => (p.id === template.id ? template : p));
      return [...prev, template];
    });
  }, []);

  const openEditor = useCallback((template: PromptTemplate | null) => {
    setEditingTemplate(template ?? 'new');
    setPromptEditOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setPromptEditOpen(false);
    setEditingTemplate('new');
  }, []);

  return {
    promptTemplates,
    editingTemplate,
    promptEditOpen,
    toggleTemplateActive,
    upsertTemplate,
    openEditor,
    closeEditor,
  };
}
