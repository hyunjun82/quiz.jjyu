import {
  getQuizzes,
  getAnswersByDate,
  getLatestNonEmptyDate,
  formatKoreanDate,
  formatShortDate,
  formatTime,
} from '../lib/data';
import AdUnit from './AdUnit';
import TodayQuizGrid from './TodayQuizGrid';
import { getTodayQuizGridItems } from '../lib/data';

/**
 * 그리드 위치 원칙 (2026-08-14 실측 근거)
 *
 * 애드센스 형식별 실측: 전면광고는 클릭 4건에 $0.53(클릭당 $0.133),
 * 본문 광고는 클릭 58건에 $0.92(클릭당 $0.016) — 클릭당 8배 차이다.
 * 즉 돈이 되는 건 본문 광고 클릭이 아니라 '페이지 이동'(전면광고 트리거)이다.
 *
 * 그런데 이동을 만드는 그리드가 광고 2개 아래 = 스크롤해야 보이는 자리에 있었다.
 * 안 보이면 클릭이 0이다. 그래서 그리드를 광고보다 위로 올린다.
 *   - 정답 0건인 날: 볼 게 없으므로 안내문 직후 = 사실상 최상단
 *   - 정답 있는 날: 검색 의도(정답)를 먼저 채우고, 정답 목록 바로 다음
 */

/**
 * 퀴즈 상세 화면 — 문제 목록. 정답은 문제별 페이지로 이동해 확인 (PV 극대화 구조)
 */
export default function QuizDetail({ quiz, date, dates, data, isToday }) {
  const items = data?.answers?.[quiz.slug] ?? [];
  const others = getQuizzes().filter((q) => q.slug !== quiz.slug);

  // 오늘 정답이 아직 없으면 최근 정답을 대신 보여준다(빈 페이지 방지).
  // 소스가 늦거나 그날 퀴즈가 없는 날에도 방문자가 볼 게 남는다.
  const fallbackDate = items.length === 0 ? getLatestNonEmptyDate(quiz.slug, date) : null;
  const fallbackItems = fallbackDate
    ? getAnswersByDate(fallbackDate)?.answers?.[quiz.slug] ?? []
    : [];

  // 한 번만 계산해서 재사용 (예전엔 같은 함수를 두 번 호출하고 있었다)
  const grid = getTodayQuizGridItems();

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
        {/* 월간 모음(고정 주소) 진입점 — 내부 링크가 있어야 크롤러가 발견한다 */}
        <a href={`/quiz/${quiz.slug}/monthly/`} className="date-chip">
          이번달 전체
        </a>
      </nav>

      {/* 정답 0건 — 이 방문자는 여기서 얻을 게 없다. 광고보다 먼저 다른 퀴즈로 보낸다. */}
      {items.length === 0 && (
        <>
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
          <TodayQuizGrid items={grid.items} currentSlug={quiz.slug} today={grid.today} variant="strip" />
        </>
      )}

      {/* 오늘 정답이 없을 때 — 최근 정답으로 화면을 채운다. 헛걸음 방지.
          한 줄 스트립 바로 아래 = 광고보다 위. 이 페이지의 본문이 밀리면 안 된다. */}
      {items.length === 0 && fallbackItems.length > 0 && (
        <section className="fallback-block">
          <h2 className="fb-head">
            가장 최근 정답 — {formatShortDate(fallbackDate)}
            <span className="fb-n">{fallbackItems.length}건</span>
          </h2>
          <ol className="a-list">
            {fallbackItems.map((item, i) => (
              <li key={i}>
                <a href={`/quiz/${quiz.slug}/${fallbackDate}/${i + 1}/`} className="a-row">
                  <span className="a-time">{formatTime(item.publishedAt) || '—'}</span>
                  <div className="a-main">
                    <p className="a-q">{item.question}</p>
                    <span className="a-go">
                      {quiz.eventType ? '참여 링크 확인하기 →' : '정답 확인하기 →'}
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ol>
          <p className="fb-more">
            <a href={`/quiz/${quiz.slug}/monthly/`}>이번 달 정답 전체 보기 →</a>
          </p>
        </section>
      )}

      <div className="howto">
        <b>참여 방법</b> — {quiz.howTo} · {quiz.resetInfo}
      </div>

      <AdUnit slot="9284435988" />

      {items.length > 0 && (
        <>
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
        </>
      )}

      {/* 전체 그리드(24개) — 정답 목록 바로 다음 = 광고보다 위.
          목적을 달성한 직후가 이동이 가장 잘 나오는 자리다. */}
      <TodayQuizGrid items={grid.items} currentSlug={quiz.slug} today={grid.today} />

      <AdUnit slot="5919906049" />
      </div>
      <aside className="rail">
        <AdUnit slot="4223680996" className="ad-slot rail-ad" />
      </aside>
      </div>
    </main>
  );
}
