import { Priority, Theme, Todo } from "@/lib/types";

const dateStr = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

type Row = [
  text: string,
  priority: Priority,
  offset: number | null, // 締切までの日数（null = なし）
  time: string,
  category: string,
  done: boolean
];

const SAMPLE: { name: string; rows: Row[] }[] = [
  {
    name: "仕事",
    rows: [
      ["週次レポートを提出する", "high", -2, "", "報告", false],
      ["クライアントへ見積書を送る", "high", 0, "15:00", "営業", false],
      ["会議室を予約する", "low", 0, "", "総務", true],
      ["新機能の仕様書レビュー", "mid", 1, "10:30", "開発", false],
      ["月次の売上データを集計して、グラフ付きの資料にまとめて共有フォルダへ保存する", "mid", 3, "", "報告", false],
      ["名刺を発注する", "low", 7, "", "総務", false],
      ["来期の目標を考える", "mid", null, "", "", false],
      ["バグ修正 #128 をリリース", "high", -1, "18:00", "開発", true],
    ],
  },
  {
    name: "生活",
    rows: [
      ["電気料金を支払う", "high", 0, "", "支払い", false],
      ["歯医者の予約", "mid", 5, "", "健康", false],
      ["部屋の掃除", "low", 2, "", "", false],
      ["ジムに行く", "low", -3, "", "健康", true],
      ["実家に電話する", "mid", null, "", "", false],
    ],
  },
  {
    name: "買い物リスト",
    rows: [
      ["牛乳", "high", 0, "19:00", "食品", false],
      ["卵（10個入り）", "high", 0, "19:00", "食品", false],
      ["食パン", "mid", 1, "", "食品", false],
      ["鶏むね肉 300g", "mid", 1, "", "食品", false],
      ["トマト・きゅうり・レタス", "mid", 2, "", "食品", true],
      ["食器用洗剤（詰め替え）", "low", 5, "", "日用品", false],
      ["トイレットペーパー", "high", 2, "", "日用品", false],
      ["電池（単3）", "low", null, "", "日用品", false],
      ["ビタミン剤", "low", 7, "", "ドラッグストア", false],
      ["友人への誕生日プレゼント", "mid", 6, "", "ギフト", false],
    ],
  },
  {
    name: "学習",
    rows: [
      ["英単語 50 個を復習", "mid", 0, "21:00", "英語", false],
      ["TypeScript の本を第3章まで読む", "high", 4, "", "プログラミング", false],
      ["オンライン講座の課題を提出", "high", 1, "23:59", "プログラミング", false],
      ["資格試験の申し込み", "low", 10, "", "", false],
      ["英語ニュースを聞く", "low", null, "", "英語", true],
      ["読書メモを整理する", "mid", -5, "", "", false],
    ],
  },
];

export function makeSample(): { themes: Theme[]; todos: Todo[] } {
  const themes: Theme[] = [];
  const todos: Todo[] = [];
  for (const g of SAMPLE) {
    const themeId = crypto.randomUUID();
    themes.push({ id: themeId, name: g.name });
    for (const [text, priority, offset, time, category, done] of g.rows) {
      todos.push({
        id: crypto.randomUUID(),
        themeId,
        text,
        done,
        priority,
        due: offset === null ? "" : dateStr(offset),
        dueTime: offset === null ? "" : time,
        category,
        deletedAt: null,
      });
    }
  }
  return { themes, todos };
}
