import { getTimetable } from '../../../lib/guide';
import AdUnit from '../../../components/AdUnit';

const SITE_URL = 'https://quiz.jjyu.co.kr';

/**
 * 출제 시간표.
 *
 * 이 페이지의 값어치는 '실측'이다. 경쟁사는 앱 공지를 옮겨 적는데,
 * 2026-08-17 우리 실측에서 설정값(앱 공지 기준)이 실제와 30분씩 어긋난 걸
 * 확인했다 — 캐시닥은 공지에 없는 10시가 실제 최대 피크였다.
 * 그래서 여기서는 releaseTimes(공지)가 아니라 byHour(관측)를 쓴다.
 */
export const metadata = {
  title: '앱테크 퀴즈 시간표 — 몇 시에 열리는지 14일 실측',
  description:
    '앱테크 퀴즈가 실제로 몇 시에 열리는지 14일간 직접 관측해 정리했습니다. 앱 공지가 아니라 실제 공개 시각이라 공지와 다른 경우가 많습니다. 매일 자동 갱신됩니다.',
  alternates: { canonical: '/guide/timetable/' },
};

const label = (h) => `${String(h).padStart(2, '0')}시`;

export default function TimetableGuide() {
  const { windowDays, hours, rows } = getTimetable();
  const busiest = [...hours].sort((a, b) => {
    const sa = a.list.reduce((s, x) => s + x.n, 0);
    const sb = b.list.reduce((s, x) => s + x.n, 0);
    return sb - sa;
  })[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '앱테크 가이드', item: `${SITE_URL}/guide/` },
          {
            '@type': 'ListItem',
            position: 3,
            name: '앱테크 퀴즈 시간표',
            item: `${SITE_URL}/guide/timetable/`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: '앱테크 퀴즈 출제 시간표',
        numberOfItems: hours.length,
        itemListElement: hours.map((h, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${label(h.hour)} — ${h.list.map((x) => x.shortName).join(', ')}`,
        })),
      },
    ],
  };

  return (
    <main className="container guide">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <p className="crumb">
        <a href="/">홈</a> › <a href="/guide/">앱테크 가이드</a> › 출제 시간표
      </p>

      <h1>앱테크 퀴즈, 몇 시에 열리나</h1>
      <p className="g-lead">
        앱 공지를 옮겨 적은 게 아닙니다. 최근 <b>{windowDays}일간 실제로 정답이 올라온 시각</b>을
        기록해 정리했습니다.{' '}
        {busiest ? (
          <>
            가장 많이 열리는 시간대는 <b>{label(busiest.hour)}</b>입니다.
          </>
        ) : null}
      </p>

      {/* 2026-08-19: 수동 광고 제거 실험 — 자동만 (아래/상단 주석 참고) */}
      <h2>시간대별 출제 표</h2>
      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>시각</th>
              <th>이 시간에 열리는 퀴즈</th>
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h.hour}>
                <td className="num">
                  <b>{label(h.hour)}</b>
                </td>
                <td className="small">
                  {h.list.slice(0, 8).map((x, i) => (
                    <span key={x.slug}>
                      {i > 0 && ' · '}
                      <a href={`/quiz/${x.slug}/`}>{x.shortName}</a>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="g-note">
        {windowDays}일 동안 그 시간대에 2건 이상 올라온 퀴즈만 표에 넣었습니다. 한 번뿐인 건
        우연일 수 있어 뺐습니다.
      </p>

      <h2>이 표를 어떻게 쓰나</h2>

      <h3>자정과 오전 10시만 챙겨도 절반입니다</h3>
      <p>
        앱테크 퀴즈는 특정 시간대에 몰립니다. 하루 종일 앱을 들여다볼 필요가 없고, 몰리는 시간대에만
        한 번씩 확인하면 대부분을 챙길 수 있습니다.
      </p>

      <h3>공지 시각과 다를 수 있습니다</h3>
      <p>
        앱 공지에는 9시 30분이라고 적혀 있는데 실제로는 10시에 열리는 경우가 흔합니다. 이 표는
        공지가 아니라 실제로 올라온 시각이라, 공지를 보고 기다렸다가 허탕치는 일을 줄일 수 있습니다.
      </p>

      <h3>기다릴 필요가 없습니다</h3>
      <p>
        QUIZDAY는 이 시간표에 맞춰 자동으로 확인하고 정답을 올립니다. 시간을 외워두는 것보다{' '}
        <a href="/">오늘의 정답 페이지</a>를 한 번 열어보는 편이 빠릅니다. 지금 열려 있는 퀴즈가
        몇 개인지 바로 보입니다.
      </p>

      {/* 2026-08-19: 수동 광고 제거 실험 — 자동만 (아래/상단 주석 참고) */}
      <h2>앱별 출제 요약</h2>
      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>앱</th>
              <th>하루 문제</th>
              <th>출제일</th>
              <th>참여 경로</th>
            </tr>
          </thead>
          <tbody>
            {[...rows]
              .sort((a, b) => b.avgPerDay - a.avgPerDay)
              .map((r) => (
                <tr key={r.slug}>
                  <td>
                    <a href={`/quiz/${r.slug}/`}>{r.shortName}</a>
                  </td>
                  <td className="num">{r.avgPerDay.toFixed(1)}</td>
                  <td className="num small">
                    {r.activeDays}/{windowDays}
                  </td>
                  <td className="small">{r.howTo || '—'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="g-back">
        <a href="/guide/">← 앱테크 가이드 전체 보기</a>
      </p>
    </main>
  );
}
