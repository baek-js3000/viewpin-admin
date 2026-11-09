import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, kstDay } from "../supabase";
import { APIS, DAYS, DB_LIMIT_BYTES, LIMITS, PHOTO_LIMIT_BYTES, PLAN_LABEL } from "../config";

type Row = { day: string; api: string; calls: number; errors: number };
type Storage = { photo_bytes: number; photo_count: number; db_bytes: number };
const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)}GB` : `${(b / 1024 ** 2).toFixed(1)}MB`);

const fmt = (n: number) => n.toLocaleString("ko-KR");

export default function UsagePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(false);
  const [storage, setStorage] = useState<Storage | null>(null);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => kstDay(i - DAYS + 1)), []);
  const today = days[days.length - 1];

  const load = useCallback(async () => {
    setLoading(true);
    // 저장 용량 (실패해도 호출량은 그대로)
    supabase.rpc("admin_storage_usage").then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : data;
      setStorage(r ? { photo_bytes: Number(r.photo_bytes), photo_count: Number(r.photo_count), db_bytes: Number(r.db_bytes) } : null);
    });
    const { data, error } = await supabase
      .from("api_usage_daily")
      .select("day,api,calls,errors")
      .gte("day", days[0])
      .order("day");
    setLoading(false);
    if (error) {
      setError(error.code === "42P01" || /does not exist/.test(error.message)
        ? "api_usage_daily 표가 아직 없습니다. supabase/admin_site.sql 을 SQL Editor 에서 실행하십시오."
        : `불러오지 못했습니다: ${error.message}`);
      return;
    }
    setError("");
    setRows((data ?? []) as Row[]);
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const get = (day: string, api: string) => rows.find((r) => r.day === day && r.api === api);
  const sum = (day: string, apis: string[], f: "calls" | "errors" = "calls") =>
    apis.reduce((t, a) => t + (get(day, a)?.[f] ?? 0), 0);
  const monthStart = today.slice(0, 8) + "01";
  const monthSum = (apis: string[]) =>
    rows.filter((r) => r.day >= monthStart && apis.includes(r.api)).reduce((t, r) => t + r.calls, 0);

  return (
    <section>
      <div className="section-head">
        <h1>API 호출량</h1>
        <div className="actions">
          <span className="muted small">한국 시간 기준 · 오늘 {today}</span>
          <button className="ghost" onClick={load} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button>
        </div>
      </div>
      {error && <p className="error card">{error}</p>}

      <div className="tiles">
        {LIMITS.map((g) => {
          const calls = sum(today, g.apis);
          const errs = sum(today, g.apis, "errors");
          const ratio = g.perDay ? calls / g.perDay : null;
          const level = ratio == null ? "" : ratio >= 0.9 ? "critical" : ratio >= 0.7 ? "warning" : "good";
          return (
            <div className="card tile" key={g.label}>
              <div className="tile-label">{g.label} · 오늘</div>
              <div className="tile-value">{fmt(calls)}<span>건</span></div>
              {ratio != null && (
                <div className="meter" aria-label={`무료 한도의 ${Math.round(ratio * 100)}%`}>
                  <div className={`meter-fill ${level}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                </div>
              )}
              <div className="tile-sub">
                {ratio != null ? `무료 한도 ${fmt(g.perDay!)}건의 ${Math.round(ratio * 100)}%` : g.note}
                {level === "critical" && <strong className="status critical"> ▲ 한도 임박</strong>}
                {level === "warning" && <strong className="status warning"> ● 주의</strong>}
              </div>
              <div className="tile-sub muted">이번 달 {fmt(monthSum(g.apis))}건{errs ? ` · 오늘 실패 ${fmt(errs)}건` : ""}</div>
            </div>
          );
        })}
      </div>

      {storage && (
        <div className="tiles">
          {([
            ["사진 저장 용량", storage.photo_bytes, PHOTO_LIMIT_BYTES, `사진 ${fmt(storage.photo_count)}개 (원본 + 목록용)`],
            ["DB 크기", storage.db_bytes, DB_LIMIT_BYTES, "게시물 · 프로필 · 알림 등"],
          ] as [string, number, number, string][]).map(([label, used, limit, sub]) => {
            const ratio = used / limit;
            const level = ratio >= 0.9 ? "critical" : ratio >= 0.7 ? "warning" : "good";
            return (
              <div className="card tile" key={label}>
                <div className="tile-label">{label}</div>
                <div className="tile-value">{mb(used)}<span>/ {mb(limit)}</span></div>
                <div className="meter" aria-label={`${PLAN_LABEL} 한도의 ${Math.round(ratio * 100)}%`}>
                  <div className={`meter-fill ${level}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                </div>
                <div className="tile-sub">
                  {PLAN_LABEL} 한도의 {Math.round(ratio * 100)}%
                  {level === "critical" && <strong className="status critical"> ▲ 한도 임박</strong>}
                  {level === "warning" && <strong className="status warning"> ● 주의</strong>}
                </div>
                <div className="tile-sub muted">{sub}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-head">
        <h2>최근 {DAYS}일</h2>
        <button className="ghost" onClick={() => setTable((t) => !t)}>{table ? "그래프로 보기" : "표로 보기"}</button>
      </div>

      {table ? (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>날짜</th>{APIS.map((a) => <th key={a.key}>{a.vendor}<br /><span className="muted">{a.label}</span></th>)}</tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d}>
                  <td>{d}</td>
                  {APIS.map((a) => {
                    const r = get(d, a.key);
                    return <td key={a.key} className="num">{r ? fmt(r.calls) : "–"}{r?.errors ? <span className="muted"> (실패 {fmt(r.errors)})</span> : null}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="multiples">
          {APIS.map((a) => (
            <BarChart key={a.key} title={`${a.vendor} · ${a.label}`} days={days}
              values={days.map((d) => get(d, a.key)?.calls ?? 0)}
              errors={days.map((d) => get(d, a.key)?.errors ?? 0)} />
          ))}
        </div>
      )}

      <p className="muted small note">
        geo 함수가 외부 API 를 부른 횟수입니다(배포한 날부터 쌓임, API 이름 · 날짜 · 횟수만 저장).
        업체의 과금 단위와 다를 수 있으니 요금은 각 업체 콘솔을 기준으로 보십시오.
        네이버 지도 표시 · Open-Meteo 날씨는 앱이 직접 불러 여기에 없습니다.
      </p>
    </section>
  );
}

export function BarChart({ title, days, values, errors, unit = "건" }: { title: string; days: string[]; values: number[]; errors: number[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300, H = 120, PAD_B = 18, PAD_T = 8;
  const max = Math.max(1, ...values);
  const step = W / values.length;
  const bw = Math.max(2, step - 2); // 막대 사이 2px
  const total = values.reduce((a, b) => a + b, 0);
  const y = (v: number) => H - PAD_B - (v / max) * (H - PAD_B - PAD_T);

  return (
    <figure className="card chart">
      <figcaption>
        <span>{title}</span>
        <span className="muted small">{days.length}일 합계 {fmt(total)}{unit}</span>
      </figcaption>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} 최근 ${days.length}일, 최대 ${fmt(max)}${unit}`}
          onMouseLeave={() => setHover(null)}>
          <line x1={0} x2={W} y1={H - PAD_B} y2={H - PAD_B} className="axis" />
          <text x={0} y={PAD_T - 1} className="tick">{fmt(max)}</text>
          {values.map((v, i) => {
            const x = i * step + 1;
            const top = y(v);
            const h = H - PAD_B - top;
            return (
              <g key={i}>
                {v > 0 && (
                  <path className={hover === i ? "bar on" : "bar"}
                    d={`M${x},${H - PAD_B} V${top + Math.min(4, h)} Q${x},${top} ${x + Math.min(4, bw / 2)},${top} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${top} ${x + bw},${top + Math.min(4, h)} V${H - PAD_B} Z`} />
                )}
                <rect x={i * step} y={0} width={step} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />
              </g>
            );
          })}
          <text x={0} y={H - 4} className="tick">{days[0].slice(5)}</text>
          <text x={W} y={H - 4} className="tick" textAnchor="end">{days[days.length - 1].slice(5)}</text>
        </svg>
        {hover != null && (
          <div className="tooltip" style={{ left: `${((hover + 0.5) / values.length) * 100}%` }}>
            <div className="muted">{days[hover]}</div>
            <strong>{fmt(values[hover])}{unit}</strong>
            {errors[hover] > 0 && <div className="muted">실패 {fmt(errors[hover])}건</div>}
          </div>
        )}
      </div>
    </figure>
  );
}
