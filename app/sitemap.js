import { getQuizzes, getAnswerDates, getAnswersByDate } from '../lib/data';

export const dynamic = 'force-static';

/**
 * ⚠️ 문제별 페이지(/quiz/{slug}/{date}/{n}/)가 이 사이트맵에서 통째로 빠져 있었다.
 *    페이지는 정상 생성돼 있었는데(200 응답) 검색엔진에 알린 적이 한 번도 없어서
 *    346개가 그냥 놀고 있었다 — 실측 확인. 롱테일 검색어를 잡는 건 이 페이지들이므로
 *    사이트맵의 핵심이 사실상 여기다. 우선순위를 날짜 페이지보다 높게 준다.
 */
export default function sitemap() {
  const base = 'https://quiz.jjyu.co.kr';
  const now = new Date();
  const quizzes = getQuizzes();
  const dates = getAnswerDates();
  // 최신 날짜가 앞에 오도록. 사이트맵 앞쪽 URL이 먼저 크롤링되는 경향이 있다.
  const recent = [...dates].sort().reverse();

  const questionUrls = [];
  for (const d of recent) {
    const data = getAnswersByDate(d);
    for (const q of quizzes) {
      const items = data?.answers?.[q.slug] ?? [];
      items.forEach((_, i) => {
        questionUrls.push({
          url: `${base}/quiz/${q.slug}/${d}/${i + 1}/`,
          lastModified: now,
          changeFrequency: 'daily',
          priority: 0.8,
        });
      });
    }
  }

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    ...quizzes.map((q) => ({
      url: `${base}/quiz/${q.slug}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 0.9,
    })),
    ...questionUrls,
    ...quizzes.flatMap((q) =>
      recent.map((d) => ({
        url: `${base}/quiz/${q.slug}/${d}/`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.6,
      })),
    ),
  ];
}
