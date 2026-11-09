import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import UsagePage from "./pages/Usage";
import ReportsPage from "./pages/Reports";
import PostsPage from "./pages/Posts";
import InquiriesPage from "./pages/Inquiries";
import UsersPage from "./pages/Users";
import AnnouncementsPage from "./pages/Announcements";
import StatsPage from "./pages/Stats";
import ModerationLogPage from "./pages/ModerationLog";

const isAdmin = (s: Session | null) => s?.user?.app_metadata?.role === "admin";

type Tab = "stats" | "usage" | "posts" | "reports" | "inquiries" | "users" | "announcements" | "log";
const TABS: [Tab, string][] = [["stats", "현황"], ["usage", "API 호출량"], ["posts", "게시물"], ["reports", "신고"], ["inquiries", "문의"], ["users", "사용자"], ["announcements", "공지"], ["log", "조치 기록"]];
const tabFromHash = (): Tab => (TABS.find(([k]) => `#${k}` === location.hash)?.[0] ?? "stats");

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState("");
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const handle = async (s: Session | null) => {
      if (s && !isAdmin(s)) {
        // 운영자가 아니면 바로 로그아웃 (데이터는 어차피 RLS 가 막음)
        setDenied(s.user.email ?? "이 계정");
        await supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(s);
      }
      setReady(true);
    };
    supabase.auth.getSession().then(({ data }) => handle(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s?.user?.id !== undefined || s === null) void handle(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    history.replaceState(null, "", tab === "stats" ? location.pathname : `#${tab}`);
  }, [tab]);

  const login = async () => {
    setDenied("");
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + import.meta.env.BASE_URL },
    });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!ready) return <div className="center muted">불러오는 중…</div>;

  if (!session) {
    return (
      <div className="center">
        <div className="login card">
          <div className="brand"><img className="logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />ViewPin <span>관리자</span></div>
          <button className="primary" onClick={login}>Google로 로그인</button>
          {denied && <p className="error">{denied} 은(는) 운영자 계정이 아닙니다.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><img className="logo" src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />ViewPin <span>관리자</span></div>
        <nav>
          {TABS.map(([k, label]) => (
            <button key={k} className={tab === k ? "tab on" : "tab"} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
        <div className="me">
          <span className="muted">{session.user.email}</span>
          <button className="ghost" onClick={() => supabase.auth.signOut()}>로그아웃</button>
        </div>
      </header>
      <main>
        {tab === "stats" && <StatsPage go={setTab} />}
        {tab === "usage" && <UsagePage />}
        {tab === "posts" && <PostsPage notify={setToast} />}
        {tab === "reports" && <ReportsPage notify={setToast} />}
        {tab === "inquiries" && <InquiriesPage notify={setToast} />}
        {tab === "users" && <UsersPage notify={setToast} />}
        {tab === "announcements" && <AnnouncementsPage notify={setToast} />}
        {tab === "log" && <ModerationLogPage />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
