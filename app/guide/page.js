import Link from 'next/link';
import { getRankingRows } from '../../lib/guide';
import AdUnit from '../../components/AdUnit';

const SITE_URL = 'https://quiz.jjyu.co.kr';

/**
 * 가이드 허브.
 *
 * 정답 페이지와 완전히 분리된 영역이다. 정답 페이지는 "오늘 답 뭐야"로 오는
 * 사람을 받고, 여기는 "앱테크 뭐가 돈 되나"로 오는 사람을 받는다.
 * 검색어가 다르므로 서로 순위를 잡아먹지 않는다.
 */
export const metadata = {
  title: '앱테크 가이드 — 어떤 앱이 얼마나 남는지 실측으로 비교',
  description:
    '앱테크 퀴즈 27종을 14일간 직접 수집한 기록으로 비교했습니다. 앱별 하루 적립액, 은행 앱 퀴즈 수익 비교, 실제 출제 시간표까지 매일 자동으로 갱신됩니다.',
  alternates: { canonical: '/guide/' },
};

const CARDS = [
  {
    href: '/guide/bank-quiz/',
    tag: '은행 앱',
    title: '은행 앱 퀴즈 수익 비교',
    desc: 'KB·신한·하나·케이뱅크·NH·카카오뱅크 — 어느 은행 앱이 가장 남는지 적립액과 실제 출제량으로 비교했습니다.',
  },
  {
    href: '/guide/ranking/',
    tag: '수익 순위',
    title: '앱테크 앱 수익 순위',
    desc: '27개 앱을 하루 예상 적립액으로 줄 세웠습니다. 몇 개까지 하면 월 얼마가 되는지 계산까지.',
  },
  {
    href: '/guide/timetable/',
    tag: '시간표',
    title: '앱테크 퀴즈 출제 시간표',
    desc: '앱 공지가 아니라 14일간 실제로 관측한 시각입니다. 몇 시에 무엇이 열리는지 한 표로.',
  },
];

export default function GuideHome() {
  const { windowDays, rows, sumDaily } = getRankingRows();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: '앱테크 가이드', item: `${SITE_URL}/guide/` },
        ],
      },
      {
        '@type': 'ItemList',
        name: '앱테크 가이드',
        itemListElement: CARDS.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.title,
          url: `${SITE_URL}${c.href}`,
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
        <a href="/">홈</a> › 앱테크 가이드
      </p>

      <h1>앱테크 가이드</h1>
      <p className="g-lead">
        앱테크 퀴즈 <b>{rows.length}종</b>을 {windowDays}일간 직접 수집한 기록으로 비교했습니다.
        전부 참여하면 하루 약 <b>{sumDaily.toLocaleString()}원</b>, 한 달이면 약{' '}
        <b>{(sumDaily * 30).toLocaleString()}원</b>입니다.
      </p>

      <div className="g-cards">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="g-card">
            <span className="g-card-tag">{c.tag}</span>
            <strong>{c.title}</strong>
            <span className="g-card-desc">{c.desc}</span>
            <span className="g-card-go">자세히 보기 →</span>
          </Link>
        ))}
      </div>

      <AdUnit slot="9284435988" />

      <section className="g-sec">
        <h2>이 수치는 어디서 나왔나</h2>
        <p>
          앱 공지나 다른 사이트를 옮겨 적은 값이 아닙니다. QUIZDAY는 {rows.length}개 앱의 퀴즈가
          공개되는 시각에 맞춰 하루 수십 번 자동으로 확인하고, 정답이 올라오는 즉시 기록합니다.
          이 페이지의 표는 그렇게 쌓인 최근 {windowDays}일치 기록을 그대로 계산한 것이고,
          매일 자동으로 다시 계산됩니다.
        </p>
        <p>
          그래서 <b>앱이 공지한 시각이 아니라 실제로 열린 시각</b>이 표에 들어갑니다. 두 값은 자주
          어긋납니다 — 공지에는 9시 30분이라고 적혀 있는데 실제로는 10시에 열리는 식입니다.
        </p>
      </section>

      <p className="g-back">
        <a href="/">← 오늘의 퀴즈 정답 보러 가기</a>
      </p>
    </main>
  );
}
