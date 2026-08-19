/**
 * 문제별 정답 페이지 아래 — "이 앱 정답이 N개 더 남았다"고 알리고 다음 문제로 넘긴다.
 *
 * ── 왜 여기에 정답을 깔면 안 되는가 ──────────────────────
 * 쏠퀴즈를 검색해서 들어온 사람은 쏠퀴즈 정답만 필요하다. 여기에 오늘 올라온 다른 앱
 * 정답까지 전부 펼쳐두면, 그 사람은 이 페이지 하나만 보고 나간다.
 * 우리 수익의 대부분은 '페이지 이동'에서 나온다 — 모바일 전면광고 RPM $7.26 vs
 * 본문 디스플레이 $0.21~$0.68. 이동 한 번이 본문 광고 열 번보다 크다.
 *
 * 그래서 이 자리는 정답을 '주는' 자리가 아니라 '남았다고 알리는' 자리다.
 *   쏠퀴즈 3문제 → 정답 페이지 3개 → 이동 2번 → 전면광고 기회 2번
 * 정답을 여기 다 깔면 이 2번이 0번이 된다.
 *
 * 마지막 문제까지 본 사람에게만 다른 앱으로 넘어가라고 권한다(아래 TodayQuizGrid).
 */

export default function MoreInQuiz({ quiz, date, items, currentIdx }) {
  if (!items || items.length <= 1) return null;

  const rest = items.filter((it) => it.idx !== currentIdx);
  const noun = quiz.eventType ? '참여 링크' : '정답';

  if (rest.length === 0) return null;

  return (
    <section className="mq-wrap">
      <div className="mq-head">
        <h2>
          {quiz.name} {noun}이 <em>{rest.length}개</em> 더 있어요
        </h2>
        <p>
          오늘 이 앱에만 {items.length}개가 올라왔습니다 · 하나씩 눌러서 확인하세요
        </p>
      </div>

      <ol className="mq-list">
        {rest.map((it) => (
          <li key={it.idx} className="mq-row">
            <div className="a-meta">
              <span className="a-no">{it.idx}</span>
              <span className="a-time">{it.time || '—'}</span>
            </div>

            <p className="mq-q">{it.question}</p>

            <a href={`/quiz/${quiz.slug}/${date}/${it.idx}/`} className="a-cta">
              {noun} 확인 <span aria-hidden="true">→</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
