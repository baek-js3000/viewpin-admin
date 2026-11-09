import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { when } from "../spots";

type Ann = { id: string; title: string; body: string; created_at: string };
const TITLE_MAX = 80; // DB 와 같음

// 공지: 쓰기 · 보내기(메인 알림을 켠 모든 사용자에게 푸시) · 최근 30일 목록 · 삭제
//  보낸 푸시는 회수할 수 없어서 보내기 전에 한 번 더 확인. 30일 지난 공지는 서버가 매일 지움
export default function AnnouncementsPage({ notify }: { notify: (m: string) => void }) {
  const [list, setList] = useState<Ann[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Ann | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,body,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return setError(`불러오지 못했습니다: ${error.message}`);
    setError("");
    setList((data ?? []) as Ann[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    setBusy(true);
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim() });
    setBusy(false);
    setConfirm(false);
    if (error) return notify(`보내지 못했습니다: ${error.message}`);
    setTitle("");
    setBody("");
    notify("공지를 보냈습니다. 메인 알림을 켠 사용자에게 푸시가 갑니다.");
    await load();
  };

  const remove = async (a: Ann) => {
    if (!window.confirm(`'${a.title}' 공지를 지울까요?\n모든 사용자의 알림 탭에서 사라집니다. 이미 간 푸시는 회수되지 않습니다.`)) return;
    const { data, error } = await supabase.from("announcements").delete().eq("id", a.id).select("id");
    if (error || !data?.length) return notify(`삭제하지 못했습니다${error ? `: ${error.message}` : ""}`);
    setOpen(null);
    notify("공지를 삭제했습니다.");
    await load();
  };

  const canSend = title.trim().length > 0 && title.trim().length <= TITLE_MAX;

  return (
    <section>
      <div className="section-head">
        <h1>공지</h1>
      </div>

      <div className="card compose">
        <label className="small" htmlFor="ann-title"><strong>제목</strong></label>
        <input id="ann-title" value={title} maxLength={TITLE_MAX} placeholder="예: 1.1 업데이트 안내"
          onChange={(e) => setTitle(e.target.value)} />
        <div className="small muted counter">{title.length} / {TITLE_MAX}</div>
        <label className="small" htmlFor="ann-body"><strong>내용</strong></label>
        <textarea id="ann-body" rows={10} value={body} placeholder="앱 알림 탭에서 팝업으로 보이는 내용입니다. 푸시에는 앞부분 200자만 갑니다."
          onChange={(e) => setBody(e.target.value)} />
        {!confirm ? (
          <button className="primary" disabled={!canSend || busy} onClick={() => setConfirm(true)}>보내기…</button>
        ) : (
          <div className="confirm">
            <p className="small">메인 알림을 켠 모든 사용자에게 푸시가 바로 갑니다. 보낸 푸시는 회수할 수 없습니다.</p>
            <div className="row">
              <button disabled={busy} onClick={() => setConfirm(false)}>취소</button>
              <button className="primary" disabled={busy} onClick={send}>{busy ? "보내는 중…" : "보내기"}</button>
            </div>
          </div>
        )}
      </div>

      <div className="section-head">
        <h2>보낸 공지 <span className="muted small">최근 30일 · 30일이 지나면 자동으로 지워짐</span></h2>
        <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
      </div>
      {error && <p className="error card">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="card muted empty">최근 30일 동안 보낸 공지가 없습니다.</p>}
      <div className="reports">
        {list.map((a) => (
          <article key={a.id} className="card inquiry">
            <div className="report-head">
              <strong>{a.title}</strong>
              <span className="muted small">{when(a.created_at)}</span>
            </div>
            {open?.id === a.id ? (
              <p className="inquiry-body">{a.body || <span className="muted">(내용 없음)</span>}</p>
            ) : (
              a.body && <p className="muted small ann-preview">{a.body}</p>
            )}
            <div className="row">
              {a.body && (
                <button className="ghost" onClick={() => setOpen(open?.id === a.id ? null : a)}>{open?.id === a.id ? "접기" : "전체 보기"}</button>
              )}
              <span style={{ flex: 1 }} />
              <button className="danger-ghost" onClick={() => remove(a)}>삭제</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
