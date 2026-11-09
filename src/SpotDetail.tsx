import { useEffect, useState } from "react";
import { REASONS, REASON_MAX, deleteSpot, hideSpot, unhideSpot, when, type Spot } from "./spots";

type Props = {
  spot: Spot;
  author: string;
  reports?: { reason: string; who: string; at: string }[];
  onClose: () => void;
  onChanged: (msg: string) => void; // 조치 후 목록 다시 불러오기
};

export default function SpotDetail({ spot, author, reports = [], onClose, onChanged }: Props) {
  const [i, setI] = useState(0);
  // 작성자에게 그대로 전달되는 사유 (운영자가 직접 씀). 신고가 있으면 첫 신고 사유로 시작, 숨김 풀기는 빈 칸
  const [reason, setReason] = useState(spot.hidden_at ? "" : (reports[0]?.reason ?? ""));
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

  const text = reason.trim();

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
              <label className="small" htmlFor="mod-reason">
                <strong>{spot.hidden_at ? "작성자에게 보낼 말" : "작성자에게 보낼 사유"}</strong>
                <span className="muted"> — 앱 알림 · 푸시로 그대로 전달됩니다</span>
              </label>
              <div className="chips" hidden={!!spot.hidden_at}>
                {REASONS.filter((r) => r !== "기타").map((r) => (
                  <button key={r} type="button" className="chip" onClick={() => setReason(r)}>{r}</button>
                ))}
              </div>
              <textarea id="mod-reason" rows={4} maxLength={REASON_MAX} value={reason}
                placeholder={spot.hidden_at ? "다시 공개하는 이유(선택)" : "예: 다른 사람의 얼굴이 크게 나온 사진이라 숨겼습니다. 얼굴을 가린 사진으로 다시 올려 주십시오."}
                onChange={(e) => setReason(e.target.value)} />
              <div className="small muted counter">{reason.length} / {REASON_MAX}</div>

              {spot.hidden_at ? (
                <button disabled={busy} onClick={() => run(async () => { await unhideSpot(spot, text); return "숨김을 풀고 작성자에게 알렸습니다."; })}>
                  숨김 풀기
                </button>
              ) : (
                <button className="warn" disabled={busy || !text} title={text ? "" : "사유를 입력하십시오"}
                  onClick={() => run(async () => { await hideSpot(spot, text); return "게시물을 숨기고 작성자에게 사유를 보냈습니다."; })}>
                  숨기기
                </button>
              )}

              {!confirmDelete ? (
                <button className="danger-ghost" disabled={busy || !text} title={text ? "" : "사유를 입력하십시오"} onClick={() => setConfirmDelete(true)}>
                  게시물 삭제…
                </button>
              ) : (
                <div className="confirm">
                  <p className="small">사진 · 신고 · 좋아요 · 북마크까지 모두 지워지고 되돌릴 수 없습니다. 작성자에게 위 사유가 전달됩니다.</p>
                  <div className="row">
                    <button disabled={busy} onClick={() => setConfirmDelete(false)}>취소</button>
                    <button className="danger" disabled={busy || !text} onClick={() => run(async () => { const w = await deleteSpot(spot, text); onClose(); return w || "게시물을 삭제하고 작성자에게 사유를 보냈습니다."; })}>
                      영구 삭제
                    </button>
                  </div>
                </div>
              )}
              {!text && !spot.hidden_at && <p className="small muted">숨기기 · 삭제는 사유를 써야 할 수 있습니다.</p>}
              {error && <p className="error small">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
