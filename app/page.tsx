"use client";

import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ProgressChart from "@/components/ProgressChart";
import { makeSample } from "@/lib/sample";
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  Priority,
  SortMode,
  Theme,
  Todo,
  UNCATEGORIZED,
} from "@/lib/types";

const STORAGE_KEY = "todo-app:items";
const THEMES_KEY = "todo-app:themes";
const COLLAPSED_KEY = "todo-app:collapsed";

const todayStr = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

const formatDeleted = (ms: number) => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
};

const formatDue = (due: string, dueTime: string) => {
  const [, m, d] = due.split("-");
  return `${Number(m)}/${Number(d)}${dueTime ? ` ${dueTime}` : ""}`;
};

// 時刻未設定の締切は、その日の終わりまで有効
const isOverdue = (t: Todo, now: Date) => {
  if (t.done || !t.due) return false;
  const end = new Date(`${t.due}T${t.dueTime || "23:59"}:00`);
  if (!t.dueTime) end.setSeconds(59, 999);
  return end.getTime() < now.getTime();
};

// サンプルデータは開発時（npm run dev）だけ使う
const IS_DEV = process.env.NODE_ENV === "development";
const ALL = "all";
const TRASH = "trash";

type Draft = {
  text: string;
  themeId: string;
  priority: Priority;
  due: string;
  dueTime: string;
  category: string;
};

const normalizeThemes = (raw: unknown): Theme[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t.id === "string" && typeof t.name === "string")
    .map((t) => ({ id: t.id, name: t.name }));
};

const normalize = (raw: unknown, themes: Theme[]): Todo[] => {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(themes.map((t) => t.id));
  return raw
    .filter((t) => t && typeof t.id === "string" && typeof t.text === "string")
    .map((t) => ({
      id: t.id,
      themeId: ids.has(t.themeId) ? t.themeId : themes[0].id,
      text: t.text,
      done: Boolean(t.done),
      priority: (["high", "mid", "low"] as const).includes(t.priority)
        ? t.priority
        : "mid",
      due: typeof t.due === "string" ? t.due : "",
      dueTime: typeof t.dueTime === "string" ? t.dueTime : "",
      category: typeof t.category === "string" ? t.category : "",
      deletedAt: typeof t.deletedAt === "number" ? t.deletedAt : null,
    }));
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeId, setActiveId] = useState("");
  const [addingTheme, setAddingTheme] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [text, setText] = useState("");
  const [priority, setPriority] = useState<Priority>("mid");
  const [due, setDue] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [category, setCategory] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; pos: "before" | "after" } | null>(
    null
  );
  const groupsEl = useRef<HTMLDivElement>(null);
  const settleId = useRef<string | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const [settle, setSettle] = useState(false);
  const [movedId, setMovedId] = useState<string | null>(null);
  const headDragId = useRef<string | null>(null);
  const endAnchor = useRef<{ id: string; top: number } | null>(null);
  const dragAnchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  const [lockHeight, setLockHeight] = useState<number | null>(null);
  const [formThemeId, setFormThemeId] = useState("");
  const [quickId, setQuickId] = useState<string | null>(null);
  const [quickText, setQuickText] = useState("");
  const quickEl = useRef<HTMLFormElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [themeDragId, setThemeDragId] = useState<string | null>(null);
  const [themeOver, setThemeOver] = useState<{
    id: string;
    pos: "before" | "after";
  } | null>(null);
  const itemEls = useRef(new Map<string, HTMLLIElement>());
  const prevTops = useRef(new Map<string, number>());

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [sort, setSort] = useState<SortMode>("manual");

  const [enterId, setEnterId] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let ts: Theme[] = [];
    let items: unknown = null;
    try {
      const rc = localStorage.getItem(COLLAPSED_KEY);
      if (rc) {
        const arr = JSON.parse(rc);
        if (Array.isArray(arr)) setCollapsed(new Set(arr.filter((x) => typeof x === "string")));
      }
    } catch {}
    try {
      const rt = localStorage.getItem(THEMES_KEY);
      const ri = localStorage.getItem(STORAGE_KEY);
      if (rt) ts = normalizeThemes(JSON.parse(rt));
      if (ri) items = JSON.parse(ri);
    } catch {}

    if (ts.length === 0) {
      if (Array.isArray(items) && items.length > 0) {
        // テーマ導入前のデータは「一般」に入れる
        ts = [{ id: crypto.randomUUID(), name: "一般" }];
      } else if (IS_DEV) {
        const sample = makeSample();
        setThemes(sample.themes);
        setTodos(sample.todos);
        setActiveId(sample.themes[0].id);
        setLoaded(true);
        return;
      } else {
        ts = [{ id: crypto.randomUUID(), name: "一般" }];
      }
    }
    setThemes(ts);
    setTodos(normalize(items, ts));
    setActiveId(ts[0].id);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
      localStorage.setItem(THEMES_KEY, JSON.stringify(themes));
    } catch {}
  }, [todos, themes, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
    } catch {}
  }, [collapsed, loaded]);

  // ドラッグ中、画面の上下端に近づいたらスクロールする
  const dragging = dragId !== null || themeDragId !== null;
  useEffect(() => {
    if (!dragging) return;
    const EDGE = 90;
    const MAX = 18;
    let y: number | null = null;
    let raf = 0;
    const onOver = (e: DragEvent) => {
      y = e.clientY;
    };
    const tick = () => {
      if (y !== null) {
        const h = window.innerHeight;
        if (y < EDGE) window.scrollBy(0, -Math.ceil(MAX * (1 - Math.max(y, 0) / EDGE)));
        else if (y > h - EDGE)
          window.scrollBy(0, Math.ceil(MAX * (1 - Math.max(h - y, 0) / EDGE)));
      }
      raf = requestAnimationFrame(tick);
    };
    document.addEventListener("dragover", onOver);
    raf = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("dragover", onOver);
      cancelAnimationFrame(raf);
    };
  }, [dragging]);

  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const isAll = activeId === ALL;
  const isTrash = activeId === TRASH;
  const activeTheme =
    isAll || isTrash ? undefined : themes.find((t) => t.id === activeId) ?? themes[0];
  const live = useMemo(() => todos.filter((t) => !t.deletedAt), [todos]);
  const trashed = useMemo(
    () =>
      todos
        .filter((t) => t.deletedAt)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [todos]
  );
  const themeTodos = useMemo(
    () => (isAll ? live : live.filter((t) => t.themeId === activeTheme?.id)),
    [live, activeTheme, isAll]
  );

  const categories = useMemo(
    () => [...new Set(themeTodos.map((t) => t.category).filter(Boolean))],
    [themeTodos]
  );

  // フィルタ中のカテゴリが無くなったら「すべて」に戻す
  useEffect(() => {
    if (filterCategory !== "all" && !categories.includes(filterCategory)) {
      setFilterCategory("all");
    }
  }, [categories, filterCategory]);

  const visible = useMemo(() => {
    const list = themeTodos.filter(
      (t) =>
        (filterCategory === "all" || t.category === filterCategory) &&
        (filterPriority === "all" || t.priority === filterPriority)
    );
    if (sort === "priority") {
      return [...list].sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
    }
    if (sort === "due") {
      return [...list].sort((a, b) => {
        if (!a.due && !b.due) return 0;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return (a.due + (a.dueTime || "99:99")).localeCompare(
          b.due + (b.dueTime || "99:99")
        );
      });
    }
    return list;
  }, [themeTodos, filterCategory, filterPriority, sort]);

  // 「すべて」表示ではフォームで追加先のテーマを選ぶ
  const formTheme = isAll
    ? themes.find((t) => t.id === formThemeId) ?? themes[0]
    : activeTheme;

  // 追加アニメーションは一度だけ。残しておくと、収納→再表示のたびに再生されてしまう
  const flashEnter = (id: string) => {
    setEnterId(id);
    setTimeout(() => setEnterId((cur) => (cur === id ? null : cur)), 400);
  };

  const quickAdd = (e: FormEvent) => {
    e.preventDefault();
    const value = quickText.trim();
    if (!value || !quickId) return;
    const id = crypto.randomUUID();
    setTodos((prev) => [
      {
        id,
        themeId: quickId,
        text: value,
        done: false,
        priority: "mid",
        due: "",
        dueTime: "",
        category: "",
        deletedAt: null,
      },
      ...prev,
    ]);
    flashEnter(id);
    setQuickText("");
  };

  const openQuickAdd = (themeId: string) => {
    setQuickId(themeId);
    setQuickText("");
    setCollapsed((prev) => {
      if (!prev.has(themeId)) return prev;
      const next = new Set(prev);
      next.delete(themeId);
      return next;
    });
  };

  const addTodo = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (!formTheme) return;
    const id = crypto.randomUUID();
    setTodos((prev) => [
      {
        id,
        themeId: formTheme.id,
        text: value,
        done: false,
        priority,
        due,
        dueTime: due ? dueTime : "",
        category: category.trim(),
        deletedAt: null,
      },
      ...prev,
    ]);
    flashEnter(id);
    setText("");
    setDue("");
    setDueTime("");
  };

  const startEdit = (t: Todo) => {
    setEditingId(t.id);
    setDraft({
      text: t.text,
      themeId: t.themeId,
      priority: t.priority,
      due: t.due,
      dueTime: t.dueTime,
      category: t.category,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingId || !draft) return;
    const value = draft.text.trim();
    if (!value) return;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === editingId
          ? {
              ...t,
              text: value,
              themeId: draft.themeId,
              priority: draft.priority,
              due: draft.due,
              dueTime: draft.due ? draft.dueTime : "",
              category: draft.category.trim(),
            }
          : t
      )
    );
    cancelEdit();
  };

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    setPopId(id);
    setTimeout(() => setPopId((cur) => (cur === id ? null : cur)), 500);
  };

  const deleteTodo = (id: string) => {
    setLeaving((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, deletedAt: Date.now() } : t))
      );
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 220);
  };

  const restoreTodo = (id: string) =>
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, deletedAt: null } : t)));

  const purgeTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const emptyTrash = () => {
    if (!window.confirm(`ゴミ箱の ${trashed.length} 件を完全に削除しますか？`)) return;
    setTodos((prev) => prev.filter((t) => !t.deletedAt));
  };

  // 表示中のリスト内で隣のタスクと入れ替える
  const move = (id: string, dir: -1 | 1) => {
    const me = visible.find((t) => t.id === id);
    if (!me) return;
    // 「すべて」表示のときは同じテーマ内の隣とだけ入れ替える
    const group = isAll ? visible.filter((t) => t.themeId === me.themeId) : visible;
    const idx = group.findIndex((t) => t.id === id);
    const neighbor = group[idx + dir];
    if (!neighbor) return;
    setTodos((prev) => {
      const next = [...prev];
      const a = next.findIndex((t) => t.id === id);
      const b = next.findIndex((t) => t.id === neighbor.id);
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  // ドラッグしたタスクを、ドロップ先のタスクの位置へ移す
  const dropOn = (targetId: string, pos: "before" | "after") => {
    if (!dragId || dragId === targetId) return;
    setTodos((prev) => {
      const from = prev.findIndex((t) => t.id === dragId);
      if (from < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      const to = next.findIndex((t) => t.id === targetId);
      if (to < 0) return prev;
      next.splice(pos === "before" ? to : to + 1, 0, item);
      return next;
    });
  };

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  // 「＋」で開いた入力欄の外をクリックしたら閉じる
  useEffect(() => {
    if (!quickId) return;
    const onDown = (e: PointerEvent) => {
      if (quickEl.current && !quickEl.current.contains(e.target as Node)) {
        setQuickId(null);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [quickId]);

  // 編集中のタスクの外をクリックしたらキャンセル
  useEffect(() => {
    if (!editingId) return;
    const onDown = (e: PointerEvent) => {
      const el = itemEls.current.get(editingId);
      if (el && !el.contains(e.target as Node)) cancelEdit();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [editingId]);

  // 並び順が変わったタスクを、元の位置から滑らせて動かす
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    itemEls.current.forEach((el, id) => {
      const parent = el.parentElement as HTMLElement | null;
      const top = el.offsetTop - (parent?.offsetTop ?? 0);
      next.set(id, top);
      const prev = prevTops.current.get(id);
      if (!reduce && prev !== undefined && prev !== top) {
        el.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: "none" }],
          { duration: 280, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      }
    });
    prevTops.current = next;
  });

  const selectTheme = (id: string) => {
    setActiveId(id);
    cancelEdit();
    setFilterPriority("all");
  };

  const addTheme = (e: FormEvent) => {
    e.preventDefault();
    const name = themeName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setThemes((prev) => [...prev, { id, name }]);
    selectTheme(id);
    setThemeName("");
    setAddingTheme(false);
  };

  const renameTheme = () => {
    if (!activeTheme) return;
    const name = window.prompt("テーマ名を変更", activeTheme.name)?.trim();
    if (!name) return;
    setThemes((prev) =>
      prev.map((t) => (t.id === activeTheme.id ? { ...t, name } : t))
    );
  };

  const deleteTheme = () => {
    if (!activeTheme || themes.length <= 1) return;
    const n = themeTodos.length;
    if (
      !window.confirm(
        `テーマ「${activeTheme.name}」を削除しますか？${n > 0 ? `\n中のタスク ${n} 件も削除されます。` : ""}`
      )
    )
      return;
    const rest = themes.filter((t) => t.id !== activeTheme.id);
    setThemes(rest);
    setTodos((prev) => prev.filter((t) => t.themeId !== activeTheme.id));
    selectTheme(rest[0].id);
  };

  // テーマの並びは「すべて」表示のグループ順にも使われる
  const dropTheme = (targetId: string, pos: "before" | "after") => {
    if (!themeDragId || themeDragId === targetId) return;
    setThemes((prev) => {
      const from = prev.findIndex((t) => t.id === themeDragId);
      if (from < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      const to = next.findIndex((t) => t.id === targetId);
      if (to < 0) return prev;
      next.splice(pos === "before" ? to : to + 1, 0, item);
      return next;
    });
  };

  // dragstart の最中に DOM が変わるとブラウザがドラッグを中止することがあるので、
  // 表示の切り替え（グループを畳む）は1フレーム遅らせる
  // 畳んだときにつかんだ見出しがカーソルから離れないよう、位置を覚えて補正する
  const startThemeDrag = (id: string, head?: HTMLElement) => {
    const top = head?.getBoundingClientRect().top;
    const height = groupsEl.current?.offsetHeight;
    window.clearTimeout(settleTimer.current);
    settleId.current = null;
    setSettle(false);
    setMovedId(null);
    headDragId.current = head ? id : null;
    endAnchor.current = null;
    setTimeout(() => {
      dragAnchor.current = head && top !== undefined ? { el: head, top } : null;
      setLockHeight(height ?? null);
      setThemeDragId(id);
    }, 0);
  };

  useLayoutEffect(() => {
    const a = endAnchor.current;
    if (settle || themeDragId || !a) return;
    endAnchor.current = null;
    const head = document.querySelector(`[data-theme-id="${a.id}"] .group-head`);
    if (!head) return;
    const delta = head.getBoundingClientRect().top - a.top;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [settle, themeDragId]);

  useLayoutEffect(() => {
    const a = dragAnchor.current;
    if (!themeDragId || !a) return;
    dragAnchor.current = null;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [themeDragId]);

  // 見出しからのドラッグは、落とした後も少しの間畳んだままにして、
  // 移動先を見せてから一覧を開く
  const finishSettle = () => {
    const id = headDragId.current ?? settleId.current;
    if (id) {
      const head = document.querySelector(`[data-theme-id="${id}"] .group-head`);
      if (head) endAnchor.current = { id, top: head.getBoundingClientRect().top };
    }
    headDragId.current = null;
    settleId.current = null;
    setMovedId(null);
    setSettle(false);
    setLockHeight(null);
  };

  const endThemeDrag = () => {
    setThemeDragId(null);
    setThemeOver(null);
    const id = headDragId.current;
    if (id) {
      headDragId.current = null;
      settleId.current = id;
      setMovedId(id);
      setSettle(true);
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(finishSettle, 900);
      return;
    }
    if (!settleId.current) setLockHeight(null);
  };

  const addSample = () => {
    const sample = makeSample();
    const have = new Set(themes.map((t) => t.name));
    const fresh = sample.themes.filter((t) => !have.has(t.name));
    if (fresh.length === 0) return;
    const ids = new Set(fresh.map((t) => t.id));
    setThemes((prev) => [...prev, ...fresh]);
    setTodos((prev) => [...prev, ...sample.todos.filter((t) => ids.has(t.themeId))]);
    selectTheme(fresh[0].id);
  };

  const now = new Date();
  const filtersActive = filterCategory !== "all" || filterPriority !== "all";
  const remaining = themeTodos.filter((t) => !t.done).length;
  const canReorder = sort === "manual";

  const renderItem = (todo: Todo, i: number, list: Todo[]) => {
            const overdue = isOverdue(todo, now);
            const editing = editingId === todo.id && draft;
            const cls = [
              "item",
              todo.done && "done",
              todo.id === enterId && "enter",
              todo.id === popId && "pop",
              leaving.has(todo.id) && "leave",
              todo.id === dragId && "dragging",
              canReorder &&
                over?.id === todo.id &&
                dragId !== todo.id &&
                `drop-${over.pos}`,
            ]
              .filter(Boolean)
              .join(" ");

            if (editing) {
              return (
                <li
                  key={todo.id}
                  className="item editing"
                  ref={(el) => {
                    if (el) itemEls.current.set(todo.id, el);
                    else itemEls.current.delete(todo.id);
                  }}
                >
                  <form className="edit-form" onSubmit={saveEdit}>
                    <input
                      className="input"
                      type="text"
                      value={draft.text}
                      onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                      aria-label="タスク名"
                      maxLength={100}
                      autoFocus
                    />
                    <div className="form-sub">
                      <label className="field">
                        <span>テーマ</span>
                        <select
                          value={draft.themeId}
                          onChange={(e) =>
                            setDraft({ ...draft, themeId: e.target.value })
                          }
                        >
                          {themes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>優先度</span>
                        <select
                          value={draft.priority}
                          onChange={(e) =>
                            setDraft({ ...draft, priority: e.target.value as Priority })
                          }
                        >
                          <option value="high">高</option>
                          <option value="mid">中</option>
                          <option value="low">低</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>締切</span>
                        <input
                          type="date"
                          value={draft.due}
                          onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>時刻</span>
                        <input
                          type="time"
                          value={draft.dueTime}
                          onChange={(e) =>
                            setDraft({ ...draft, dueTime: e.target.value })
                          }
                          disabled={!draft.due}
                        />
                      </label>
                      <label className="field grow">
                        <span>カテゴリ</span>
                        <input
                          type="text"
                          list="category-list"
                          value={draft.category}
                          onChange={(e) =>
                            setDraft({ ...draft, category: e.target.value })
                          }
                          maxLength={20}
                        />
                      </label>
                    </div>
                    <div className="edit-actions">
                      <button type="button" className="icon wide" onClick={cancelEdit}>
                        キャンセル
                      </button>
                      <button
                        type="submit"
                        className="add"
                        disabled={!draft.text.trim()}
                      >
                        保存
                      </button>
                    </div>
                  </form>
                </li>
              );
            }

            return (
              <li
                key={todo.id}
                className={cls}
                ref={(el) => {
                  if (el) itemEls.current.set(todo.id, el);
                  else itemEls.current.delete(todo.id);
                }}
                draggable={canReorder}
                onDragStart={(e) => {
                  if (!canReorder) return;
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", todo.id);
                  setDragId(todo.id);
                }}
                onDragOver={(e) => {
                  if (!dragId || dragId === todo.id) return;
                  // 別テーマのタスクの間には落とせない
                  const dragged = todos.find((t) => t.id === dragId);
                  if (!dragged || dragged.themeId !== todo.themeId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
                  if (over?.id !== todo.id || over.pos !== pos) {
                    setOver({ id: todo.id, pos });
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (over) dropOn(todo.id, over.pos);
                  endDrag();
                }}
                onDragEnd={endDrag}
              >
                {canReorder && (
                  <span className="grip" aria-hidden="true" title="ドラッグで並べ替え">
                    ⋮⋮
                  </span>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleTodo(todo.id)}
                  />
                  <span className="box" aria-hidden="true" />
                  <span className="body">
                    <span className="label">{todo.text}</span>
                    <span className="meta">
                      <span className={`badge p-${todo.priority}`}>
                        {PRIORITY_LABEL[todo.priority]}
                      </span>
                      {todo.category && (
                        <span className="tag">{todo.category}</span>
                      )}
                      {todo.due && (
                        <span className={`due${overdue ? " overdue" : ""}`}>
                          {overdue ? "期限切れ " : "〜"}
                          {formatDue(todo.due, todo.dueTime)}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
                <div className="actions">
                  {canReorder && (
                    <>
                      <button
                        className="icon"
                        onClick={() => move(todo.id, -1)}
                        disabled={i === 0}
                        aria-label="上へ"
                      >
                        ↑
                      </button>
                      <button
                        className="icon"
                        onClick={() => move(todo.id, 1)}
                        disabled={i === list.length - 1}
                        aria-label="下へ"
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    className="icon wide"
                    onClick={() => startEdit(todo)}
                    aria-label={`「${todo.text}」を編集`}
                  >
                    編集
                  </button>
                  <button
                    className="delete"
                    onClick={() => deleteTodo(todo.id)}
                    aria-label={`「${todo.text}」を削除`}
                  >
                    削除
                  </button>
                </div>
              </li>
            );
  };

  return (
    <main className="container">
      <header className="header">
        <h1 className="title">ToDo</h1>
        <p className="subtitle">
          {isTrash
            ? `ゴミ箱に ${trashed.length} 件`
            : themeTodos.length === 0
            ? "今日やることを書き出そう"
            : `${isAll ? "全テーマ " : ""}残り ${remaining} 件 / 全 ${themeTodos.length} 件`}
        </p>
      </header>

      <nav className="themes" aria-label="テーマ">
        <button
          type="button"
          className={`theme-tab${isAll ? " active" : ""}`}
          onClick={() => selectTheme(ALL)}
        >
          すべて
          <span className="theme-count">{live.filter((x) => !x.done).length}</span>
        </button>
        {themes.map((t) => {
          const count = live.filter((x) => x.themeId === t.id && !x.done).length;
          return (
            <button
              key={t.id}
              type="button"
              className={[
                "theme-tab",
                t.id === activeTheme?.id && "active",
                t.id === themeDragId && "dragging",
                themeOver?.id === t.id && themeDragId !== t.id && `drop-${themeOver.pos}`,
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => selectTheme(t.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", t.id);
                startThemeDrag(t.id);
              }}
              onDragOver={(e) => {
                if (!themeDragId || themeDragId === t.id) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = e.clientX < rect.left + rect.width / 2 ? "before" : "after";
                if (themeOver?.id !== t.id || themeOver.pos !== pos) {
                  setThemeOver({ id: t.id, pos });
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (themeOver) dropTheme(t.id, themeOver.pos);
                endThemeDrag();
              }}
              onDragEnd={endThemeDrag}
            >
              {t.name}
              <span className="theme-count">{count}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`theme-tab trash${isTrash ? " active" : ""}`}
          onClick={() => selectTheme(TRASH)}
        >
          ゴミ箱
          <span className="theme-count">{trashed.length}</span>
        </button>
        {addingTheme ? (
          <form className="theme-add" onSubmit={addTheme}>
            <input
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="テーマ名"
              aria-label="新しいテーマ名"
              maxLength={20}
              autoFocus
            />
            <button type="submit" className="icon wide" disabled={!themeName.trim()}>
              追加
            </button>
            <button
              type="button"
              className="icon wide"
              onClick={() => {
                setAddingTheme(false);
                setThemeName("");
              }}
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="theme-tab ghost"
            onClick={() => setAddingTheme(true)}
          >
            ＋ テーマ
          </button>
        )}
      </nav>

      {isTrash ? (
        <>
          <div className="theme-head">
            <h2>ゴミ箱</h2>
            <div className="theme-actions">
              <button
                type="button"
                className="icon wide"
                onClick={emptyTrash}
                disabled={trashed.length === 0}
              >
                ゴミ箱を空にする
              </button>
            </div>
          </div>
          {trashed.length === 0 ? (
            <p className="empty">削除したタスクはありません</p>
          ) : (
            <ul className="list">
              {trashed.map((t) => (
                <li key={t.id} className="item">
                  <div className="body">
                    <span className="label">{t.text}</span>
                    <span className="meta">
                      <span className={`badge p-${t.priority}`}>
                        {PRIORITY_LABEL[t.priority]}
                      </span>
                      <span className="tag">
                        {themes.find((x) => x.id === t.themeId)?.name ?? "不明"}
                      </span>
                      {t.category && <span className="tag">{t.category}</span>}
                      <span className="due">{formatDeleted(t.deletedAt ?? 0)} に削除</span>
                    </span>
                  </div>
                  <div className="actions">
                    <button
                      className="icon wide"
                      onClick={() => restoreTodo(t.id)}
                      aria-label={`「${t.text}」を元に戻す`}
                    >
                      元に戻す
                    </button>
                    <button
                      className="delete"
                      onClick={() => purgeTodo(t.id)}
                      aria-label={`「${t.text}」を完全に削除`}
                    >
                      完全に削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
      <>
      {isAll && (
        <div className="theme-head">
          <h2>すべてのテーマ</h2>
        </div>
      )}

      {activeTheme && (
        <div className="theme-head">
          <h2>{activeTheme.name}</h2>
          <div className="theme-actions">
            <button type="button" className="icon wide" onClick={renameTheme}>
              名前を変更
            </button>
            <button
              type="button"
              className="icon wide"
              onClick={deleteTheme}
              disabled={themes.length <= 1}
            >
              テーマを削除
            </button>
          </div>
        </div>
      )}

      {themeTodos.length > 0 && <ProgressChart todos={themeTodos} />}

      <form className="form" onSubmit={addTodo}>
        <div className="form-main">
          <input
            className="input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="新しいタスクを入力"
            aria-label="新しいタスク"
            maxLength={100}
          />
          <button className="add" type="submit" disabled={!text.trim()}>
            追加
          </button>
        </div>
        <div className="form-sub">
          {isAll && (
            <label className="field">
              <span>テーマ</span>
              <select
                value={formTheme?.id ?? ""}
                onChange={(e) => setFormThemeId(e.target.value)}
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>優先度</span>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="high">高</option>
              <option value="mid">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label className="field">
            <span>締切</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <label className="field">
            <span>時刻</span>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={!due}
            />
          </label>
          <label className="field grow">
            <span>カテゴリ</span>
            <input
              type="text"
              list="category-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="例: 仕事"
              maxLength={20}
            />
          </label>
        </div>
      </form>
      <datalist id="category-list">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {themeTodos.length > 0 && (
        <div className="toolbar">
          <div className="chips" role="group" aria-label="カテゴリで絞り込み">
            {["all", ...categories].map((c) => (
              <button
                key={c}
                type="button"
                className={`chip${filterCategory === c ? " active" : ""}`}
                onClick={() => setFilterCategory(c)}
              >
                {c === "all" ? "すべて" : c}
              </button>
            ))}
          </div>
          <div className="selects">
            <label className="field inline">
              <span>優先度</span>
              <select
                value={filterPriority}
                onChange={(e) =>
                  setFilterPriority(e.target.value as "all" | Priority)
                }
              >
                <option value="all">すべて</option>
                <option value="high">高</option>
                <option value="mid">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label className="field inline">
              <span>並び順</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortMode)}
              >
                <option value="manual">手動</option>
                <option value="priority">優先度順</option>
                <option value="due">締切順</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {!isAll && loaded && themeTodos.length === 0 ? (
        <p className="empty">タスクはまだありません</p>
      ) : !isAll && visible.length === 0 ? (
        <p className="empty">条件に合うタスクがありません</p>
      ) : isAll ? (
        <div
          ref={groupsEl}
          style={
            (themeDragId || settle) && lockHeight ? { minHeight: lockHeight } : undefined
          }
          className={`groups${themeDragId || settle ? " theme-dragging" : ""}`}
          onDragOver={(e) => {
            if (!themeDragId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            // カーソルのY位置から、ドラッグ中以外のグループのどの間かを決める
            const els = [
              ...e.currentTarget.querySelectorAll<HTMLElement>("[data-theme-id]"),
            ].filter((el) => el.dataset.themeId !== themeDragId);
            let next: { id: string; pos: "before" | "after" } | null = null;
            for (const el of els) {
              const r = el.getBoundingClientRect();
              if (e.clientY < r.top + r.height / 2) {
                next = { id: el.dataset.themeId!, pos: "before" };
                break;
              }
              next = { id: el.dataset.themeId!, pos: "after" };
            }
            if (next?.id !== themeOver?.id || next?.pos !== themeOver?.pos) {
              setThemeOver(next);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (themeOver) dropTheme(themeOver.id, themeOver.pos);
            endThemeDrag();
          }}
        >
        {themes.map((t) => {
          const items = visible.filter((x) => x.themeId === t.id);
          if (items.length === 0 && filtersActive) return null;
          return (
            <section
              key={t.id}
              data-theme-id={t.id}
              className={[
                "group",
                t.id === movedId && "moved",
                themeOver?.id === t.id && themeDragId !== t.id && `drop-${themeOver.pos}`,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={`group-head${t.id === themeDragId ? " dragging" : ""}`}
                role="button"
                tabIndex={0}
                aria-expanded={!collapsed.has(t.id)}
                title="クリックで開閉・ドラッグで並べ替え"
                onClick={() => toggleCollapsed(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCollapsed(t.id);
                  }
                }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", t.id);
                  startThemeDrag(t.id, e.currentTarget);
                }}
                onDragEnd={endThemeDrag}
              >
                <span className="grip" aria-hidden="true">
                  ⋮⋮
                </span>
                <span className="chev" aria-hidden="true">
                  {collapsed.has(t.id) ? "▸" : "▾"}
                </span>
                <h3 className="group-title">
                  {t.name}
                  <span>{items.length}</span>
                </h3>
                <button
                  type="button"
                  className="group-add"
                  aria-label={`「${t.name}」にタスクを追加`}
                  title="このテーマにタスクを追加"
                  draggable={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickAdd(t.id);
                  }}
                >
                  ＋
                </button>
              </div>
              {quickId === t.id && (
                <form className="quick-add" ref={quickEl} onSubmit={quickAdd}>
                  <input
                    className="input"
                    type="text"
                    value={quickText}
                    onChange={(e) => setQuickText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setQuickId(null);
                    }}
                    placeholder={`「${t.name}」に追加（Enterで連続追加）`}
                    aria-label={`「${t.name}」に追加するタスク`}
                    maxLength={100}
                    autoFocus
                  />
                  <button className="add" type="submit" disabled={!quickText.trim()}>
                    追加
                  </button>
                  <button
                    type="button"
                    className="icon"
                    onClick={() => setQuickId(null)}
                    aria-label="閉じる"
                  >
                    ✕
                  </button>
                </form>
              )}
              {!collapsed.has(t.id) &&
                (items.length > 0 ? (
                  <ul className="list">{items.map(renderItem)}</ul>
                ) : (
                  <p className="group-empty">タスクはありません</p>
                ))}
            </section>
          );
        })}
        </div>
      ) : (
        <ul className="list">{visible.map(renderItem)}</ul>
      )}

      </>
      )}

      {IS_DEV && (
        <footer className="footer">
          <button type="button" className="icon wide" onClick={addSample}>
            サンプルデータを追加
          </button>
        </footer>
      )}
    </main>
  );
}
