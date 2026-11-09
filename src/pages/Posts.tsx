import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import SpotDetail from "../SpotDetail";
import { SPOT_COLUMNS, loadNames, thumbOf, when, type Spot } from "../spots";

type Filter = "all" | "visible" | "hidden" | "reported";
type Rep = { spot_id: string; reason: string; reporter_id: string; created_at: string };

const PAGE = 60;

export default function PostsPage({ notify }: { notify: (m: string) => void }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [reports, setReports] = useState<Rep[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Spot | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sp, rp] = await Promise.all([
      supabase.from("spots").select(SPOT_COLUMNS).order("created_at", { ascending: false }).limit(2000),
      supabase.from("reports").select("spot_id,reason,reporter_id,created_at").order("created_at", { ascending: false }).limit(2000),
    ]);
    if (sp.error) {
      setError(/hidden_at/.test(sp.error.message)
        ? "게시물 관리용 칸이 아직 없습니다. supabase/admin_site.sql 을 SQL Editor 에서 다시 실행하십시오."
        : `불러오지 못했습니다: ${sp.error.message}`);
      setLoading(false);
      return;
    }
    const list = (sp.data ?? []) as Spot[];
    const reps = (rp.data ?? []) as Rep[];
    setNames(await loadNames([...list.map((s) => s.user_id), ...reps.map((r) => r.reporter_id)]));
    setSpots(list);
    setReports(reps);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const repBy = useMemo(() => {
    const m = new Map<string, Rep[]>();
    for (const r of reports) m.set(r.spot_id, [...(m.get(r.spot_id) ?? []), r]);
    return m;
  }, [reports]);

  const nameOf = (id: string) => names[id] || "포토그래퍼";

  const list = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return spots.filter((s) => {
      if (filter === "hidden" && !s.hidden_at) return false;
      if (filter === "visible" && s.hidden_at) return false;
      if (filter === "reported" && !repBy.has(s.id)) return false;
      if (!words.length) return true;
      const text = [s.title, s.category, ...(s.tags ?? []), names[s.user_id] ?? "", s.id].join(" ").toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [spots, q, filter, repBy, names]);

  const counts = {
    all: spots.length,
    visible: spots.filter((s) => !s.hidden_at).length,
    hidden: spots.filter((s) => s.hidden_at).length,
    reported: spots.filter((s) => repBy.has(s.id)).length,
  };

  return (
    <section>
      <div className="section-head">
        <h1>게시물</h1>
        <div className="actions">
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="설명 · 카테고리 · 태그 · 작성자 · id" value={q}
          onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} />
        <div className="chips" role="tablist">
          {([["all", "전체"], ["visible", "공개"], ["hidden", "숨김"], ["reported", "신고됨"]] as [Filter, string][]).map(([k, label]) => (
            <button key={k} className={filter === k ? "chip on" : "chip"} onClick={() => { setFilter(k); setShown(PAGE); }}>
              {label} <span className="muted">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error card">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="card muted empty">해당하는 게시물이 없습니다.</p>}

      <div className="post-grid">
        {list.slice(0, shown).map((s) => {
          const n = repBy.get(s.id)?.length ?? 0;
          const img = thumbOf(s);
          return (
            <button key={s.id} className={s.hidden_at ? "post card is-hidden" : "post card"} onClick={() => setOpen(s)}>
              <div className="post-img">
                {img ? <img src={img} alt="" loading="lazy" /> : <span className="muted small">사진 없음</span>}
                <div className="badges">
                  {s.hidden_at && <span className="badge warning">숨김</span>}
                  {n > 0 && <span className="badge critical">신고 {n}</span>}
                </div>
              </div>
              <div className="post-meta">
                <div className="post-title">{s.title || <span className="muted">(설명 없음)</span>}</div>
                <div className="muted small">{s.category} · {nameOf(s.user_id)}</div>
                <div className="muted small">{when(s.created_at)}</div>
              </div>
            </button>
          );
        })}
      </div>
      {list.length > shown && (
        <div className="more"><button onClick={() => setShown(shown + PAGE)}>더 보기 ({list.length - shown})</button></div>
      )}

      {open && (
        <SpotDetail
          spot={open}
          author={nameOf(open.user_id)}
          reports={(repBy.get(open.id) ?? []).map((r) => ({ reason: r.reason, who: nameOf(r.reporter_id), at: r.created_at }))}
          onClose={() => setOpen(null)}
          onChanged={async (msg) => {
            notify(msg);
            await load();
            setOpen((cur) => (cur ? null : cur));
          }}
        />
      )}
    </section>
  );
}
