import { getQuizzes, getLatestAnswers, formatKoreanDate } from '../lib/data';
import QuizBoard from '../components/QuizBoard';
import AdUnit from '../components/AdUnit';

const SITE_URL = 'https://quiz.jjyu.co.kr';

export default function HomePage() {
  const quizzes = getQuizzes();
  const data = getLatestAnswers();
  const dateLabel = data ? formatKoreanDate(data.date) : '';

  const counts = {};
  let totalAnswers = 0;
  let estToday = 0;
  for (const q of quizzes) {
    const n = data?.answers?.[q.slug]?.length ?? 0;
    counts[q.slug] = n;
    totalAnswers += n;
    if (n > 0) estToday += q.estDaily;
  }
  const estDailyAll = quizzes.reduce((s, q) => s + q.estDaily, 0);
  const estYear = estDailyAll * 365;

  const updatedTime = data
    ? new Date(data.updatedAt).toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '오늘의 앱테크 퀴즈 정답',
    itemListElement: quizzes.map((q, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: q.searchKeyword,
      url: `${SITE_URL}/quiz/${q.slug}/`,
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      <section className="hero container">
        <span className="date-chip">{dateLabel} · {updatedTime} 업데이트</span>
        <h1>
          퀴즈 정답 확인하고
          <br />
          <span className="grad">오늘도 적립하세요</span>
        </h1>
        <p className="sub">
          토스·캐시워크·신한·카카오뱅크 — 대한민국 모든 앱테크 퀴즈 정답을
          공개 즉시 한 곳에서.
        </p>
      </section>

      {/* 수익 리포트 카드 */}
      <div className="container">
        <div className="report-card">
          <div className="rc-left">
            <span className="rc-tag">📊 오늘의 적립 리포트</span>
            <h2>
              지금 <em>{totalAnswers}개</em> 퀴즈 정답이 공개되어 있어요
            </h2>
            <p>
              지금 참여하면 약 <b>{estToday.toLocaleString()}원</b> · 전체 퀴즈를 매일
              풀면 하루 약 <b>{estDailyAll.toLocaleString()}원</b>
            </p>
          </div>
          <div className="rc-right">
            <span className="rc-num">₩{estYear.toLocaleString()}</span>
            <span className="rc-lbl">1년 예상 적립금</span>
          </div>
        </div>

        <AdUnit slot="3353452458" />
      </div>

      <QuizBoard quizzes={quizzes} counts={counts} />
    </main>
  );
}
