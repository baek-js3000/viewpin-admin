import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import SpotDetail from "../SpotDetail";
import { REASON_MAX, SPOT_COLUMNS, thumbOf, when, type Spot } from "../spots";

type Suspension = { reason: string; until: string | null; created_at: string; hid_posts: boolean };
type User = {
  id: string; email: string; name: string; badge: string | null; created_at: string; last_sign_in_at: string | null;
  banned_until: string | null; providers: string[]; admin: boolean; posts: number; suspension: Suspension | null;
  paying?: boolean;
};
type Filter = "all" | "suspended" | "inactive";
const INACTIVE_DAYS: [number, string][] = [[365, "1년"], [730, "2년"]];
// 장기 미접속(정리 대상): 운영자 · 결제 중이 아니고, 마지막 로그인(없으면 가입) 이 기간보다 오래됨
const lastSeen = (u: User) => Date.parse(u.last_sign_in_at ?? u.created_at);
const isInactive = (u: User, days: number) => !u.admin && !u.paying && lastSeen(u) < Date.now() - days * 86400000;

const PROVIDER: Record<string, string> = { google: "구글", apple: "애플", email: "이메일", naver: "네이버" };
const isBanned = (u: User) => !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
const PERIODS: [number | null, string][] = [[1, "1일"], [7, "7일"], [30, "30일"], [null, "영구"]];

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* 본문 없음 */ }
    if (/not found|404/i.test(msg)) msg = "서버 함수(admin-users)가 아직 배포되지 않았습니다.";
    throw new Error(msg);
  }
  return data;
}

export default function UsersPage({ notify }: { notify: (m: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<User | null>(null);
  const [days, setDays] = useState(365);
  const [cleaning, setCleaning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await call({ action: "list" });
      const list = (data?.users ?? []) as User[];
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setUsers(list);
      setError("");
    } catch (e) {
      setError(`불러오지 못했습니다: ${e instanceof Error ? e.message : e}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return users.filter((u) =>
      (filter === "all" || (filter === "suspended" ? isBanned(u) : isInactive(u, days))) &&
      (!w || `${u.name} ${u.email} ${u.id}`.toLowerCase().includes(w)));
  }, [users, q, filter]);
  const bannedCount = users.filter(isBanned).length;
  const inactiveCount = users.filter((u) => isInactive(u, days)).length;

  // 장기 미접속 미결제 계정 정리: 서버가 대상마다 다시 확인(운영자 · 결제 중 · 최근 접속은 건너뜀). 50명씩
  const cleanUp = async () => {
    const targets = list.filter((u) => isInactive(u, days));
    if (!targets.length) return;
    const label = INACTIVE_DAYS.find(([d]) => d === days)?.[1] ?? `${days}일`;
    if (!window.confirm(`${label} 이상 접속하지 않은 미결제 계정 ${targets.length}명을 정리할까요?\n사진 · 게시물 · 좋아요 · 북마크 등 그 계정의 모든 정보가 지워지고 되돌릴 수 없습니다.`)) return;
    setCleaning(true);
    let deleted = 0;
    const skipped: string[] = [];
    try {
      for (let i = 0; i < targets.length; i += 50) {
        const r = await call({ action: "delete_inactive", days, user_ids: targets.slice(i, i + 50).map((u) => u.id) });
        deleted += Number(r?.deleted ?? 0);
        for (const k of (r?.skipped ?? []) as { why: string }[]) skipped.push(k.why);
      }
      notify(`${deleted}명을 정리했습니다${skipped.length ? ` · 건너뜀 ${skipped.length}명` : ""}.`);
    } catch (e) {
      notify(`정리하지 못했습니다: ${e instanceof Error ? e.message : e}`);
    }
    setCleaning(false);
    await load();
  };

  return (
    <section>
      <div className="section-head">
        <h1>사용자</h1>
        <div className="actions">
          <span className="muted small">전체 {users.length}명 · 이용 제한 {bannedCount}명</span>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="이름 · 이메일 · id" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={filter === "all" ? "chip on" : "chip"} onClick={() => setFilter("all")}>전체 <span className="muted">{users.length}</span></button>
          <button className={filter === "suspended" ? "chip on" : "chip"} onClick={() => setFilter("suspended")}>이용 제한 <span className="muted">{bannedCount}</span></button>
          <button className={filter === "inactive" ? "chip on" : "chip"} onClick={() => setFilter("inactive")}>장기 미접속(미결제) <span className="muted">{inactiveCount}</span></button>
        </div>
      </div>
      {filter === "inactive" && (
        <div className="card inactive-bar">
          <span className="small">기간</span>
          {INACTIVE_DAYS.map(([d, label]) => (
            <button key={d} className={days === d ? "chip on" : "chip"} onClick={() => setDays(d)}>{label} 이상</button>
          ))}
          <span className="muted small grow">결제 중인 계정 · 운영자는 목록에 나오지 않고, 서버도 한 번 더 확인합니다.</span>
          <button className="danger" disabled={cleaning || list.length === 0} onClick={cleanUp}>
            {cleaning ? "정리하는 중…" : `목록 ${list.length}명 정리…`}
          </button>
        </div>
      )}
      {error && <p className="error card">{error}</p>}
      {!loading && !error && list.length === 0 && <p className="card muted empty">해당하는 사용자가 없습니다.</p>}

      <div className="card table-wrap">
        {list.length > 0 && (
          <table>
            <thead>
              <tr><th>이름</th><th>이메일</th><th>로그인</th><th>가입</th><th>최근 로그인</th><th className="num">게시물</th><th>결제</th><th>상태</th></tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} className="clickable" onClick={() => setOpen(u)}>
                  <td>{u.name || <span className="muted">(이름 없음)</span>}{u.badge === "official" && <span className="badge good-badge inline">공식</span>}</td>
                  <td>{u.email || <span className="muted">–</span>}</td>
                  <td>{u.providers.map((p) => PROVIDER[p] ?? p).join(" · ")}</td>
                  <td>{when(u.created_at)}</td>
                  <td>{u.last_sign_in_at ? when(u.last_sign_in_at) : <span className="muted">–</span>}</td>
                  <td className="num">{u.posts}</td>
                  <td>{u.paying ? <span className="badge good-badge">결제 중</span> : <span className="muted small">–</span>}</td>
                  <td>
                    {u.admin ? <span className="badge good-badge">운영자</span>
                      : isBanned(u) ? <span className="badge critical">이용 제한</span>
                      : <span className="muted small">정상</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <UserDetail
          user={open}
          onClose={() => setOpen(null)}
          onChanged={async (m) => { notify(m); setOpen(null); await load(); }}
        />
      )}
    </section>
  );
}

function UserDetail({ user, onClose, onChanged }: { user: User; onClose: () => void; onChanged: (m: string) => void }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState<number | null>(7);
  const [hidePosts, setHidePosts] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const banned = isBanned(user);

  const loadSpots = useCallback(async () => {
    const { data } = await supabase.from("spots").select(SPOT_COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false });
    setSpots((data ?? []) as Spot[]);
  }, [user.id]);
  useEffect(() => { void loadSpots(); }, [loadSpots]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !spot) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, spot]);

  const run = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setErr("");
    try {
      await call(body);
      onChanged(done);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal card user-modal" role="dialog" aria-modal="true" aria-label="사용자 상세">
        <button className="ghost close" onClick={onClose} aria-label="닫기">✕</button>
        <div className="info-pane">
          {banned && (
            <div className="banner critical-banner">
              이용 제한 중 · {user.banned_until && new Date(user.banned_until).getFullYear() > 2100 ? "영구" : `${when(user.banned_until!)}까지`}
              {user.suspension && <div className="small">사유: {user.suspension.reason}</div>}
            </div>
          )}
          <h2 className="title">{user.name || "(이름 없음)"}</h2>
          <dl>
            <dt>이메일</dt><dd>{user.email || "–"}</dd>
            <dt>로그인</dt><dd>{user.providers.map((p) => PROVIDER[p] ?? p).join(" · ") || "–"}</dd>
            <dt>가입</dt><dd>{when(user.created_at)}</dd>
            <dt>최근 로그인</dt><dd>{user.last_sign_in_at ? when(user.last_sign_in_at) : "–"}</dd>
            <dt>게시물</dt><dd>{user.posts}개</dd>
            <dt>사용자 id</dt><dd className="mono">{user.id}</dd>
          </dl>

          {spots.length > 0 && (
            <div className="user-posts">
              {spots.map((s) => (
                <button key={s.id} className={s.hidden_at ? "user-post is-hidden" : "user-post"} onClick={() => setSpot(s)} title={s.title}>
                  {thumbOf(s) ? <img src={thumbOf(s)} alt="" loading="lazy" /> : <span className="muted small">사진 없음</span>}
                  {s.hidden_at && <span className="badge warning mini">숨김</span>}
                </button>
              ))}
            </div>
          )}

          {user.admin ? (
            <p className="muted small">운영자 계정은 이용 제한할 수 없습니다.</p>
          ) : (
            <div className="actions-box">
              <label className="small" htmlFor="ban-reason">
                <strong>{banned ? "해제하며 보낼 말(선택)" : "이용 제한 사유"}</strong>
                <span className="muted"> — 사용자에게 푸시로 전달됩니다</span>
              </label>
              <textarea id="ban-reason" rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder={banned ? "예: 소명을 확인해 제한을 풀었습니다." : "예: 다른 사람의 사진을 반복해서 무단으로 올렸습니다."} />
              {banned ? (
                <button disabled={busy} onClick={() => run({ action: "unsuspend", user_id: user.id, message: reason.trim() }, "이용 제한을 풀었습니다.")}>
                  이용 제한 해제
                </button>
              ) : (
                <>
                  <div className="row">
                    <span className="small muted" style={{ alignSelf: "center" }}>기간</span>
                    {PERIODS.map(([d, label]) => (
                      <button key={label} type="button" className={days === d ? "chip on" : "chip"} onClick={() => setDays(d)}>{label}</button>
                    ))}
                  </div>
                  <label className="small check">
                    <input type="checkbox" checked={hidePosts} onChange={(e) => setHidePosts(e.target.checked)} /> 이 사용자의 게시물도 모두 숨기기 (같은 사유)
                  </label>
                  {!confirm ? (
                    <button className="danger-ghost" disabled={busy || !reason.trim()} onClick={() => setConfirm(true)}>이용 제한…</button>
                  ) : (
                    <div className="confirm">
                      <p className="small">
                        {days == null ? "영구히" : `${days}일 동안`} 로그인할 수 없습니다. 이미 로그인한 기기는 최대 1시간 안에 로그아웃됩니다.
                        {hidePosts && " 게시물도 모두 숨깁니다."}
                      </p>
                      <div className="row">
                        <button disabled={busy} onClick={() => setConfirm(false)}>취소</button>
                        <button className="danger" disabled={busy}
                          onClick={() => run({ action: "suspend", user_id: user.id, reason: reason.trim(), days, hide_posts: hidePosts }, "이용을 제한하고 사용자에게 알렸습니다.")}>
                          이용 제한
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {err && <p className="error small">{err}</p>}
            </div>
          )}
        </div>
      </div>
      {spot && (
        <SpotDetail spot={spot} author={user.name || "포토그래퍼"} onClose={() => setSpot(null)}
          onChanged={async (m) => { onChanged(m); }} />
      )}
    </div>
  );
}
