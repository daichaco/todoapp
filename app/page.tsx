"use client";

import { FormEvent, useEffect, useState } from "react";

type Todo = {
  id: string;
  text: string;
  done: boolean;
};

const STORAGE_KEY = "todo-app:items";

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTodos(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {}
  }, [todos, loaded]);

  const addTodo = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setTodos((prev) => [
      { id: crypto.randomUUID(), text: value, done: false },
      ...prev,
    ]);
    setText("");
  };

  const toggleTodo = (id: string) =>
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );

  const deleteTodo = (id: string) =>
    setTodos((prev) => prev.filter((t) => t.id !== id));

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <main className="container">
      <header className="header">
        <h1 className="title">ToDo</h1>
        <p className="subtitle">
          {todos.length === 0
            ? "今日やることを書き出そう"
            : `残り ${remaining} 件 / 全 ${todos.length} 件`}
        </p>
      </header>

      <form className="form" onSubmit={addTodo}>
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
      </form>

      {loaded && todos.length === 0 ? (
        <p className="empty">タスクはまだありません</p>
      ) : (
        <ul className="list">
          {todos.map((todo) => (
            <li key={todo.id} className={`item${todo.done ? " done" : ""}`}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleTodo(todo.id)}
                />
                <span className="box" aria-hidden="true" />
                <span className="label">{todo.text}</span>
              </label>
              <button
                className="delete"
                onClick={() => deleteTodo(todo.id)}
                aria-label={`「${todo.text}」を削除`}
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
