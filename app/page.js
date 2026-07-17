import { getQuizzes, getLatestAnswers, formatKoreanDate } from '../lib/data';
import QuizBoard from '../components/QuizBoard';

export default function HomePage() {
  const quizzes = getQuizzes();
  const data = getLatestAnswers();
  const dateLabel = data ? formatKoreanDate(data.date) : '';

  const counts = {};
  let totalAnswers = 0;
  let liveApps = 0;
  for (const q of quizzes) {
    const n = data?.answers?.[q.slug]?.length ?? 0;
    counts[q.slug] = n;
    totalAnswers += n;
    if (n > 0) liveApps += 1;
  }

  const updatedTime = data
    ? new Date(data.updatedAt).toLocaleTimeString('ko-KR', {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <main>
      <section className="hero container">
        <span className="date-chip">{dateLabel}</span>
        <h1>
          오늘의 퀴즈 정답,
          <br />
          <span className="grad">검색보다 빠르게.</span>
        </h1>
        <p className="sub">
          토스·캐시워크·신한·카카오뱅크 — 대한민국 모든 앱테크 퀴즈 정답을 공개 즉시
          한 곳에서 확인하세요.
        </p>
        <div className="stats">
          <div className="stat">
            <span className="num mint">{totalAnswers}</span>
            <span className="lbl">오늘 공개된 정답</span>
          </div>
          <div className="stat">
            <span className="num">{quizzes.length}</span>
            <span className="lbl">추적 중인 퀴즈</span>
          </div>
          <div className="stat">
            <span className="num">{updatedTime}</span>
            <span className="lbl">마지막 업데이트</span>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="ad-slot">AD</div>
      </div>

      <QuizBoard quizzes={quizzes} counts={counts} />
    </main>
  );
}
