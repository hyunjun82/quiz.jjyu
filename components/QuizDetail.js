import {
  getQuizzes,
  formatKoreanDate,
  formatShortDate,
  formatTime,
} from '../lib/data';

/**
 * 퀴즈 상세 화면 — 문제 목록. 정답은 문제별 페이지로 이동해 확인 (PV 극대화 구조)
 */
export default function QuizDetail({ quiz, date, dates, data, isToday }) {
  const items = data?.answers?.[quiz.slug] ?? [];
  const others = getQuizzes().filter((q) => q.slug !== quiz.slug);

  const SITE_URL = 'https://quiz.jjyu.co.kr';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: quiz.searchKeyword, item: `${SITE_URL}/quiz/${quiz.slug}/` },
        ],
      },
      ...(items.length > 0
        ? [{
            '@type': 'FAQPage',
            mainEntity: items.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          }]
        : []),
    ],
  };

  return (
    <main className="container detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="detail-grid">
      <div className="detail-main">
      <p className="crumb">
        <a href="/">홈</a> › <a href={`/quiz/${quiz.slug}/`}>{quiz.app}</a>
        {!isToday && <> › {formatShortDate(date)}</>}
      </p>

      <h1>
        {quiz.searchKeyword} <span className="grad">{formatKoreanDate(date)}</span>
      </h1>

      <div className="meta-bar">
        <span className="upd">
          <span className="upd-dot" />
          {data?.updatedAt
            ? `${formatShortDate(date)} ${formatTime(data.updatedAt)} 업데이트`
            : '업데이트 대기'}
        </span>
        <span className="sep" />
        <span>정답 {items.length}건</span>
        <span className="sep" />
        <span>보상 {quiz.reward}</span>
      </div>

      <nav className="date-nav" aria-label="날짜별 정답">
        {dates.slice(0, 7).map((d, i) => {
          const active = d === date;
          return (
            <a
              key={d}
              href={`/quiz/${quiz.slug}/${i === 0 ? '' : d + '/'}`}
              className={`date-chip ${active ? 'active' : ''}`}
            >
              {i === 0 ? '오늘' : formatShortDate(d)}
            </a>
          );
        })}
      </nav>

      <div className="howto">
        <b>참여 방법</b> — {quiz.howTo} · {quiz.resetInfo}
      </div>

      <div className="ad-slot">AD</div>

      {items.length === 0 ? (
        <div className="empty">
          <b>{isToday ? '아직 오늘 정답이 등록되지 않았습니다' : '이 날짜에는 등록된 정답이 없습니다'}</b>
          {isToday && '정답이 공개되는 즉시 이 페이지가 자동으로 업데이트됩니다.'}
        </div>
      ) : (
        <ol className="a-list">
          {items.map((item, i) => (
            <li key={i}>
              <a href={`/quiz/${quiz.slug}/${date}/${i + 1}/`} className="a-row">
                <span className="a-time">{formatTime(item.publishedAt) || '—'}</span>
                <div className="a-main">
                  <p className="a-q">{item.question}</p>
                  <span className="a-go">정답 확인하기 →</span>
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}

      <div className="ad-slot">AD</div>

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
        <div className="ad-slot rail-ad">AD · PC 사이드 스티키 300×600</div>
      </aside>
      </div>
    </main>
  );
}
