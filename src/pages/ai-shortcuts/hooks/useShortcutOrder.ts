import { useState, useCallback, useEffect } from 'react';

const TOOL_ORDER_KEY = 'ai_shortcuts_order';
const CATEGORY_ORDER_KEY = 'ai_shortcuts_category_order';

type ToolOrder = Record<string, string[]>;

export function useShortcutOrder() {
  const [categoryOrder, setCategoryOrder] = useState<ToolOrder>({});
  const [categorySequence, setCategorySequence] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TOOL_ORDER_KEY);
      if (raw) setCategoryOrder(JSON.parse(raw) as ToolOrder);
    } catch {
      setCategoryOrder({});
    }
    try {
      const raw2 = localStorage.getItem(CATEGORY_ORDER_KEY);
      if (raw2) setCategorySequence(JSON.parse(raw2) as string[]);
    } catch {
      setCategorySequence([]);
    }
  }, []);

  // Save tool order within a category
  const saveOrder = useCallback((categoryId: string, toolNames: string[]) => {
    setCategoryOrder((prev) => {
      const updated = { ...prev, [categoryId]: toolNames };
      try {
        localStorage.setItem(TOOL_ORDER_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  // Save category sequence
  const saveCategorySequence = useCallback((ids: string[]) => {
    setCategorySequence(ids);
    try {
      localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(ids));
    } catch { /* ignore */ }
  }, []);

  // Sort tools within a category by saved order
  const getSortedTools = useCallback(
    <T extends { name: string }>(categoryId: string, tools: T[]): T[] => {
      const order = categoryOrder[categoryId];
      if (!order || order.length === 0) return tools;
      const orderMap = new Map(order.map((name, idx) => [name, idx]));
      return [...tools].sort((a, b) => {
        const ai = orderMap.has(a.name) ? orderMap.get(a.name)! : Infinity;
        const bi = orderMap.has(b.name) ? orderMap.get(b.name)! : Infinity;
        return ai - bi;
      });
    },
    [categoryOrder]
  );

  // Sort categories by saved sequence
  const getSortedCategories = useCallback(
    <T extends { id: string }>(categories: T[]): T[] => {
      if (categorySequence.length === 0) return categories;
      const seqMap = new Map(categorySequence.map((id, idx) => [id, idx]));
      return [...categories].sort((a, b) => {
        const ai = seqMap.has(a.id) ? seqMap.get(a.id)! : Infinity;
        const bi = seqMap.has(b.id) ? seqMap.get(b.id)! : Infinity;
        return ai - bi;
      });
    },
    [categorySequence]
  );

  return { saveOrder, saveCategorySequence, getSortedTools, getSortedCategories };
}
