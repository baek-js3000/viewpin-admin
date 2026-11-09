import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { BarChart } from "./Usage";

type Daily = { day: string; signups: number; posts: number };
type Stats = {
  users: number; users_7d: number; posts: number; posts_hidden: number; posts_7d: number;
  reports_open: number; inquiries_open: number; push_devices: number; daily: Daily[];
};

const DAYS = 30;
const fmt = (n: number) => n.toLocaleString("ko-KR");

// 현황: 가입자 · 게시물 · 처리 대기 · 푸시 기기 + 최근 30일 일별 가입 · 게시물 (서버 함수 admin_stats, 운영자만)
export default function StatsPage({ go }: { go: (tab: "reports" | "inquiries" | "posts" | "users") => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [table, setTable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_stats", { p_days: DAYS });
    setLoading(false);
    if (error) {
      setError(/admin_stats/.test(error.message)
        ? "서버 함수가 아직 없습니다. supabase/admin_stats.sql 을 SQL Editor 에서 실행하십시오."
        : `불러오지 못했습니다: ${error.message}`);
      return;
    }
    setError("");
    setStats(data as Stats);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const daily = useMemo(() => stats?.daily ?? [], [stats]);
  const days = daily.map((d) => d.day);

  const tiles: { label: string; value: number; sub: string; tab?: "reports" | "inquiries" | "posts" | "users"; alert?: boolean }[] =
    stats
      ? [
          { label: "전체 가입자", value: stats.users, sub: `최근 7일 +${fmt(stats.users_7d)}`, tab: "users" },
          { label: "전체 게시물", value: stats.posts, sub: `최근 7일 +${fmt(stats.posts_7d)} · 숨김 ${fmt(stats.posts_hidden)}`, tab: "posts" },
          { label: "처리 대기 신고", value: stats.reports_open, sub: "신고된 게시물 수(숨긴 것 제외)", tab: "reports", alert: stats.reports_open > 0 },
          { label: "처리 대기 문의", value: stats.inquiries_open, sub: "앱에서 보낸 문의", tab: "inquiries", alert: stats.inquiries_open > 0 },
          { label: "푸시를 받는 기기", value: stats.push_devices, sub: "알림 권한을 허용하고 로그인한 기기" },
        ]
      : [];

  return (
    <section>
      <div className="section-head">
        <h1>현황</h1>
        <div className="actions">
          <span className="muted small">한국 시간 기준</span>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>
      {error && <p className="error card">{error}</p>}

      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.label} className={`card tile stat-tile${t.tab ? " clickable-tile" : ""}`}
            onClick={t.tab ? () => go(t.tab!) : undefined} disabled={!t.tab}>
            <div className="tile-label">{t.label}</div>
            <div className="tile-value">
              {fmt(t.value)}
              {t.alert && <strong className="status critical small-dot"> ● 확인 필요</strong>}
            </div>
            <div className="tile-sub">{t.sub}</div>
          </button>
        ))}
      </div>

      {stats && (
        <>
          <div className="section-head">
            <h2>최근 {DAYS}일</h2>
            <button className="ghost" onClick={() => setTable((v) => !v)}>{table ? "그래프로 보기" : "표로 보기"}</button>
          </div>
          {table ? (
            <div className="card table-wrap">
              <table>
                <thead><tr><th>날짜</th><th className="num">가입</th><th className="num">게시물</th></tr></thead>
                <tbody>
                  {[...daily].reverse().map((d) => (
                    <tr key={d.day}><td>{d.day}</td><td className="num">{fmt(d.signups)}</td><td className="num">{fmt(d.posts)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="multiples">
              <BarChart title="일별 가입" days={days} values={daily.map((d) => d.signups)} errors={days.map(() => 0)} unit="명" />
              <BarChart title="일별 새 게시물" days={days} values={daily.map((d) => d.posts)} errors={days.map(() => 0)} unit="개" />
            </div>
          )}
        </>
      )}
    </section>
  );
}
