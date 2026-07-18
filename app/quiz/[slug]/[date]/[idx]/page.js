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

export function generateMetadata({ params }) {
  const quiz = getQuizBySlug(params.slug);
  if (!quiz) return {};
  const dateLabel = formatKoreanDate(params.date);
  return {
    title: `${quiz.searchKeyword} ${dateLabel} — ${params.idx}번 문제 정답`,
    description: `${dateLabel} ${quiz.name} ${params.idx}번 문제의 정답을 확인하세요.`,
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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
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
        <AnswerBox answer={item.answer} />
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
