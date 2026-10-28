import AdUnit from './AdUnit';
import { getQuizzes, formatShortDate, formatTime } from '../lib/data';

/**
 * 월간 정답 모음 본문 — 이번 달(/quiz/{slug}/monthly/)과
 * 지난달 보관 페이지(/quiz/{slug}/monthly/2026-09/)가 같이 쓴다.
 *
 * 2026-10-28: 원래 모음 페이지는 고정 주소 하나뿐이라 달이 바뀌면 지난달 모음이 사라졌다.
 *   "하나원큐 퀴즈 9월 정답 모음" 같은 지난달 모음 페이지를 따로 남기도록 보관 페이지를 추가했다.
 */
export default function MonthlyView({ quiz, ym, days, total, isCurrent, pastLinks }) {
  const [y, m] = (ym || '').split('-').map(Number);
  const others = getQuizzes().filter((q) => q.slug !== quiz.slug).slice(0, 8);
  const monthLabel = m ? `${m}월` : '이번 달';
  const selfUrl = isCurrent ? `/quiz/${quiz.slug}/monthly/` : `/quiz/${quiz.slug}/monthly/${ym}/`;
  const noun = quiz.eventType ? '참여 링크' : '정답';

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
            name: `${y ? `${y}년 ` : ''}${monthLabel} 정답 모음`,
            item: `${SITE_URL}${selfUrl}`,
          },
        ],
      },
    ],
  };

  return (
    <main className="container detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="detail-grid">
        <aside className="rail rail-left"></aside>
        <div className="detail-main">
          <p className="crumb">
            <a href="/">홈</a> › <a href={`/quiz/${quiz.slug}/`}>{quiz.app}</a> ›{' '}
            {isCurrent ? (
              `${monthLabel} 모음`
            ) : (
              <>
                <a href={`/quiz/${quiz.slug}/monthly/`}>월간 모음</a> › {y}년 {monthLabel}
              </>
            )}
          </p>

          <h1>
            {quiz.searchKeyword} <span className="grad">{y ? `${y}년 ${m}월` : '이번 달'} 정답 모음</span>
          </h1>

          <div className="meta-bar">
            <span className="upd">
              <span className="upd-dot" />
              {isCurrent ? '정답 공개 즉시 자동 반영' : `${y}년 ${m}월 전체 기록`}
            </span>
            <span className="sep" />
            <span>
              {isCurrent ? '이번 달' : `${m}월`} {total}건
            </span>
            <span className="sep" />
            <span>{days.length}일치</span>
          </div>

          <div className="howto">
            <b>이 페이지는</b> — {quiz.name}의 {isCurrent ? '이번 달' : `${y}년 ${m}월`} {noun}을 날짜별로 모은
            페이지입니다. 오늘 것만 보려면 <a href={`/quiz/${quiz.slug}/`}>오늘의 정답 페이지</a>로 가세요.
          </div>

          {days.length === 0 ? (
            <div className="empty">
              <b>{isCurrent ? '이번 달' : `${m}월`} 정답이 아직 없습니다</b>
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

          {(pastLinks.length > 0 || !isCurrent) && (
            <section className="related">
              <h2>{quiz.searchKeyword} 월별 정답 모음</h2>
              <div className="related-grid">
                {!isCurrent && (
                  <a href={`/quiz/${quiz.slug}/monthly/`} className="related-item">
                    이번 달 정답 모음
                  </a>
                )}
                {pastLinks
                  .filter((p) => p.ym !== ym)
                  .map((p) => {
                    const [py, pm] = p.ym.split('-').map(Number);
                    return (
                      <a key={p.ym} href={`/quiz/${quiz.slug}/monthly/${p.ym}/`} className="related-item">
                        {py}년 {pm}월 정답 모음 ({p.total}건)
                      </a>
                    );
                  })}
              </div>
            </section>
          )}

          <AdUnit slot="9284435988" />
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
        <aside className="rail"></aside>
      </div>
    </main>
  );
}
