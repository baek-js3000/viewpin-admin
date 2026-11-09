# ViewPin 관리자 웹사이트

운영자(Supabase `auth.users.app_metadata.role = 'admin'`)만 쓰는 정적 웹사이트. Vite + React + supabase-js.

- 공개용 publishable 키만 씀(`src/config.ts`). **secret · service_role 키는 넣지 않음** — 데이터는 RLS 가 운영자에게만 내줌
- 로그인: 구글(Supabase Auth). 운영자가 아니면 바로 로그아웃
- 화면: API 호출량(`api_usage_daily`, geo 함수가 셈) · 게시물(전체 보기 · 검색 · 숨기기 / 숨김 풀기 / 삭제) · 신고(게시물별 묶음 → 같은 조치)
- 숨김: `spots.hidden_at`. 숨긴 게시물은 앱에서 작성자 본인과 운영자에게만 보임(RLS). 삭제는 사진 · 신고 · 좋아요 · 북마크까지 지움

## 처음 한 번
1. Supabase SQL Editor 에서 `../photo_spot_map/supabase/admin_site.sql` 실행 (표 · 운영자 규칙 · 게시물 숨김. 여러 번 실행해도 안전)
2. geo 함수 배포: `cd ../photo_spot_map && supabase functions deploy geo --use-api`
3. Supabase 대시보드 > Authentication > URL Configuration > Redirect URLs 에 추가
   - `http://localhost:5173/**` (개발)
   - 배포한 사이트 주소 (예: `https://<github 아이디>.github.io/viewpin-admin/**`)

## 실행
```
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/ — 정적 파일
VITE_BASE=/viewpin-admin/ npm run build   # GitHub Pages 하위 경로에 올릴 때
```

## 배포 (GitHub Pages)
1. GitHub 에서 새 저장소 `viewpin-admin` 만들기 (빈 저장소, README 추가 안 함)
2. 저장소 Settings > Pages > Build and deployment > Source: **GitHub Actions**
3. 이 폴더에서 `git remote add origin https://github.com/<아이디>/viewpin-admin.git && git push -u origin main`
4. Actions 탭에서 배포가 끝나면 `https://<아이디>.github.io/viewpin-admin/` 
5. Supabase Redirect URLs 에 `https://<아이디>.github.io/viewpin-admin/**` 추가

코드에 비밀 값은 없음(공개 저장소여도 됨). 사이트 주소를 아는 사람도 운영자 계정이 아니면 아무 데이터도 못 봄.
