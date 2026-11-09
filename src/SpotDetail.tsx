import { useEffect, useState } from "react";
import { REASONS, deleteSpot, setHidden, when, type Spot } from "./spots";

type Props = {
  spot: Spot;
  author: string;
  reports?: { reason: string; who: string; at: string }[];
  onClose: () => void;
  onChanged: (msg: string) => void; // 조치 후 목록 다시 불러오기
};

export default function SpotDetail({ spot, author, reports = [], onClose, onChanged }: Props) {
  const [i, setI] = useState(0);
  const [reason, setReason] = useState(reports[0]?.reason && REASONS.includes(reports[0].reason) ? reports[0].reason : REASONS[1]);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photos = spot.image_urls ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => Math.min(photos.length - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  const run = async (f: () => Promise<string>) => {
    setBusy(true);
    setError("");
    try {
      onChanged(await f());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hideReason = memo.trim() ? `${reason} — ${memo.trim()}` : reason;

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card" role="dialog" aria-modal="true" aria-label="게시물 상세">
        <button className="ghost close" onClick={onClose} aria-label="닫기">✕</button>
        <div className="modal-grid">
          <div className="photo-pane">
            {photos.length ? (
              <img src={photos[i]} alt="" />
            ) : (
              <div className="muted no-photo">사진 없음</div>
            )}
            {photos.length > 1 && (
              <div className="pager">
                <button className="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>‹</button>
                <span>{i + 1} / {photos.length}</span>
                <button className="ghost" disabled={i === photos.length - 1} onClick={() => setI(i + 1)}>›</button>
              </div>
            )}
          </div>
          <div className="info-pane">
            {spot.hidden_at && (
              <div className="banner warning">
                숨김 중 · {when(spot.hidden_at)}
                {spot.hidden_reason && <div className="small">사유: {spot.hidden_reason}</div>}
              </div>
            )}
            <h2 className="title">{spot.title || <span className="muted">(설명 없음)</span>}</h2>
            <dl>
              <dt>카테고리</dt><dd>{spot.category}</dd>
              <dt>태그</dt><dd>{spot.tags?.length ? spot.tags.map((t) => `#${t}`).join(" ") : <span className="muted">없음</span>}</dd>
              <dt>작성자</dt><dd>{author}</dd>
              <dt>올린 날</dt><dd>{when(spot.created_at)}</dd>
              <dt>위치</dt>
              <dd>
                <a href={`https://www.google.com/maps?q=${spot.lat},${spot.lng}`} target="_blank" rel="noreferrer noopener">
                  {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)} ↗
                </a>
              </dd>
              <dt>게시물 id</dt><dd className="mono">{spot.id}</dd>
            </dl>

            {reports.length > 0 && (
              <div className="reports-in">
                <strong>신고 {reports.length}건</strong>
                <ul>{reports.map((r, k) => <li key={k}><b>{r.reason}</b> <span className="muted small">— {r.who} · {when(r.at)}</span></li>)}</ul>
              </div>
            )}

            <div className="actions-box">
              {spot.hidden_at ? (
                <button disabled={busy} onClick={() => run(async () => { await setHidden(spot.id, null); return "숨김을 풀었습니다."; })}>
                  숨김 풀기
                </button>
              ) : (
                <>
                  <label className="small muted" htmlFor="hide-reason">숨기는 사유</label>
                  <div className="row">
                    <select id="hide-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                      {REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <input placeholder="메모(선택)" value={memo} maxLength={150} onChange={(e) => setMemo(e.target.value)} />
                  </div>
                  <button className="warn" disabled={busy} onClick={() => run(async () => { await setHidden(spot.id, hideReason); return "게시물을 숨겼습니다. 앱에서는 작성자 본인에게만 보입니다."; })}>
                    숨기기
                  </button>
                </>
              )}

              {!confirmDelete ? (
                <button className="danger-ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>게시물 삭제…</button>
              ) : (
                <div className="confirm">
                  <p className="small">사진 · 신고 · 좋아요 · 북마크까지 모두 지워지고 되돌릴 수 없습니다.</p>
                  <div className="row">
                    <button disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button>
                    <button className="danger" disabled={busy} onClick={() => run(async () => { const w = await deleteSpot(spot); onClose(); return w || "게시물을 삭제했습니다."; })}>
                      영구 삭제
                    </button>
                  </div>
                </div>
              )}
              {error && <p className="error small">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
