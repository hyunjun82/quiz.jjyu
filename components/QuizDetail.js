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
      //
      // ── ItemList 추가 (2026-08-18) ──────────────────────────────
      // 경쟁사 4곳을 실측했더니 전부 콘텐츠 스키마를 갖고 있었다.
      //   토막스   ItemList, CollectionPage, FAQPage
      //   퀴즈코리아 Article, FAQPage, SpeakableSpecification
      //   똑답     ItemList, CollectionPage
      //   퀴즈벨   FAQPage, SoftwareApplication
      //   우리     BreadcrumbList 뿐 ← 페이지 내용을 설명하는 게 하나도 없었다
      //
      // ⚠️ 정답 값은 절대 넣지 않는다. 예전 FAQPage가 정답 20건을 통째로
      // 넘겨주는 통로였고(위 주석), 검색결과에 정답이 뜨면 클릭할 이유가 사라진다.
      // 여기서는 '문제 목록과 각 문제의 주소'만 선언한다 — 화면에 실제로 보이는
      // 것과 정확히 일치하므로 구조화 데이터 정책에도 맞는다.
      ...(items.length > 0
        ? [
            {
              '@type': 'ItemList',
              name: `${quiz.searchKeyword} ${date}`,
              numberOfItems: items.length,
              itemListOrder: 'https://schema.org/ItemListOrderAscending',
              itemListElement: items.map((it, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: String(it.question || `${quiz.name} ${i + 1}번 문제`).slice(0, 110),
                url: `${SITE_URL}/quiz/${quiz.slug}/${date}/${i + 1}/`,
              })),
            },
          ]
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
      <aside className="rail rail-left">
        {/* 2026-08-18: PC 레일 수동 광고 제거 (슬롯 4223680996).
            트래픽의 82%가 모바일인데 이 자리는 PC에서만 뜬다. 애드센스 7일 실측에서
            퀴즈 수동 단위 중 노출 최저 두 개(463건/1,575건) 중 하나가 이것이고,
            어느 쪽이어도 7일 수익이 $0.08~$0.44 — 최악 손실 하루 6센트다.
            반대편에 자동광고 노출RPM $2.60 vs 수동 $0.70(3.7배)라는 실측이 있어,
            이 자리를 비워 구글 자동 '사이드 레일' 형식에 넘긴다.
            aside 는 남겨둔다 — 지우면 PC 3단 그리드 폭이 바뀌어 본문이 움직인다.
            판정: 3일 뒤 quiz.jjyu.co.kr 노출RPM. 안 오르면 되돌린다. */}
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

      {/* 2026-08-19: 수동 광고 제거 실험 — 자동만 (아래/상단 주석 참고) */}
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

      {/* 가이드로 보내는 띠.
       *
       * 정답 페이지는 CPC $0.02다 — "오늘 답 뭐야"로 온 사람에게 광고주가 붙일 게
       * 없어서다. 가이드 페이지는 은행·금융 문맥이라 단가가 다르다.
       * 그래서 목적을 달성한 사람(정답 다 봄)만 여기서 한 번 더 권한다.
       *
       * ⚠️ 반드시 정답과 그리드 '아래'에만 둔다. 정답을 찾는 경로 위에 끼우면
       * 정답까지 도달하는 길이 길어지고, 그건 지금 잘 나오는 순위를 깎는다.
       */}
      {/* 2026-08-18: 1개 → 3개 + 허브로 확대.
       * 사이트맵에는 가이드 4개가 다 들어 있는데 내부 링크가 bank-quiz 하나뿐이라
       * /guide/(허브)·/ranking/·/timetable/ 로 가는 길이 사이트 안에 없었다.
       * 크롤러 발견도 늦어지고, 무엇보다 사용자 이동이 안 생겨서
       * 전면광고(노출RPM $6.74로 전 형식 중 최고)가 노출 674건에 갇혀 있었다.
       * 이탈 직전 지점에서 갈 곳을 늘린다. 위치는 그대로 그리드 아래다. */}
      <div className="guide-cta-group">
        <p className="guide-cta-head">더 알아보기</p>

        <a href="/guide/bank-quiz/" className="guide-cta">
          <span className="guide-cta-txt">
            <b>은행 앱 퀴즈, 어디가 가장 남을까</b>
            <span>KB·신한·하나·케이뱅크 적립액을 14일 실측으로 비교했습니다</span>
          </span>
          <span className="guide-cta-go">비교 보기 →</span>
        </a>

        <a href="/guide/ranking/" className="guide-cta">
          <span className="guide-cta-txt">
            <b>앱테크 앱 수익 순위</b>
            <span>하루 적립액으로 줄 세웠습니다 · 몇 개까지 하면 월 얼마인지까지</span>
          </span>
          <span className="guide-cta-go">순위 보기 →</span>
        </a>

        <a href="/guide/timetable/" className="guide-cta">
          <span className="guide-cta-txt">
            <b>퀴즈가 몇 시에 열리는지</b>
            <span>앱 공지가 아니라 실제로 올라온 시각을 14일간 기록했습니다</span>
          </span>
          <span className="guide-cta-go">시간표 보기 →</span>
        </a>

        <a href="/guide/" className="guide-cta-all">
          앱테크 가이드 전체 보기 →
        </a>
      </div>

      {/* 2026-08-18: 페이지 하단 수동 광고 제거 (슬롯 5919906049).
          오늘자 실측 — 자동 RPM $2.47 vs 수동 $0.68 (3.6배). 정답 페이지에는
          수동이 2개(본문 중간 9284435988 + 여기 하단)였는데 하단을 뺀다.
          이 자리는 가이드 링크 바로 아래라, 광고가 가이드 클릭을 뺏고 있었다 —
          가이드로 이동하면 전면광고(RPM $6.74)가 뜨므로 광고끼리 잠식이었다.
          본문 중간 것은 남긴다: 인페이지 자동 형식이 꺼져 있어(0/2) 다 빼면
          본문 광고가 0이 된다. 판정: 8/21 노출RPM. 안 오르면 롤백. */}
      </div>
      <aside className="rail">
        {/* 2026-08-18: PC 레일 수동 광고 제거 (슬롯 4223680996).
            트래픽의 82%가 모바일인데 이 자리는 PC에서만 뜬다. 애드센스 7일 실측에서
            퀴즈 수동 단위 중 노출 최저 두 개(463건/1,575건) 중 하나가 이것이고,
            어느 쪽이어도 7일 수익이 $0.08~$0.44 — 최악 손실 하루 6센트다.
            반대편에 자동광고 노출RPM $2.60 vs 수동 $0.70(3.7배)라는 실측이 있어,
            이 자리를 비워 구글 자동 '사이드 레일' 형식에 넘긴다.
            aside 는 남겨둔다 — 지우면 PC 3단 그리드 폭이 바뀌어 본문이 움직인다.
            판정: 3일 뒤 quiz.jjyu.co.kr 노출RPM. 안 오르면 되돌린다. */}
      </aside>
      </div>
    </main>
  );
}
