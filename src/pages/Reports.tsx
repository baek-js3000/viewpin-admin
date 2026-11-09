import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import SpotDetail from "../SpotDetail";
import { SPOT_COLUMNS, loadNames, thumbOf, when, type Spot } from "../spots";

type Report = {
  id: string; spot_id: string; reporter_id: string; reason: string; created_at: string; spot: Spot | null;
  resolved_at: string | null; resolution: "dismissed" | "hidden" | null;
};

export default function ReportsPage({ notify }: { notify: (m: string) => void }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [open, setOpen] = useState<Report[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select(`id,spot_id,reporter_id,reason,created_at,resolved_at,resolution,spot:spots(${SPOT_COLUMNS})`)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      setLoading(false);
      setError(`불러오지 못했습니다: ${error.message}`);
      return;
    }
    const list = (data ?? []) as unknown as Report[];
    setNames(await loadNames(list.flatMap((r) => [r.reporter_id, r.spot?.user_id ?? ""])));
    setError("");
    setReports(list);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 게시물별로 묶음 (신고가 많은 게시물 먼저). 처리 대기 = 아직 처리 안 된 신고가 있고 숨기지 않은 게시물
  const all = useMemo(() => {
    const m = new Map<string, Report[]>();
    for (const r of reports) if (r.spot) m.set(r.spot_id, [...(m.get(r.spot_id) ?? []), r]);
    return [...m.values()].sort((a, b) => b.length - a.length || b[0].created_at.localeCompare(a[0].created_at));
  }, [reports]);
  const isPending = (g: Report[]) => !g[0].spot?.hidden_at && g.some((r) => !r.resolved_at);
  const pending = all.filter(isPending);
  const handled = all.filter((g) => !isPending(g));
  const groups = showHidden ? all : pending;
  const [closing, setClosing] = useState("");

  // 신고 닫기(문제 없음): 이 게시물의 처리 안 된 신고를 모두 닫음 — 작성자에게 알리지 않음
  const dismiss = async (spotId: string) => {
    if (!window.confirm("이 게시물의 신고를 '문제 없음'으로 닫을까요? 게시물은 그대로 보이고 작성자에게 알리지 않습니다.")) return;
    setClosing(spotId);
    const { error } = await supabase.rpc("admin_dismiss_reports", { p_spot_id: spotId });
    setClosing("");
    if (error) {
      return notify(/admin_dismiss_reports/.test(error.message)
        ? "서버 함수가 아직 없습니다. supabase/admin_reports_users.sql 을 SQL Editor 에서 실행하십시오."
        : `닫지 못했습니다: ${error.message}`);
    }
    notify("신고를 '문제 없음'으로 닫았습니다.");
    await load();
  };

  const nameOf = (id?: string) => (id && names[id]) || "포토그래퍼";

  return (
    <section>
      <div className="section-head">
        <h1>신고</h1>
        <div className="actions">
          <span className="muted small">처리 대기 {pending.length}개 · 처리함 {handled.length}개</span>
          <label className="small check"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> 처리한 신고도 보기</label>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>
      {error && <p className="error card">{error}</p>}
      {!loading && !error && groups.length === 0 && <p className="card muted empty">처리할 신고가 없습니다.</p>}

      <div className="reports">
        {groups.map((g) => {
          const s = g[0].spot!;
          const img = thumbOf(s);
          const open = isPending(g);
          const how = s.hidden_at ? "숨김으로 처리" : g.every((r) => r.resolution === "dismissed") ? "문제 없음으로 닫음" : "";
          return (
            <article className={open ? "card report" : "card report is-hidden"} key={g[0].spot_id}>
              <div className="thumb">{img ? <img src={img} alt="" loading="lazy" /> : <span className="muted">사진 없음</span>}</div>
              <div className="report-body">
                <div className="report-head">
                  <strong>{s.title || <span className="muted">(설명 없음)</span>}</strong>
                  <span className="count">신고 {g.length}건</span>
                </div>
                <div className="muted small">
                  {s.category} · 작성자 {nameOf(s.user_id)} · 올린 날 {when(s.created_at)}
                  {!open && how && <span className={`badge ${s.hidden_at ? "warning" : "good-badge"} inline`}>{how}</span>}
                </div>
                <ul>
                  {g.map((r) => (
                    <li key={r.id}>
                      <span className="reason">{r.reason}</span>
                      <span className="muted small"> — {nameOf(r.reporter_id)} · {when(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
                <div className="row">
                  <button className="small-btn" onClick={() => setOpen(g)}>살펴보고 조치</button>
                  {open && (
                    <button className="small-btn" disabled={closing === g[0].spot_id} onClick={() => dismiss(g[0].spot_id)}>
                      문제 없음(신고 닫기)
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {open && (
        <SpotDetail
          spot={open[0].spot!}
          author={nameOf(open[0].spot?.user_id)}
          reports={open.map((r) => ({ reason: r.reason, who: nameOf(r.reporter_id), at: r.created_at }))}
          onClose={() => setOpen(null)}
          onChanged={async (msg) => { notify(msg); setOpen(null); await load(); }}
        />
      )}
    </section>
  );
}
