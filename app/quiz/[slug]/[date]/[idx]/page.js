import { notFound } from 'next/navigation';
import {
  getQuizzes,
  getQuizBySlug,
  getAnswerDates,
  getAnswersByDate,
  formatKoreanDate,
  formatShortDate,
  formatTime,
} from '../../../../../lib/data';
import AnswerBox from '../../../../../components/AnswerBox';
import AdUnit from '../../../../../components/AdUnit';

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

  const answerText = item?.answer
    ? `정답은 '${item.answer}'입니다.`
    : item?.choices?.length
      ? `정답 후보: ${item.choices.join(' / ')}.`
      : '';

  return {
    title,
    // 지문 + 정답을 설명에도 넣어 검색결과에서 바로 눈에 띄게 한다.
    description: short
      ? `${short} ${answerText} ${dateLabel} ${quiz.name} ${noun}을 공개 즉시 실시간으로 올립니다. ${quiz.reward} 바로 받아가세요.`
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
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer || (item.choices ? `정답 후보: ${item.choices.join(' / ')}` : ''),
            },
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
        <AdUnit slot="4223680996" className="ad-slot rail-ad" />
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

      <AdUnit slot="3353452458" />

      <article className="q-card" data-idx={String(idx).padStart(2, '0')}>
        <p className="q-label">Question {idx}</p>
        <h2 className="q-title">{item.question}</h2>
        {item.note && <p className="a-note">{item.note}</p>}
        <AnswerBox
          answer={item.answer}
          choices={item.choices}
          label={quiz.eventType ? '오늘의 참여 링크' : '오늘의 정답'}
        />
      </article>

      {/* 💰 최고 수익 슬롯: 정답 확인 직후 = 목적 달성 시점, 시선이 머무는 자리 */}
      <AdUnit slot="5919906049" className="ad-slot ad-rect" />

      {/* 문제 간 이동 — 자연스러운 추가 PV */}
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
      <aside className="rail">
        <AdUnit slot="4223680996" className="ad-slot rail-ad" />
      </aside>
      </div>
    </main>
  );
}
