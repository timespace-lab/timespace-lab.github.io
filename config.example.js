// 이 파일을 config.js 로 복사한 뒤 값을 채우고 index.html 옆에 두세요.
// config.js 가 없으면 앱은 "계정 저장 미설정" 상태로 동작합니다(로그인 없이 쓰는 기능은 모두 작동).
//
// supabaseKey 에는 Supabase 대시보드 → Project Settings → API 의
// publishable key(sb_publishable_...) 또는 legacy anon key 를 넣습니다.
// 이 키는 브라우저 공개용이며, 데이터 보호는 supabase/schema.sql 의 RLS 정책이 맡습니다.
// service_role / secret 키는 절대 넣지 마세요.
window.SIGONGGAN_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxx'
  // 선택: 지도 스타일·장소 검색을 다른 서비스로 바꿀 때 (MapLibre 스타일 주소)
  // mapStyle: 'https://tiles.openfreemap.org/styles/positron',
  // mapStyleDark: 'https://tiles.openfreemap.org/styles/dark',
  // geocodeUrl: 'https://nominatim.openstreetmap.org/search',
};
