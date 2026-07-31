import {
  getQuizzes,
  formatKoreanDate,
  formatShortDate,
  formatTime,
} from '../lib/data';
import AdUnit from './AdUnit';

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
      // FAQPage 스키마 제거함 — 이 페이지에서는 두 가지 이유로 특히 문제였다.
      //
      // 1) Google이 2026-05-07부터 FAQ 리치결과 노출을 중단했고 2026-06에 지원을
      //    내렸다. 이득이 0이다.
      // 2) 이 날짜별 페이지는 화면에 '문제 목록'만 보여주고 정답은 문제별 상세
      //    페이지에서만 보여준다. 그런데 스키마에는 정답을 다 넣고 있었다.
      //    Google 구조화 데이터 정책은 마크업 내용이 화면에 보여야 한다고 요구하므로
      //    이건 규칙 위반이었고, 동시에 정답 20건을 통째로 넘겨주는 통로였다.
      //
      // BreadcrumbList는 계속 지원되므로 유지한다.
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
        <AdUnit slot="4223680996" className="ad-slot rail-ad" />
      </aside>
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

      <AdUnit slot="9284435988" />

      {items.length === 0 ? (
        <div className="empty">
          <b>
            {isToday
              ? quiz.eventType
                ? '아직 오늘 참여 링크가 등록되지 않았습니다'
                : '아직 오늘 정답이 등록되지 않았습니다'
              : quiz.eventType
              ? '이 날짜에는 등록된 참여 링크가 없습니다'
              : '이 날짜에는 등록된 정답이 없습니다'}
          </b>
          {isToday &&
            (quiz.eventType
              ? '참여 링크가 공개되는 즉시 이 페이지가 자동으로 업데이트됩니다.'
              : '정답이 공개되는 즉시 이 페이지가 자동으로 업데이트됩니다.')}
        </div>
      ) : (
        <ol className="a-list">
          {items.map((item, i) => (
            <li key={i}>
              <a href={`/quiz/${quiz.slug}/${date}/${i + 1}/`} className="a-row">
                <span className="a-time">{formatTime(item.publishedAt) || '—'}</span>
                <div className="a-main">
                  <p className="a-q">{item.question}</p>
                  <span className="a-go">{quiz.eventType ? '참여 링크 확인하기 →' : '정답 확인하기 →'}</span>
                </div>
              </a>
            </li>
          ))}
        </ol>
      )}

      <AdUnit slot="5919906049" />

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
        <AdUnit slot="4223680996" className="ad-slot rail-ad" />
      </aside>
      </div>
    </main>
  );
}
