'use client';

import { useEffect, useState } from 'react';

/**
 * 오늘의 퀴즈 정주행 그리드 — 방문당 페이지수(=광고 경매 횟수)를 만드는 엔진.
 *
 * 실측 근거(2026-08-13): 방문자는 "다른 퀴즈 정답" 목록을 본 사람만 추가 페이지를
 * 연다(사장님 관찰). 경쟁사 토막스는 이걸 아이콘 그리드 + NEW 배지 + 완료 체크 +
 * "아직 N개 남음" 진행바로 게임화해서 정주행을 유도한다. 같은 구조를 우리 식으로 구현.
 *
 *  - 오늘 정답이 있는 퀴즈: 컬러 아이콘 + 깜빡이는 N 배지 + 건수
 *  - 정답 대기 중인 퀴즈: 디밍 처리 (그래도 이동 가능)
 *  - 방문한 퀴즈: 체크 표시 (localStorage, 날짜 바뀌면 자동 리셋)
 *  - 상단: 진행바 + "아직 N개 남음 — 다음: ○○ →" (다음 미방문 퀴즈로 이동)
 *
 * 모든 이동은 순수 <a href> 전체 페이지 로드 — 전면광고 트리거 유지 (검증된 규칙).
 */
export default function TodayQuizGrid({ items, currentSlug, today }) {
  // items: [{slug, name, icon, count}] — 서버에서 오늘 정답 건수까지 계산해서 내려줌
  const [visited, setVisited] = useState([]);

  useEffect(() => {
    try {
      const key = 'qd-visited';
      const raw = JSON.parse(localStorage.getItem(key) || '{}');
      const v = raw.date === today ? raw.slugs : [];
      if (currentSlug && !v.includes(currentSlug)) v.push(currentSlug);
      localStorage.setItem(key, JSON.stringify({ date: today, slugs: v }));
      setVisited(v);
    } catch {
      /* localStorage 막힌 환경이면 체크 표시만 포기 — 그리드는 그대로 동작 */
    }
  }, [currentSlug, today]);

  const withAnswers = items.filter((q) => q.count > 0);
  const remaining = withAnswers.filter((q) => !visited.includes(q.slug));
  const next = remaining[0];
  const done = withAnswers.length - remaining.length;
  const pct = withAnswers.length ? Math.round((done / withAnswers.length) * 100) : 0;

  return (
    <section className="tq" aria-label="오늘의 다른 퀴즈 정답">
      <h2 className="tq-head">🔥 오늘의 다른 퀴즈 정답</h2>
      <p className="tq-sub">앱테크 하는 김에 오늘 정답 한 번에 확인하세요</p>

      <div className="tq-bar"><span style={{ width: pct + '%' }} /></div>
      {next ? (
        <a className="tq-next" href={`/quiz/${next.slug}/`}>
          🎯 아직 {remaining.length}개 남음 — 다음: <b>{next.name}</b> →
        </a>
      ) : (
        <p className="tq-next tq-done">✅ 오늘 정답 나온 퀴즈를 전부 확인했습니다</p>
      )}

      <div className="tq-grid">
        {items.map((q) => {
          const seen = visited.includes(q.slug);
          const hot = q.count > 0;
          return (
            <a
              key={q.slug}
              href={`/quiz/${q.slug}/`}
              className={`tq-item ${hot ? '' : 'tq-wait'} ${seen ? 'tq-seen' : ''}`}
            >
              <span className="tq-ico">
                <img src={q.icon} alt="" width="52" height="52" loading="lazy" />
                {hot && !seen && <i className="tq-n">N</i>}
                {seen && <i className="tq-ok">✓</i>}
              </span>
              <span className="tq-name">{q.name}</span>
              <span className="tq-cnt">{hot ? `정답 ${q.count}건` : '대기 중'}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
