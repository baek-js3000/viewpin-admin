import { supabase } from "./supabase";

export type Spot = {
  id: string; user_id: string; title: string; category: string; tags: string[];
  image_urls: string[]; thumb_urls: string[]; lat: number; lng: number;
  created_at: string; hidden_at: string | null; hidden_reason: string | null;
};

export const SPOT_COLUMNS = "id,user_id,title,category,tags,image_urls,thumb_urls,lat,lng,created_at,hidden_at,hidden_reason";

// 앱의 신고 사유와 같은 목록 (post_detail.dart _reportReasons)
export const REASONS = ["스팸·광고", "부적절한 사진", "잘못된 위치·정보", "위험한 장소 안내", "저작권 침해", "기타"];

export const thumbOf = (s: Pick<Spot, "thumb_urls" | "image_urls">) => s.thumb_urls?.[0] || s.image_urls?.[0] || "";

export const when = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" });

/** 공개 URL → Storage 경로 (앱 storagePathOf 와 같음) */
export function storagePathOf(url: string): string | null {
  const marker = "/spot-photos/";
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

export async function setHidden(spotId: string, reason: string | null) {
  const { error } = await supabase.rpc("admin_set_spot_hidden", { p_spot_id: spotId, p_reason: reason });
  if (error) throw new Error(error.message);
}

/** 게시물 삭제: 행 → 사진. 사진 삭제가 실패해도 게시물은 지워진 상태 (메시지로 알림) */
export async function deleteSpot(s: Spot): Promise<string> {
  const { error, count } = await supabase.from("spots").delete({ count: "exact" }).eq("id", s.id);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("지워진 게시물이 없습니다(권한 또는 이미 삭제됨).");
  const paths = [...new Set([...(s.image_urls ?? []), ...(s.thumb_urls ?? [])].map(storagePathOf).filter((p): p is string => !!p))];
  if (!paths.length) return "";
  const { error: e2 } = await supabase.storage.from("spot-photos").remove(paths);
  return e2 ? `게시물은 지웠지만 사진 일부를 지우지 못했습니다: ${e2.message}` : "";
}

export async function loadNames(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const { data } = await supabase.from("profiles").select("id,display_name").in("id", uniq);
  return Object.fromEntries((data ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
}
