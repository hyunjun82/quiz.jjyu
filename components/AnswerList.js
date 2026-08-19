/**
 * 오늘 올라온 문제를 한 화면에 쭉 보여주고, 정답은 문제별 페이지에서 공개한다.
 *
 * ── 왜 목록에서 정답을 감추는가 ───────────────────────────
 * 2026-08-19 실측: 모바일 전면광고 RPM $7.26 · 앵커 $1.44 · 디스플레이 $0.21~$0.68.
 * 전면광고는 '페이지 이동'이 있어야 뜬다. 목록에 정답을 다 깔아두면 사용자가
 * 상세 페이지로 들어갈 이유가 사라지고, 제일 비싼 광고 형식이 통째로 죽는다.
 * 그래서 목록의 역할은 딱 두 가지다 —
 *   1) "오늘 이만큼 있다"를 보여줘서 스크롤을 유도하고
 *   2) 각 문제마다 [정답 확인] 한 번으로 상세 페이지로 넘긴다.
 *
 * ── 시각·번호를 지문 위 한 줄로 뺀 이유 ──────────────────
 * 전에는 시각을 왼쪽에 절대배치하고 지문에 padding-left 를 줬는데,
 * "오후 02:02" 폭이 그 여백을 넘겨서 지문 첫 글자를 덮었다("CJ더마켓" → "J더마켓").
 * 위로 빼면 글자 폭이 얼마든 겹칠 수가 없다.
 */

export default function AnswerList({ quiz, date, items, totalToday }) {
  if (!items || items.length === 0) return null;

  const noun = quiz.eventType ? '참여 링크' : '정답';

  return (
    <>
      <div className="a-lead">
        <b>
          오늘 {quiz.name}만 하더라도 무려 <em>{items.length}개</em> 허허허
        </b>
        <span>{noun} 확인을 누르면 문제별로 바로 열려요</span>
      </div>

      <ol className="a-list">
        {items.map((item, i) => (
          <li key={i} className="a-row">
            <div className="a-meta">
              <span className="a-no">{i + 1}</span>
              <span className="a-time">{item.time || '—'}</span>
            </div>

            <p className="a-q">{item.question}</p>
            {item.note && <p className="a-hint">{item.note}</p>}

            <a href={`/quiz/${quiz.slug}/${date}/${i + 1}/`} className="a-cta">
              {quiz.eventType ? '참여 링크 확인' : '정답 확인'} <span aria-hidden="true">→</span>
            </a>
          </li>
        ))}
      </ol>

      {/* 오늘 전체 모음집으로 보내는 후킹 띠.
          모음집을 이 페이지 안에 깔지 않고 버튼으로 뺀 이유 — 누르는 순간 페이지 이동이
          발생하고, 그게 우리 형식 중 가장 비싼 전면광고(RPM $7.26)의 트리거다. */}
      {totalToday > items.length && (
        <a href="/today/" className="today-cta">
          <span className="today-cta-txt">
            <b>
              오늘 퀴즈 <em>{totalToday}개</em> 퀴즈와 정답 확인하기
            </b>
            <span>{items.length}개는 이 앱 것이고, 나머지는 다른 앱에서 올라왔어요</span>
          </span>
          <span className="today-cta-go">
            전부 보기 <i aria-hidden="true">→</i>
          </span>
        </a>
      )}

      <div className="ac-foot">
        <a href={`/quiz/${quiz.slug}/monthly/`} className="ac-month">
          📅 이번 달 정답 전체 보기 →
        </a>
      </div>
    </>
  );
}
