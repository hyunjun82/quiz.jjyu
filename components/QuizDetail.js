import {
  getQuizzes,
  formatKoreanDate,
  formatShortDate,
  formatTime,
} from '../lib/data';
import AnswerReveal from './AnswerReveal';

/**
 * 퀴즈 상세 화면 (오늘 페이지와 날짜별 아카이브 페이지 공용)
 */
export default function QuizDetail({ quiz, date, dates, data, isToday }) {
  const items = data?.answers?.[quiz.slug] ?? [];
  const others = getQuizzes().filter((q) => q.slug !== quiz.slug);

  const jsonLd =
    items.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        }
      : null;

  return (
    <main className="container detail">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <p className="crumb">
        <a href="/">홈</a> › <a href={`/quiz/${quiz.slug}/`}>{quiz.app}</a>
        {!isToday && <> › {formatShortDate(date)}</>}
      </p>

      <h1>
        {quiz.searchKeyword} <span className="grad">{formatKoreanDate(date)}</span>
      </h1>

      {/* 업데이트 상태 바 */}
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

      {/* 날짜 네비게이션 */}
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
            <li key={i} className="a-row">
              <span className="a-time">{formatTime(item.publishedAt) || '—'}</span>
              <div className="a-main">
                <p className="a-q">{item.question}</p>
                {item.note && <p className="a-note">{item.note}</p>}
                <AnswerReveal answer={item.answer} />
              </div>
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
    </main>
  );
}
