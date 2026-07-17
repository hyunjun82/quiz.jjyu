import { getQuizzes, getLatestAnswers } from '../lib/data';

/** 헤더 아래 흐르는 실시간 현황 티커 */
export default function Ticker() {
  const quizzes = getQuizzes();
  const data = getLatestAnswers();

  const items = quizzes.map((q) => {
    const n = data?.answers?.[q.slug]?.length ?? 0;
    return n > 0 ? `${q.shortName} 정답 ${n}건 공개` : `${q.shortName} 대기 중`;
  });
  const line = items.join('  ✦  ');

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        <span>{line}&nbsp;&nbsp;✦&nbsp;&nbsp;</span>
        <span>{line}&nbsp;&nbsp;✦&nbsp;&nbsp;</span>
      </div>
    </div>
  );
}
