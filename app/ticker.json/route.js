import { getQuizzes, getLatestAnswers } from '../../lib/data';

export const dynamic = 'force-static';

/**
 * 헤더 아래 흐르는 현황 띠(Ticker)가 쓰는 데이터. 빌드 때마다 새로 만들어진다.
 *
 * 왜 HTML 에 안 넣고 따로 내보내는가 (2026-10-13):
 *   티커는 37개 앱의 현황 한 줄을 마키 효과용으로 두 번 반복해서 모든 페이지 HTML 에 넣고 있었다.
 *   페이지당 약 850단어 중 426단어(50%)가 7,500개 URL 에 똑같이 들어간 것이다.
 *   본문의 약 90%가 다른 페이지와 겹쳤고(건강한 gov 사이트는 11%), 네이버가 보여주는 검색결과 설명문도
 *   페이지 고유 문장이 아니라 이 공통 영역 문구였다. 눈에 보이는 화면은 그대로 두고, 글자만 HTML 밖으로 뺀다.
 */
export function GET() {
  const quizzes = getQuizzes();
  const data = getLatestAnswers();
  const items = quizzes.map((q) => {
    const n = data?.answers?.[q.slug]?.length ?? 0;
    return n > 0 ? `${q.shortName} 정답 ${n}건 공개` : `${q.shortName} 대기 중`;
  });
  return Response.json({ line: items.join('  ✦  ') });
}
