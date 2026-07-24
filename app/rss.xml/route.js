import {
  getQuizzes,
  getAnswerDates,
  getAnswersByDate,
  formatKoreanDate,
} from '../../lib/data';

export const dynamic = 'force-static';

const SITE_URL = 'https://quiz.jjyu.co.kr';

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(iso) {
  const d = iso ? new Date(iso) : new Date();
  return isNaN(d) ? new Date().toUTCString() : d.toUTCString();
}

/**
 * 정답 공개 즉시(=사이트 재빌드 시) 새 <item>이 잡히도록, 최근 3일치 정답을
 * publishedAt 최신순으로 모아 RSS 2.0 피드로 낸다. 네이버/빙 등 RSS 크롤러가
 * 검색엔진 색인을 더 빨리 가져가게 하기 위한 용도 — sitemap.xml과 역할이 다르다
 * (sitemap은 URL 존재만 알림, RSS는 "방금 새로 생긴 글"을 신호로 준다).
 */
export function GET() {
  const quizzes = getQuizzes();
  const dates = getAnswerDates().slice(0, 3);

  const items = [];
  for (const date of dates) {
    const data = getAnswersByDate(date);
    if (!data) continue;
    for (const quiz of quizzes) {
      const list = data.answers?.[quiz.slug] ?? [];
      list.forEach((item, i) => {
        const idx = i + 1;
        const url = `${SITE_URL}/quiz/${quiz.slug}/${date}/${idx}/`;
        const answerText = item.answer || (item.choices ? `정답 후보: ${item.choices.join(' / ')}` : '');
        items.push({
          title: `${quiz.searchKeyword} ${formatKoreanDate(date)} — ${item.question}`,
          link: url,
          guid: url,
          pubDate: item.publishedAt,
          description: answerText,
        });
      });
    }
  }

  items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const top = items.slice(0, 60);

  const rssItems = top
    .map(
      (it) => `  <item>
    <title>${escapeXml(it.title)}</title>
    <link>${escapeXml(it.link)}</link>
    <guid isPermaLink="true">${escapeXml(it.guid)}</guid>
    <pubDate>${toRfc822(it.pubDate)}</pubDate>
    <description>${escapeXml(it.description)}</description>
  </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>QUIZDAY — 오늘의 앱테크 퀴즈 정답</title>
  <link>${SITE_URL}/</link>
  <description>토스행운퀴즈·캐시워크·쏠퀴즈·오퀴즈 등 앱테크 퀴즈 정답을 공개 즉시 실시간으로 업데이트합니다.</description>
  <language>ko-KR</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${rssItems}
</channel>
</rss>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
