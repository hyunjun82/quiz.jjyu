import { notFound } from 'next/navigation';
import {
  getQuizzes,
  getQuizBySlug,
  getAnswerDates,
  getAnswersByDate,
  formatKoreanDate,
  formatShortDate,
  formatTime,
  getTodayQuizGridItems,
} from '../../../../../lib/data';
import AnswerBox from '../../../../../components/AnswerBox';
import AdUnit from '../../../../../components/AdUnit';
import TodayQuizGrid from '../../../../../components/TodayQuizGrid';
import MoreInQuiz from '../../../../../components/MoreInQuiz';

/** 모든 (퀴즈 × 날짜 × 문제번호) 정답 페이지 생성 */
export function generateStaticParams() {
  const params = [];
  for (const d of getAnswerDates()) {
    const data = getAnswersByDate(d);
    for (const q of getQuizzes()) {
      const items = data?.answers?.[q.slug] ?? [];
      items.forEach((_, i) => {
        params.push({ slug: q.slug, date: d, idx: String(i + 1) });
      });
    }
  }
  return params;
}

/**
 * 제목에 "문제 지문"을 그대로 넣는다 — 이게 이 페이지의 존재 이유다.
 *
 * 예전 제목: "KB페이 오늘의퀴즈 정답 2026년 7월 27일 — 1번 문제 정답"
 * → "1번 문제"는 아무도 검색하지 않는다. 그래서 이 346개 페이지가 사실상 죽어 있었다.
 *
 * 사람들은 앱에 뜬 문제를 그대로 복사해서 검색한다("KB Pay 첫 만남 기념 이벤트의
 * 커피 쿠폰은 언제..."). 이런 롱테일 검색어는 경쟁이 사실상 없어서, 지문만 제목에
 * 들어가 있으면 언론사 기사보다 우리가 위에 뜬다. 대표 키워드("KB페이 퀴즈 정답")로
 * 언론사와 정면으로 붙는 것보다 훨씬 승산이 높다.
 */
export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const dateLabel = formatKoreanDate(params.date);
  const noun = quiz.eventType ? '참여 링크' : '정답';
  const item = (getAnswersByDate(params.date)?.answers?.[quiz.slug] ?? [])[
    parseInt(params.idx, 10) - 1
  ];

  // 검색결과에 잘리지 않게 지문을 적당히 줄인다. 초성 힌트는 검색어에 거의 안 쓰이므로 뺀다.
  const q = String(item?.question || '')
    .replace(/\s*\(초성\s*[:：][^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const short = q.length > 60 ? `${q.slice(0, 60)}…` : q;

  // searchKeyword가 이미 '…정답'/'…참여 링크'로 끝나는 경우가 있어 그대로 붙이면
  // "돈버는퀴즈 정답 정답"이 된다. 중복되면 뒤에 안 붙인다.
  const kw = quiz.searchKeyword;
  const kwTail = kw.endsWith(noun) ? kw : `${kw} ${noun}`;

  const title = short
    ? `${short} — ${kwTail} (${dateLabel})`
    : `${kw} ${dateLabel} — ${params.idx}번 문제 ${noun}`;

  // ⚠️ 설명(description)에는 정답 값을 절대 넣지 않는다.
  //
  // 근거 — Google Search Central "Control your snippets in Google Search":
  //   "Google sometimes uses the meta description HTML element if it might give
  //    users a more accurate description of the page than content taken directly
  //    from the page."
  // 즉 설명은 스니펫의 '보조 후보'다. 여기에 정답을 적어두면 검색결과에서
  // 정답이 그대로 노출되고, 사용자는 클릭할 이유가 사라진다(제로클릭).
  // 애드센스 수익은 클릭이 있어야 발생하므로 정답은 페이지 안에서만 보여준다.
  // 네이버는 등록 사이트의 설명을 그대로 쓰는 경향이 강해 이 조치가 특히 중요하다.
  //
  // 대신 '최신성'을 판다 — 오늘 정답이 실제로 여기 있다는 신호가 클릭을 만든다.
  // formatTime()은 toLocaleTimeString('ko-KR')을 쓰는데, 빌드 서버(Node)에 한국어
  // ICU 데이터가 없으면 "오전 10:00"이 아니라 "AM 10:00"으로 나온다. 메타 설명은
  // 빌드 시점에 만들어지므로 여기서는 ISO 문자열에서 직접 잘라 쓴다.
  // publishedAt 형식: '2026-07-31T10:00:37.179+09:00' (이미 KST)
  const hm = String(item?.publishedAt || '').slice(11, 16);
  const updated = /^\d{2}:\d{2}$/.test(hm) ? hm : '';

  return {
    title,
    description: short
      ? `${short} — ${dateLabel} ${quiz.name} ${noun} ${params.idx}번 확인하기.${
          updated ? ` ${updated} 기준 업데이트.` : ''
        } 공개 즉시 실시간으로 올립니다. ${quiz.reward} 바로 받아가세요.`
      : `${dateLabel} ${quiz.name} ${params.idx}번 문제 ${noun}을 지금 바로 확인하고 ${quiz.reward} 받아가세요. 공개 즉시 실시간 업데이트됩니다.`,
    alternates: { canonical: `/quiz/${quiz.slug}/${params.date}/${params.idx}/` },
  };
}

export default function AnswerPage({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) notFound();

  const data = getAnswersByDate(params.date);
  const items = data?.answers?.[quiz.slug] ?? [];
  const idx = parseInt(params.idx, 10);
  const item = items[idx - 1];
  if (!item) notFound();

  const others = getQuizzes().filter((q) => q.slug !== quiz.slug);
  const grid = getTodayQuizGridItems(); // 한 번만 계산해서 재사용

  /* 이 앱의 오늘 문제 목록 — 지문과 시각만. 정답은 넣지 않는다.
   *
   * 정답을 여기 실어 보내면 다음 문제 페이지로 갈 이유가 없어지고,
   * 전 형식 중 가장 비싼 전면광고(RPM $7.26)의 트리거인 '페이지 이동'이 사라진다.
   * 이 블록의 목적은 "이 앱 정답이 N개 더 남았다"를 알려 다음 페이지로 넘기는 것이다. */
  const quizItems = items.map((it, i) => ({
    idx: i + 1,
    question: it.question,
    time: formatTime(it.publishedAt) || '',
  }));

  /* 오늘 사이트 전체 정답 건수 — 모음집 버튼 후킹 문구에 쓴다.
     모음집 자체는 /today/ 에 두고 여기서는 '버튼'만 노출한다. 버튼 클릭 = 페이지 이동 =
     전면광고(RPM $7.26) 1회 추가. 정답을 여기 깔면 그 이동이 사라진다. */
  const todayTotal = Object.values(getAnswersByDate(params.date)?.answers ?? {}).reduce(
    (n, arr) => n + (arr?.length ?? 0),
    0,
  );
  const SITE_URL = 'https://quiz.jjyu.co.kr';
  const dateLabel = formatKoreanDate(params.date);
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
            name: `${dateLabel} ${params.idx}번 문제`,
            item: `${SITE_URL}/quiz/${quiz.slug}/${params.date}/${params.idx}/`,
          },
        ],
      },
      // FAQPage 스키마 제거함.
      //
      // 근거 — Google Search Central "FAQ (FAQPage) structured data" 공지:
      //   "As of May 7, 2026, FAQ rich results are no longer appearing in Google Search.
      //    We will be dropping the FAQ search appearance, rich result report, and
      //    support in the Rich results test in June 2026."
      // 즉 이 스키마는 이제 검색결과에 아무 이득이 없다. 반면 acceptedAnswer 필드에
      // 정답을 그대로 넣어두면 기계가 읽기 좋은 형태로 정답을 넘겨주는 셈이라
      // 손해만 남는다. BreadcrumbList는 계속 지원되므로 그대로 둔다.
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
      </aside>
      <div className="detail-main">
      <p className="crumb">
        <a href="/">홈</a> › <a href={`/quiz/${quiz.slug}/`}>{quiz.app}</a> ›{' '}
        {formatShortDate(params.date)} {idx}번 문제
      </p>

      <h1>
        {quiz.searchKeyword} <span className="grad">{formatKoreanDate(params.date)}</span>
      </h1>

      <div className="meta-bar">
        <span className="upd">
          <span className="upd-dot" />
          {formatTime(item.publishedAt) || ''} 업데이트
        </span>
        <span className="sep" />
        <span>
          {idx} / {items.length}번 문제
        </span>
      </div>

      <article className="q-card" data-idx={String(idx).padStart(2, '0')}>
        <p className="q-label">Question {idx}</p>
        <h2 className="q-title">{item.question}</h2>
        {item.note && <p className="a-note">{item.note}</p>}
        <AnswerBox
          answer={item.answer}
          choices={item.choices}
          label={quiz.eventType ? '오늘의 참여 링크' : '오늘의 정답'}
          /* 공유 문구 — 제목만. 정답은 넣지 않는다(받은 사람이 링크를 눌러야 하니까). */
          shareText={`${quiz.searchKeyword} ${dateLabel}`}
        />
      </article>

      {/* 문제 간 이동 — 자연스러운 추가 PV
       *
       * ⚠️ 예전엔 여기(정답 카드와 이동 버튼 사이)에 300px 광고가 끼어 있었다.
       * 정답을 본 사람이 '다음 문제'로 손가락을 내리는 경로 한복판이라 실수 클릭이
       * 대량으로 찍혔다. 2026-08-14 실측: 페이지 CTR 10.8%(정상 1~3%),
       * 본문 광고 클릭당 $0.016 vs 전면광고 클릭당 $0.133 — 8배 차이.
       * 값 없는 클릭은 스마트 프라이싱으로 단가를 깎으므로 광고를 경로 밖으로 내렸다.
       */}
      <nav className="q-nav">
        {idx > 1 && (
          <a href={`/quiz/${quiz.slug}/${params.date}/${idx - 1}/`} className="q-nav-btn">
            ← 이전 문제
          </a>
        )}
        <a href={`/quiz/${quiz.slug}/`} className="q-nav-btn">
          문제 목록
        </a>
        {idx < items.length && (
          <a href={`/quiz/${quiz.slug}/${params.date}/${idx + 1}/`} className="q-nav-btn primary">
            다음 문제 정답 →
          </a>
        )}
      </nav>

      <MoreInQuiz
        quiz={quiz}
        date={params.date}
        items={quizItems}
        currentIdx={idx}
      />

      {todayTotal > items.length && (
        <a href="/today/" className="today-cta">
          <span className="today-cta-txt">
            <b>
              오늘 퀴즈 <em>{todayTotal}개</em> 퀴즈와 정답 확인하기
            </b>
            <span>{quiz.name} 말고도 오늘 올라온 정답이 전부 모여 있어요</span>
          </span>
          <span className="today-cta-go">
            전부 보기 <i aria-hidden="true">→</i>
          </span>
        </a>
      )}

      {/* 정주행 그리드 — 광고보다 위로. 스크롤 없이 "오늘 다른 퀴즈 N개" 가 보여야 이동이 난다. */}
      <TodayQuizGrid items={grid.items} currentSlug={quiz.slug} today={grid.today} />

      {/* 가이드로 보내는 띠 — 정답과 이동 버튼 아래에만. (QuizDetail.js 주석 참고)
          정답 페이지는 CPC $0.02고 가이드는 금융 문맥이라 단가가 다르다.
          목적을 달성한 사람만 여기서 한 번 더 권한다. */}
      <a href="/guide/ranking/" className="guide-cta">
        <span className="guide-cta-txt">
          <b>어떤 앱이 제일 남을까 — 앱테크 수익 순위</b>
          <span>27개 앱을 하루 적립액으로 줄 세웠습니다 · 14일 실측</span>
        </span>
        <span className="guide-cta-go">순위 보기 →</span>
      </a>

      <AdUnit slot="9284435988" />
      </div>
      <aside className="rail">
      </aside>
      </div>
    </main>
  );
}
