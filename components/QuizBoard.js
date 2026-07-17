'use client';

import { useState } from 'react';

const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'finance', label: '금융' },
  { key: 'reward', label: '리워드' },
  { key: 'life', label: '생활' },
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

export default function QuizBoard({ quizzes, counts }) {
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');

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
            return (
              <a key={quiz.slug} href={`/quiz/${quiz.slug}/`} className="quiz-card">
                <div className="qc-thumb" style={{ background: quiz.color }}>
                  <Logo quiz={quiz} />
                  <span className={`qc-badge ${count > 0 ? 'on' : ''}`}>
                    {count > 0 ? `정답 ${count}건` : '대기 중'}
                  </span>
                  <span className="qc-name">{quiz.shortName}</span>
                </div>
                <div className="qc-body">
                  <p className="qc-app">
                    {quiz.app} · {quiz.resetInfo}
                  </p>
                  <p className="qc-reward">적립 {quiz.rewardRange}</p>
                  <p className={`cta ${count > 0 ? 'hot' : ''}`}>
                    {count > 0 ? '정답 확인하기 →' : '공개되면 자동 업데이트'}
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
