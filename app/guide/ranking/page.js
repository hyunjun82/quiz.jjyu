import { getRankingRows } from '../../../lib/guide';
import AdUnit from '../../../components/AdUnit';

const SITE_URL = 'https://quiz.jjyu.co.kr';

export const metadata = {
  title: '앱테크 앱 수익 순위 — 뭐부터 깔아야 남을까',
  description:
    '앱테크 퀴즈 앱을 하루 예상 적립액으로 줄 세웠습니다. 14일간 직접 수집한 실제 출제량까지 함께 비교하고, 몇 개까지 하면 월 얼마인지 계산했습니다.',
  alternates: { canonical: '/guide/ranking/' },
};

export default function RankingGuide() {
  const { windowDays, rows, sumDaily, sumQuestions } = getRankingRows();

  // "상위 N개만 하면 얼마" — 앱을 다 깔 수 없는 사람이 실제로 궁금해하는 계산.
  const cum = [];
  let acc = 0;
  let accQ = 0;
  rows.forEach((r, i) => {
    acc += r.estDaily;
    accQ += r.avgPerDay;
    if ([3, 5, 10, 15, 20, rows.length].includes(i + 1)) {
      cum.push({ n: i + 1, daily: acc, monthly: acc * 30, questions: accQ });
    }
  });

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
            name: '앱테크 앱 수익 순위',
            item: `${SITE_URL}/guide/ranking/`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: '앱테크 앱 수익 순위',
        numberOfItems: rows.length,
        itemListElement: rows.map((r, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: r.name,
          url: `${SITE_URL}/quiz/${r.slug}/`,
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
        <a href="/">홈</a> › <a href="/guide/">앱테크 가이드</a> › 수익 순위
      </p>

      <h1>앱테크 앱 수익 순위</h1>
      <p className="g-lead">
        퀴즈를 내는 앱 <b>{rows.length}종</b>을 하루 예상 적립액으로 줄 세웠습니다. 전부 매일 하면
        하루 약 <b>{sumDaily.toLocaleString()}원</b>, 한 달이면 약{' '}
        <b>{(sumDaily * 30).toLocaleString()}원</b>이고, 풀어야 하는 문제는 하루 약{' '}
        <b>{Math.round(sumQuestions)}개</b>입니다.
      </p>

      <AdUnit slot="3353452458" />
      <h2>몇 개까지 하면 얼마가 되나</h2>
      <p>
        앱을 전부 깔 필요는 없습니다. 위에서부터 몇 개까지 했을 때 얼마가 되는지 계산했습니다.
      </p>
      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>상위</th>
              <th>하루 적립</th>
              <th>월 적립</th>
              <th>하루 문제 수</th>
            </tr>
          </thead>
          <tbody>
            {cum.map((c) => (
              <tr key={c.n}>
                <td>
                  <b>{c.n}개</b>
                </td>
                <td className="num">{c.daily.toLocaleString()}원</td>
                <td className="num">
                  <b>{c.monthly.toLocaleString()}원</b>
                </td>
                <td className="num small">{Math.round(c.questions)}개</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="g-note">
        상위 몇 개만 해도 전체의 상당 부분이 채워집니다. 아래쪽 앱들은 적립액은 작은데 문제 수는
        비슷해서, 시간 대비 효율이 떨어집니다.
      </p>

      <h2>전체 순위</h2>
      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>#</th>
              <th>앱</th>
              <th>하루 적립</th>
              <th>하루 문제</th>
              <th>출제일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.slug}>
                <td className="num small">{i + 1}</td>
                <td>
                  <a href={`/quiz/${r.slug}/`}>{r.shortName}</a>
                </td>
                <td className="num">
                  <b>{r.estDaily.toLocaleString()}원</b>
                </td>
                <td className="num">{r.avgPerDay.toFixed(1)}</td>
                <td className="num small">
                  {r.activeDays}/{windowDays}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdUnit slot="9284435988" />
      <h2>순위를 그대로 따라가면 안 되는 이유</h2>

      <h3>적립액과 걸리는 시간은 비례하지 않습니다</h3>
      <p>
        하루 문제가 열 개가 넘는 앱이 있고 한 개인 앱이 있습니다. 적립액이 같다면 문제가 적은
        쪽이 훨씬 효율적입니다. 표의 <b>하루 문제</b> 칸을 적립액과 나란히 보셔야 합니다.
      </p>

      <h3>출제일이 낮으면 월 수익이 줄어듭니다</h3>
      <p>
        {windowDays}일 중 며칠만 출제하는 앱은 하루 적립액이 높아도 한 달 합계로는 밀립니다. 주말과
        공휴일에 쉬는 앱이 특히 그렇습니다.
      </p>

      <h3>한 앱에서 하루 여러 번 열리기도 합니다</h3>
      <p>
        캐시워크나 캐시닥처럼 하루에 열 번 넘게 열리는 앱은 한 번에 다 풀 수 없습니다. 열리는
        시각을 알고 그때만 들어가는 게 현실적입니다.{' '}
        <a href="/guide/timetable/">출제 시간표</a>에 우리가 실제로 관측한 시각을 정리해뒀습니다.
      </p>

      <h2>오늘 정답 바로 확인하기</h2>
      <div className="g-links">
        {rows.slice(0, 12).map((r) => (
          <a key={r.slug} href={`/quiz/${r.slug}/`} className="g-link">
            {r.shortName} →
          </a>
        ))}
      </div>

      <p className="g-back">
        <a href="/guide/">← 앱테크 가이드 전체 보기</a>
      </p>
    </main>
  );
}
