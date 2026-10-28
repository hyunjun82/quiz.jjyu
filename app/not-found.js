/**
 * 404 페이지 (2026-10-28 추가)
 *
 * 왜: 오답·이월을 지우면 그날 문제 번호가 당겨져 마지막 번호 주소가 사라진다.
 *   빌드 때 out/_redirects 로 알려진 주소는 301 처리하지만(scripts/gen-redirects.mjs),
 *   수집기 자가치유처럼 삭제 기록(deleted.json)을 안 남긴 삭제는 거기서 빠진다
 *   (실측: /quiz/cashwalk/2026-08-15/14/ 28일간 404 조회 5회).
 *   그래서 404 가 나면 주소 모양을 보고 가장 가까운 정답 페이지로 바로 보낸다.
 *     /quiz/{앱}/{날짜}/{번호}/ → 그날 정답 페이지
 *     /quiz/{앱}/{날짜}/       → 그 앱 오늘 정답 페이지
 *     /quiz/{앱}/...           → 그 앱 오늘 정답 페이지
 */
const REDIRECT = `(function(){try{
var p=location.pathname, m;
if((m=p.match(/^\\/quiz\\/([a-z0-9-]+)\\/(\\d{4}-\\d{2}-\\d{2})\\/\\d+\\/?$/))){location.replace('/quiz/'+m[1]+'/'+m[2]+'/');return;}
if((m=p.match(/^\\/quiz\\/([a-z0-9-]+)\\//)) && p!=='/quiz/'+m[1]+'/'){location.replace('/quiz/'+m[1]+'/');return;}
}catch(e){}})();`;

export const metadata = {
  title: '페이지를 찾을 수 없습니다',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="container detail">
      <script dangerouslySetInnerHTML={{ __html: REDIRECT }} />
      <div className="empty" style={{ margin: '48px 0' }}>
        <b>찾는 페이지가 없습니다</b>
        정답 페이지로 이동 중입니다. 이동하지 않으면{' '}
        <a href="/today/">오늘 퀴즈 정답 전체 보기</a>를 눌러주세요.
      </div>
    </main>
  );
}
