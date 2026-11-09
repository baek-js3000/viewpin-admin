import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { loadNames, when } from "../spots";

type Notice = { id: string; user_id: string; spot_id: string | null; action: string; reason: string; spot_title: string; created_at: string };

const LABEL: Record<string, string> = {
  hidden: "숨김", unhidden: "숨김 풀기", deleted: "삭제", suspended: "이용 제한", unsuspended: "제한 해제",
};
const FILTERS: [string, string][] = [["all", "전체"], ["post", "게시물"], ["account", "계정"]];

// 조치 기록: 운영자가 한 숨김 · 숨김 풀기 · 삭제 · 이용 제한 · 해제 (작성자에게 보낸 운영 안내 = moderation_notices, 90일 보관)
export default function ModerationLogPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("moderation_notices")
      .select("id,user_id,spot_id,action,reason,spot_title,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      setLoading(false);
      return setError(`불러오지 못했습니다: ${error.message}`);
    }
    const list = (data ?? []) as Notice[];
    setNames(await loadNames(list.map((n) => n.user_id)));
    setItems(list);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return items.filter((n) => {
      const account = n.action.includes("suspended");
      if (filter === "post" && account) return false;
      if (filter === "account" && !account) return false;
      return !w || `${names[n.user_id] ?? ""} ${n.reason} ${n.spot_title} ${n.user_id} ${n.spot_id ?? ""}`.toLowerCase().includes(w);
    });
  }, [items, names, filter, q]);

  return (
    <section>
      <div className="section-head">
        <h1>조치 기록</h1>
        <div className="actions">
          <span className="muted small">최근 90일 · 그보다 오래된 기록은 서버가 자동으로 지움</span>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="사용자 · 사유 · 게시물 설명 · id" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? "chip on" : "chip"} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>
      {error && <p className="error card">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="card muted empty">기록이 없습니다.</p>}
      {list.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>일시</th><th>조치</th><th>대상 사용자</th><th>게시물</th><th>사유 · 보낸 말</th></tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id}>
                  <td>{when(n.created_at)}</td>
                  <td><span className={`badge ${n.action === "deleted" || n.action === "suspended" ? "critical" : n.action.startsWith("un") ? "good-badge" : "warning"}`}>{LABEL[n.action] ?? n.action}</span></td>
                  <td>{names[n.user_id] || <span className="muted">(이름 없음)</span>}</td>
                  <td>{n.action.includes("suspended") ? <span className="muted">–</span> : (n.spot_title || <span className="muted">(설명 없음)</span>)}</td>
                  <td className="wrap-cell">{n.reason || <span className="muted">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
