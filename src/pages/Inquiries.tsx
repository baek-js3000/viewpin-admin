import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { loadNames, when } from "../spots";

type Inquiry = {
  id: string; user_id: string; reply_email: string; body: string; app_version: string;
  status: "open" | "done"; created_at: string; handled_at: string | null;
};

export default function InquiriesPage({ notify }: { notify: (m: string) => void }) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("inquiries")
      .select("id,user_id,reply_email,body,app_version,status,created_at,handled_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      setError(/inquiries/.test(error.message)
        ? "문의 표가 아직 없습니다. supabase/inquiry.sql 을 SQL Editor 에서 실행하십시오."
        : `불러오지 못했습니다: ${error.message}`);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as Inquiry[];
    setNames(await loadNames(list.map((i) => i.user_id)));
    setItems(list);
    setError("");
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const open = useMemo(() => items.filter((i) => i.status === "open"), [items]);
  const list = showDone ? items : open;

  const setStatus = async (i: Inquiry, status: "open" | "done") => {
    setBusy(i.id);
    const { error } = await supabase
      .from("inquiries")
      .update({ status, handled_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", i.id);
    setBusy("");
    if (error) return notify(`바꾸지 못했습니다: ${error.message}`);
    notify(status === "done" ? "처리 완료로 바꿨습니다." : "처리 대기로 되돌렸습니다.");
    await load();
  };

  const mailto = (i: Inquiry) =>
    `mailto:${encodeURIComponent(i.reply_email)}?subject=${encodeURIComponent("[ViewPin] 문의 답변")}` +
    `&body=${encodeURIComponent(`\n\n---\n보내신 문의 (${when(i.created_at)}):\n${i.body}`)}`;

  return (
    <section>
      <div className="section-head">
        <h1>문의</h1>
        <div className="actions">
          <span className="muted small">처리 대기 {open.length}건 · 전체 {items.length}건</span>
          <label className="small check">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> 처리한 문의도 보기
          </label>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>
      {error && <p className="error card">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="card muted empty">처리할 문의가 없습니다.</p>}

      <div className="reports">
        {list.map((i) => (
          <article key={i.id} className={i.status === "done" ? "card inquiry is-done" : "card inquiry"}>
            <div className="report-head">
              <strong>{names[i.user_id] || "포토그래퍼"}</strong>
              <span className={i.status === "done" ? "badge good-badge" : "badge warning"}>
                {i.status === "done" ? "처리 완료" : "처리 대기"}
              </span>
            </div>
            <div className="muted small">
              {when(i.created_at)} · {i.app_version || "버전 정보 없음"}
              {i.handled_at && ` · 처리 ${when(i.handled_at)}`}
            </div>
            <p className="inquiry-body">{i.body}</p>
            <div className="row">
              {i.reply_email ? (
                <a className="btn-link" href={mailto(i)}>답장 메일 쓰기 ({i.reply_email})</a>
              ) : (
                <span className="muted small">회신 이메일 없음</span>
              )}
              <span style={{ flex: 1 }} />
              {i.status === "open" ? (
                <button disabled={busy === i.id} onClick={() => setStatus(i, "done")}>처리 완료</button>
              ) : (
                <button className="ghost" disabled={busy === i.id} onClick={() => setStatus(i, "open")}>처리 대기로</button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="muted small note">앱 메뉴 &gt; 문의에서 보낸 글입니다. 1년이 지나면 자동으로 지워집니다. 이메일로 온 문의는 메일함에서 확인하십시오.</p>
    </section>
  );
}
