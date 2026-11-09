// 공개용 값만 (앱 lib/src/app_state.dart 와 같음). secret · service_role 키는 절대 넣지 않음
// 데이터는 Supabase RLS 가 운영자(app_metadata.role = admin)에게만 내줌
export const SUPABASE_URL = "https://uglnrulhjplmkmemlriq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1LMLOWcbDSkI0TM-ffEt7Q_HrPqYLM0";

// geo 함수가 세는 API (api_usage_daily.api)
export const APIS: { key: string; label: string; vendor: string }[] = [
  { key: "geoapify-search", label: "해외 장소 검색", vendor: "Geoapify" },
  { key: "geoapify-reverse", label: "해외 좌표 → 주소", vendor: "Geoapify" },
  { key: "kakao-search", label: "국내 장소 검색", vendor: "카카오" },
  { key: "naver-geocode", label: "국내 주소 검색", vendor: "네이버 클라우드" },
  { key: "naver-reverse", label: "국내 좌표 → 주소", vendor: "네이버 클라우드" },
];

// 무료 한도. 업체마다 기준이 달라 확인한 것만 적음 (null = 업체 사이트에서 확인)
export const LIMITS: { label: string; apis: string[]; perDay: number | null; note: string }[] = [
  { label: "Geoapify", apis: ["geoapify-search", "geoapify-reverse"], perDay: 3000, note: "무료 하루 3,000건(검색 + 좌표 → 주소 합계)" },
  { label: "카카오", apis: ["kakao-search"], perDay: null, note: "한도는 카카오 개발자 콘솔에서 확인" },
  { label: "네이버 클라우드", apis: ["naver-geocode", "naver-reverse"], perDay: null, note: "한도 · 요금은 네이버 클라우드 콘솔에서 확인" },
];

export const DAYS = 30;

// Supabase 무료 요금제 한도 (Pro 로 올리면 바꿀 것). 저장 용량 칸의 기준
export const PLAN_LABEL = "무료 요금제";
export const PHOTO_LIMIT_BYTES = 1024 ** 3; // 사진(Storage) 1GB
export const DB_LIMIT_BYTES = 500 * 1024 ** 2; // DB 500MB
