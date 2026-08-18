import { notFound } from 'next/navigation';
import {
  getQuizzes,
  getQuizBySlug,
  getAnswerDates,
  getAnswersByDate,
  formatShortDate,
  formatTime,
} from '../../../../lib/data';
import AdUnit from '../../../../components/AdUnit';

/**
 * 월간 정답 모음 — 고정 주소 페이지 (/quiz/{slug}/monthly/)
 *
 * 왜 고정 주소인가: 날짜 주소(/2026-08-04/)는 매일 새로 태어나 검색 신뢰를
 * 0에서 시작하고 하루 만에 낡는다. 이 주소는 영원히 같고 내용만 매달
 * 갈아끼우므로, 링크와 크롤링 신호가 한 곳에 계속 쌓인다. 경쟁사 두 곳
 * (quizbells /monthly, epostphone 월별 카테고리)이 이 구조로 네이버 날짜
 * 검색까지 먹는 것을 실측 확인함(2026-08-04).
 *
 * 내용 원칙: 글 없음. 이미 수집된 정답을 날짜별로 묶어 보여주기만 한다.
 * 정답 값은 data-nosnippet — 검색결과 미리보기에 정답이 새면 클릭할 이유가
 * 사라진다(제로클릭). 색인·순위에는 영향 없음.
 */

export function generateStaticParams() {
  return getQuizzes().map((q) => ({ slug: q.slug }));
}

/** 최신 정답 날짜가 속한 달 = '이번 달'. 빌드 서버 시계(UTC) 대신 KST 데이터 날짜를 쓴다. */
function currentMonthDates() {
  const dates = getAnswerDates(); // 최신순
  if (dates.length === 0) return { ym: null, dates: [] };
  const ym = dates[0].slice(0, 7);
  return { ym, dates: dates.filter((d) => d.startsWith(ym)) };
}

function monthData(slug) {
  const { ym, dates } = currentMonthDates();
  const days = [];
  let total = 0;
  for (const d of dates) {
    const items = getAnswersByDate(d)?.answers?.[slug] ?? [];
    if (items.length > 0) {
      days.push({ date: d, items });
      total += items.length;
    }
  }
  return { ym, days, total };
}

export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const { ym, days, total } = monthData(params.slug);
  const [y, m] = (ym || '').split('-').map(Number);
  const noun = quiz.eventType ? '참여 링크' : '정답';
  const label = ym ? `${y}년 ${m}월` : '이번 달';

  // searchKeyword가 이미 '…정답'으로 끝나면 그대로 붙일 때 "정답 8월 정답"이 된다.
  const kwBase = quiz.searchKeyword.endsWith(noun)
    ? quiz.searchKeyword.slice(0, -noun.length).trim()
    : quiz.searchKeyword;

  return {
    title: `${kwBase} ${m ? `${m}월` : '이번 달'} ${noun} 모음 — 날짜별 전체 ${total}건`,
    // 정답 값은 설명에 넣지 않는다(제로클릭 방지 정책과 동일).
    description: `${label} ${quiz.name} ${noun} ${total}건을 날짜별로 한 페이지에 정리했습니다. 업데이트 ${days.length}일치, 정답 공개 즉시 자동 반영. ${quiz.reward} 바로 받아가세요.`,
    alternates: { canonical: `/quiz/${quiz.slug}/monthly/` },
  };
}

export default function MonthlyPage({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) notFound();

  const { ym, days, total } = monthData(params.slug);
  const [y, m] = (ym || '').split('-').map(Number);
  const others = getQuizzes().filter((q) => q.slug !== quiz.slug).slice(0, 8);

  const SITE_URL = 'https://quiz.jjyu.co.kr';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: quiz.searchKeyword, item: `${SITE_URL}/quiz/${quiz.slug}/` },
          {
            '@type': 'ListItem',
            position: 3,
            name: `${m ? `${m}월` : '이번 달'} 정답 모음`,
            item: `${SITE_URL}/quiz/${quiz.slug}/monthly/`,
          },
        ],
      },
    ],
  };

  return (
    <main className="container detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="detail-grid">
        <aside className="rail rail-left">
          {/* 2026-08-18: PC 레일 수동 광고 제거 — QuizDetail.js 주석 참고 */}
        </aside>
        <div className="detail-main">
          <p className="crumb">
            <a href="/">홈</a> › <a href={`/quiz/${quiz.slug}/`}>{quiz.app}</a> › {m ? `${m}월` : '이번 달'} 모음
          </p>

          <h1>
            {quiz.searchKeyword} <span className="grad">{y ? `${y}년 ${m}월` : '이번 달'} 정답 모음</span>
          </h1>

          <div className="meta-bar">
            <span className="upd">
              <span className="upd-dot" />
              정답 공개 즉시 자동 반영
            </span>
            <span className="sep" />
            <span>이번 달 {total}건</span>
            <span className="sep" />
            <span>{days.length}일치</span>
          </div>

          <div className="howto">
            <b>이 페이지는</b> — {quiz.name}의 이번 달 {quiz.eventType ? '참여 링크' : '정답'}을 날짜별로 모은
            고정 페이지입니다. 오늘 것만 보려면{' '}
            <a href={`/quiz/${quiz.slug}/`}>오늘의 정답 페이지</a>로 가세요.
          </div>

          {/* 2026-08-19: 수동 광고 제거 실험 — 자동만 (아래/상단 주석 참고) */}
          {days.length === 0 ? (
            <div className="empty">
              <b>이번 달 정답이 아직 없습니다</b>
              정답이 공개되는 즉시 이 페이지가 자동으로 업데이트됩니다.
            </div>
          ) : (
            days.map(({ date, items }) => (
              <section key={date} className="m-day">
                <h2 className="m-day-head">
                  <a href={`/quiz/${quiz.slug}/${date}/`}>
                    {formatShortDate(date)} <span className="m-day-n">정답 {items.length}건</span>
                  </a>
                </h2>
                <ol className="a-list">
                  {items.map((item, i) => (
                    <li key={i}>
                      <a href={`/quiz/${quiz.slug}/${date}/${i + 1}/`} className="a-row">
                        <span className="a-time">{formatTime(item.publishedAt) || '—'}</span>
                        <div className="a-main">
                          <p className="a-q">{item.question}</p>
                          <span className="a-go">
                            {item.answer ? (
                              <>
                                정답: <b data-nosnippet>{item.answer}</b>
                              </>
                            ) : item.choices?.length ? (
                              <span data-nosnippet>정답 후보 {item.choices.length}개 보기 →</span>
                            ) : (
                              '확인하기 →'
                            )}
                          </span>
                        </div>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            ))
          )}

          {/* 2026-08-19: 수동 광고 제거 실험 — 자동만 (아래/상단 주석 참고) */}
          <section className="related">
            <h2>다른 퀴즈 정답</h2>
            <div className="related-grid">
              {others.map((q) => (
                <a key={q.slug} href={`/quiz/${q.slug}/`} className="related-item">
                  <span className="mini-dot" style={{ background: q.color }}>
                    {q.app.slice(0, 1)}
                  </span>
                  {q.searchKeyword}
                </a>
              ))}
            </div>
          </section>
        </div>
        <aside className="rail">
          {/* 2026-08-18: PC 레일 수동 광고 제거 — QuizDetail.js 주석 참고 */}
        </aside>
      </div>
    </main>
  );
}
