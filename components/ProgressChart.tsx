import { Todo, UNCATEGORIZED } from "@/lib/types";

const R = 42;
const C = 2 * Math.PI * R;

export default function ProgressChart({ todos }: { todos: Todo[] }) {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);

  const byCategory = new Map<string, { total: number; done: number }>();
  for (const t of todos) {
    const key = t.category || UNCATEGORIZED;
    const cur = byCategory.get(key) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.done) cur.done += 1;
    byCategory.set(key, cur);
  }

  return (
    <section className="chart" aria-label="完了率">
      <div className="donut">
        <svg viewBox="0 0 100 100" role="img" aria-label={`完了率 ${rate}%`}>
          <circle className="donut-track" cx="50" cy="50" r={R} />
          <circle
            className="donut-value"
            cx="50"
            cy="50"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - rate / 100)}
          />
        </svg>
        <div className="donut-text">
          <strong>{rate}</strong>
          <span>%</span>
        </div>
      </div>

      <div className="bars">
        <p className="bars-head">
          完了 {done} / {total}
        </p>
        {[...byCategory.entries()].map(([name, v]) => (
          <div className="bar-row" key={name}>
            <span className="bar-name">{name}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ width: `${(v.done / v.total) * 100}%` }}
              />
            </span>
            <span className="bar-num">
              {v.done}/{v.total}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
