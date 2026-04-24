import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminAiEngine } from './useAdminAiEngine';

describe('useAdminAiEngine', () => {
  it('seeds prompt templates and starts with editor closed', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    expect(result.current.promptTemplates.length).toBeGreaterThan(0);
    expect(result.current.promptEditOpen).toBe(false);
    expect(result.current.editingTemplate).toBe('new');
  });

  it('toggleTemplateActive flips the active flag and returns the previous template', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    const target = result.current.promptTemplates[0];
    const wasActive = target.active;

    let returned: ReturnType<typeof result.current.toggleTemplateActive>;
    act(() => { returned = result.current.toggleTemplateActive(target.id); });

    expect(returned!.id).toBe(target.id);
    expect(returned!.active).toBe(wasActive);
    const updated = result.current.promptTemplates.find((p) => p.id === target.id)!;
    expect(updated.active).toBe(!wasActive);
  });

  it('upsertTemplate updates an existing template by id', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    const target = result.current.promptTemplates[0];

    act(() => {
      result.current.upsertTemplate({ ...target, name: '새 이름' });
    });

    const updated = result.current.promptTemplates.find((p) => p.id === target.id)!;
    expect(updated.name).toBe('새 이름');
    expect(result.current.promptTemplates.length).toBe(5);
  });

  it('upsertTemplate appends when id is new', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    const initialCount = result.current.promptTemplates.length;

    act(() => {
      result.current.upsertTemplate({
        id: 'PT-99',
        name: '신규',
        category: '텍스트',
        model: 'GPT-4o',
        lastUpdated: '2026.04.22',
        usageCount: 0,
        active: true,
      });
    });

    expect(result.current.promptTemplates).toHaveLength(initialCount + 1);
    expect(result.current.promptTemplates.at(-1)?.id).toBe('PT-99');
  });

  it('openEditor with template sets editing target and opens modal', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    const target = result.current.promptTemplates[0];

    act(() => { result.current.openEditor(target); });

    expect(result.current.promptEditOpen).toBe(true);
    expect(result.current.editingTemplate).toEqual(target);
  });

  it('openEditor with null defaults editingTemplate to "new"', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    act(() => { result.current.openEditor(null); });

    expect(result.current.promptEditOpen).toBe(true);
    expect(result.current.editingTemplate).toBe('new');
  });

  it('closeEditor closes modal and resets editingTemplate', () => {
    const { result } = renderHook(() => useAdminAiEngine());
    act(() => { result.current.openEditor(result.current.promptTemplates[0]); });
    act(() => { result.current.closeEditor(); });

    expect(result.current.promptEditOpen).toBe(false);
    expect(result.current.editingTemplate).toBe('new');
  });
});
