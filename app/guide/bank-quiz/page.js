import { getBankRows } from '../../../lib/guide';
import AdUnit from '../../../components/AdUnit';

const SITE_URL = 'https://quiz.jjyu.co.kr';

/**
 * 은행 앱 퀴즈 수익 비교.
 *
 * ⚠️ 이 페이지가 이 프로젝트에서 단가가 가장 높을 자리다.
 * 정답 페이지는 "오늘 답 뭐야"라 광고주가 붙일 게 없어 CPC $0.02였다.
 * 여기는 은행 앱을 비교하는 문맥이라 은행·카드·증권이 입찰한다.
 * 같은 계정 안에서 gov 도메인이 RPM $6.75, 퀴즈가 $0.29였던 그 차이를 노린다.
 *
 * 그래서 본문을 억지로 늘리지 않고, 실제로 은행 상품을 고민하는 사람이
 * 읽을 만한 내용으로 채운다. 광고는 2개만 둔다 — 정답 페이지(372자당 1개)가
 * 광고 밀도 최악이었던 걸 반복하지 않기 위해서다.
 */
export const metadata = {
  title: '은행 앱 퀴즈 수익 비교 — KB·신한·하나·케이뱅크 어디가 남을까',
  description:
    '은행 앱 퀴즈 10종을 14일간 직접 수집해 비교했습니다. 앱별 하루 적립액, 실제 출제 문제 수, 보상 범위를 한 표로. 매일 자동 갱신됩니다.',
  alternates: { canonical: '/guide/bank-quiz/' },
};

export default function BankQuizGuide() {
  const { windowDays, rows } = getBankRows();
  const sumDaily = rows.reduce((s, r) => s + r.estDaily, 0);
  const top = rows[0];
  const everyday = rows.filter((r) => r.activeDays >= windowDays - 1);

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
            name: '은행 앱 퀴즈 수익 비교',
            item: `${SITE_URL}/guide/bank-quiz/`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: '은행 앱 퀴즈 수익 비교',
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
        <a href="/">홈</a> › <a href="/guide/">앱테크 가이드</a> › 은행 앱 퀴즈 비교
      </p>

      <h1>은행 앱 퀴즈, 어디가 가장 남을까</h1>
      <p className="g-lead">
        은행·금융 앱 퀴즈 <b>{rows.length}종</b>을 최근 {windowDays}일간 직접 수집해 비교했습니다.
        전부 참여하면 하루 약 <b>{sumDaily.toLocaleString()}원</b>, 한 달이면 약{' '}
        <b>{(sumDaily * 30).toLocaleString()}원</b>입니다.
      </p>

      <AdUnit slot="3353452458" />

      <h2>한눈에 비교</h2>
      <div className="g-table-wrap">
        <table className="g-table">
          <thead>
            <tr>
              <th>은행 앱</th>
              <th>하루 적립</th>
              <th>하루 문제</th>
              <th>보상 범위</th>
              <th>출제일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug}>
                <td>
                  <a href={`/quiz/${r.slug}/`}>{r.shortName}</a>
                </td>
                <td className="num">
                  <b>{r.estDaily.toLocaleString()}원</b>
                </td>
                <td className="num">{r.avgPerDay.toFixed(1)}문제</td>
                <td className="small">{r.rewardRange || '—'}</td>
                <td className="num small">
                  {r.activeDays}/{windowDays}일
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="g-note">
        하루 적립은 앱이 안내한 기준으로 계산한 값이고, 하루 문제는 우리가 실제로 수집한
        {windowDays}일 평균입니다. 출제일은 {windowDays}일 중 실제로 문제가 올라온 날 수입니다 —
        이 숫자가 낮으면 주말이나 공휴일에 쉬는 앱입니다.
      </p>

      <h2>표를 읽는 법</h2>

      <h3>적립액이 높다고 좋은 게 아닙니다</h3>
      <p>
        {top ? (
          <>
            적립액 1위는 <b>{top.shortName}</b>({top.estDaily.toLocaleString()}원)이지만, {windowDays}일 중{' '}
            {top.activeDays}일만 출제했습니다.
          </>
        ) : (
          '적립액만 보면 판단이 어렵습니다.'
        )}{' '}
        매일 열리는 앱과 가끔 열리는 앱은 한 달로 환산하면 순위가 뒤집힙니다. 표에서 <b>출제일</b>{' '}
        칸을 같이 보셔야 하는 이유입니다.
      </p>

      <h3>문제 수가 많으면 시간도 많이 듭니다</h3>
      <p>
        하루 문제가 많은 앱은 그만큼 손이 갑니다. 적립액을 문제 수로 나눠보면 문제 하나당 얼마인지
        나오는데, 이 값이 낮은 앱은 시간 대비 효율이 떨어집니다. 은행 앱은 대체로 문제 수가 적고
        건당 적립이 높은 편이라, 시간이 부족하다면 은행 앱부터 챙기는 게 낫습니다.
      </p>

      <h3>매일 열리는 앱부터 고정하세요</h3>
      <p>
        {windowDays}일 중 {windowDays - 1}일 이상 출제한 앱은{' '}
        <b>{everyday.map((r) => r.shortName).join(', ') || '없습니다'}</b>입니다. 이 앱들은 루틴으로
        고정해두면 빠지는 날이 없습니다. 반대로 출제일이 들쭉날쭉한 앱은 알림을 켜두거나, 이
        사이트에서 그날 열린 것만 확인하고 참여하는 편이 시간을 아낍니다.
      </p>

      <h2>은행 앱 퀴즈를 할 때 알아둘 것</h2>

      <h3>포인트마다 쓰는 곳이 다릅니다</h3>
      <p>
        같은 &quot;포인트&quot;라도 성격이 다릅니다. KB포인트리·마이신한포인트처럼 계열사 전반에서
        현금처럼 쓰이는 것이 있고, 특정 서비스 안에서만 쓰이는 것도 있습니다. 적립액이 비슷하다면
        평소에 쓰는 은행 쪽을 먼저 챙기는 편이 실제 가치가 큽니다.
      </p>

      <h3>추첨형은 기댓값으로 봐야 합니다</h3>
      <p>
        일부 은행 앱은 정액 적립이 아니라 추첨으로 지급합니다. 표의 보상 범위에 넓은 구간이
        적혀 있다면 추첨형일 가능성이 높습니다. 이런 앱은 하루 단위로 보면 0원인 날이 대부분이라,
        한 달 이상 모아서 평균으로 보셔야 실제 수익이 보입니다.
      </p>

      <h3>정답을 맞혀도 적립이 안 되는 경우</h3>
      <p>
        가장 흔한 이유는 <b>이미 그날 참여를 마친 경우</b>입니다. 앱 하나가 하루에 여러 번
        출제하더라도 적립 한도는 따로 정해져 있는 경우가 많습니다. 그 다음은 <b>정답 입력 형식</b>{' '}
        문제입니다 — 띄어쓰기나 영문 대소문자까지 그대로 입력해야 인정되는 앱이 있습니다. 마지막은{' '}
        <b>시간 초과</b>입니다. 퀴즈가 열린 뒤 일정 시간이 지나면 참여 자체가 닫힙니다.
      </p>

      <AdUnit slot="5919906049" />

      <h2>오늘 정답 바로 확인하기</h2>
      <p className="g-lead">
        아래 은행 앱들의 오늘 정답은 공개 즉시 자동으로 올라옵니다.
      </p>
      <div className="g-links">
        {rows.map((r) => (
          <a key={r.slug} href={`/quiz/${r.slug}/`} className="g-link">
            {r.shortName} 정답 →
          </a>
        ))}
      </div>

      <p className="g-back">
        <a href="/guide/">← 앱테크 가이드 전체 보기</a>
      </p>
    </main>
  );
}
