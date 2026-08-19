'use client';

import { useState } from 'react';

/**
 * 문제별 정답 페이지 아래에 오늘 올라온 '나머지 퀴즈와 정답'을 전부 펼친다.
 *
 * ── 왜 목록이 아니라 여기인가 ────────────────────────────
 * 목록 페이지에 정답을 깔면 상세로 들어올 이유가 없어져 전면광고(RPM $7.26)가 죽는다.
 * 그래서 순서를 뒤집었다 —
 *   목록: 문제만 + [정답 확인] → 클릭 = 페이지 이동 = 전면광고
 *   여기: 도착한 사람에게 오늘 것 전부를 준다 = 체류시간·재방문
 * 사용자 입장에서도 이게 맞다. 자기 문제 하나 찾으러 왔는데, 내려보니 오늘 풀 수 있는
 * 퀴즈 정답이 전부 모여 있으면 다른 앱까지 챙겨 간다.
 *
 * ── 정답을 쉼표로 쪼개는 이유 ────────────────────────────
 * 2026-08-19 실측: 정답 66건 중 24건(36%)이 "흡착, 수면, 안전망"처럼 쉼표로 이어진
 * 복수 정답이다. 랜덤 출제형이라 사용자는 자기 화면 초성 힌트에 맞는 하나만 고른다.
 * 통으로 두면 모바일에서 드래그 선택을 해야 한다 — 탭 한 번에 그 값만 복사되게 쪼갠다.
 */

export function splitAnswers(answer, choices) {
  if (Array.isArray(choices) && choices.length > 0) return choices;

  const s = String(answer ?? '').trim();
  if (!s) return [];

  const parts = s.split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean);
  if (parts.length < 2) return [s];

  // 조각 하나라도 길면 문장형이다. 쪼개면 뜻이 망가지니 통으로 둔다.
  if (parts.some((p) => p.length > 20)) return [s];

  return parts;
}

function CopyChip({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      className={`ac-chip ${copied ? 'ac-copied' : ''}`}
      onClick={copy}
      aria-label={`정답 ${value} 복사`}
    >
      <span>{value}</span>
      <i className="ac-ico" aria-hidden="true">{copied ? '✓' : '⧉'}</i>
    </button>
  );
}

export default function TodayAllAnswers({ groups, date, dateLabel, currentSlug, currentIdx }) {
  if (!groups || groups.length === 0) return null;

  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <section className="ta-wrap">
      <div className="ta-head">
        <h2>
          오늘 올라온 퀴즈 정답 <em>{total}개</em> 전부 공개
        </h2>
        <p>{dateLabel} · 정답을 탭하면 바로 복사돼요</p>
      </div>

      {groups.map((g) => (
        <div key={g.slug} className={`ta-grp ${g.slug === currentSlug ? 'ta-here' : ''}`}>
          <div className="ta-grp-head">
            <a href={`/quiz/${g.slug}/`}>
              <b>{g.name}</b>
              <span className="ta-n">{g.items.length}개</span>
            </a>
            {g.estDaily > 0 && <span className="ta-won">약 {g.estDaily.toLocaleString()}원</span>}
          </div>

          <ol className="ta-list">
            {g.items.map((it) => {
              const vals = splitAnswers(it.answer, it.choices);
              const here = g.slug === currentSlug && it.idx === currentIdx;
              return (
                <li key={it.idx} className={`ta-row ${here ? 'ta-cur' : ''}`}>
                  <div className="a-meta">
                    <span className="a-no">{it.idx}</span>
                    <span className="a-time">{it.time || '—'}</span>
                    {here && <span className="ta-badge">지금 보는 문제</span>}
                  </div>

                  <a href={`/quiz/${g.slug}/${date}/${it.idx}/`} className="ta-q">
                    {it.question}
                  </a>
                  {it.note && <p className="a-hint">{it.note}</p>}

                  {vals.length > 0 && (
                    <div className="ac-wrap">
                      <span className="ac-label">
                        {g.eventType ? '참여 링크' : vals.length > 1 ? '정답 후보' : '정답'}
                      </span>
                      <div className="ac-chips">
                        {vals.map((v, k) => (
                          <CopyChip key={k} value={v} />
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
