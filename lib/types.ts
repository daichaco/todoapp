export type Priority = "high" | "mid" | "low";

export type Theme = {
  id: string;
  name: string;
};

export type Todo = {
  id: string;
  themeId: string;
  text: string;
  done: boolean;
  priority: Priority;
  due: string; // "YYYY-MM-DD" or ""
  dueTime: string; // "HH:mm" or "" (dueが空なら無視)
  category: string; // "" = 未分類
  deletedAt: number | null; // ゴミ箱に入れた時刻(ms)。null = 削除されていない
};

export type SortMode = "manual" | "priority" | "due";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  mid: "中",
  low: "低",
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  mid: 1,
  low: 2,
};

export const UNCATEGORIZED = "未分類";
