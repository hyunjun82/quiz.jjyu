'use client';

import { useState, useEffect } from 'react';

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'finance', label: '금융' },
  { key: 'reward', label: '리워드' },
  { key: 'life', label: '생활' },
  { key: 'event', label: '이벤트' },
];

function Logo({ quiz }) {
  return (
    <span className="qc-logo">
      <span className="qc-fallback" style={{ color: quiz.color }}>
        {quiz.app.slice(0, 1)}
      </span>
      {quiz.iconUrl && (
        <img
          src={quiz.iconUrl}
          alt={`${quiz.app} 앱 아이콘`}
          loading="lazy"
          width="46"
          height="46"
          style={{ borderRadius: 11 }}
        />
      )}
    </span>
  );
}

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABEL = { sun: '일', mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토' };

/**
 * 다음 공개 시각 계산 (클라이언트에서만 — 하이드레이션 불일치 방지)
 * cadence가 없으면 매일 발행으로 간주. weekly/weekdays/irregular는 요일 단위로 계산해야
 * "내일 공개" 같은 잘못된 안내가 뜨지 않는다 (예: 홈플퀴즈는 매주 목요일 1회뿐).
 */
function useNextRelease() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (times, cadence) => {
    if (!now) return null;
    // 비정기(주 3~4회, 랜덤 시간) 퀴즈는 정확한 다음 공개 시각을 예측할 수 없다 — 거짓 정보를 보여주지 않는다.
    if (cadence?.type === 'irregular') return null;
    if (!times || times.length === 0) return null;

    const cur = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' });
    const todayShort = now.toLocaleDateString('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).toLowerCase();
    const todayDow = DOW_KEYS.findIndex((k) => todayShort.startsWith(k));
    const sortedTimes = times.slice().sort();
    const firstTime = sortedTimes[0];

    if (cadence?.type === 'weekly' && cadence.days?.length) {
      const targetDow = DOW_KEYS.indexOf(cadence.days[0]);
      if (targetDow === todayDow && firstTime > cur) return firstTime;
      return `${DAY_LABEL[cadence.days[0]]}요일 ${firstTime}`;
    }

    if (cadence?.type === 'weekdays') {
      const isWeekdayToday = todayDow >= 1 && todayDow <= 5;
      if (isWeekdayToday) {
        const upcoming = sortedTimes.filter((t) => t > cur);
        if (upcoming[0]) return upcoming[0];
      }
      let addDays = 0;
      let d = todayDow;
      do {
        addDays += 1;
        d = (todayDow + addDays) % 7;
      } while (d === 0 || d === 6);
      const label = addDays === 1 && isWeekdayToday ? '내일' : `${DAY_LABEL[DOW_KEYS[d]]}요일`;
      return `${label} ${firstTime}`;
    }

    const upcoming = sortedTimes.filter((t) => t > cur);
    return upcoming[0] || `내일 ${firstTime}`;
  };
}

export default function QuizBoard({ quizzes, counts }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const nextRelease = useNextRelease();

  const filtered = quizzes.filter((q) => {
    const matchCat = cat === 'all' || q.category === cat;
    const text = `${q.app} ${q.name} ${q.shortName} ${q.searchKeyword}`.toLowerCase();
    const matchQuery = query.trim() === '' || text.includes(query.trim().toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <section className="board container">
      <div className="board-tools">
        <label className="search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="text"
            placeholder="퀴즈 검색 — 토스, 오퀴즈, 쏠퀴즈…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              className={`tab ${cat === c.key ? 'active' : ''}`}
              onClick={() => setCat(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-result">검색 결과가 없습니다.</p>
      ) : (
        <div className="quiz-grid">
          {filtered.map((quiz) => {
            const count = counts[quiz.slug] || 0;
            const next = count > 0 ? null : nextRelease(quiz.releaseTimes, quiz.cadence);
            return (
              <a key={quiz.slug} href={`/quiz/${quiz.slug}/`} className="quiz-card">
                <div className="qc-thumb" style={{ background: quiz.color }}>
                  <Logo quiz={quiz} />
                  <span className={`qc-badge ${count > 0 ? 'on' : ''}`}>
                    {count > 0
                      ? quiz.eventType
                        ? '참여 링크 공개'
                        : `정답 ${count}건`
                      : next
                      ? `${next} 공개`
                      : '대기 중'}
                  </span>
                  <span className="qc-name">{quiz.shortName}</span>
                </div>
                <div className="qc-body">
                  <p className="qc-app">
                    {quiz.app} · {quiz.resetInfo}
                  </p>
                  <p className="qc-reward">적립 {quiz.rewardRange}</p>
                  <p className={`cta ${count > 0 ? 'hot' : ''}`}>
                    {count > 0
                      ? quiz.eventType
                        ? '참여 링크 확인하기 →'
                        : '정답 확인하기 →'
                      : '공개되면 자동 업데이트'}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
