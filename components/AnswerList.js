'use client';

import { useState } from 'react';

/**
 * 목록에서 정답을 바로 보여주고, 한 번의 탭으로 복사하게 한다.
 *
 * ── 사용자가 실제로 하는 일 ──────────────────────────────
 * 캐시워크 앱에서 5번 문제를 풀다가, 정답을 검색해서 여기로 온다.
 * 필요한 건 정답 '한 개'이고, 그걸 앱 입력창에 붙여넣어야 한다.
 * 즉 이 화면의 성패는 "원하는 정답을 몇 번 만에 클립보드에 넣느냐"다.
 *
 * ── 그래서 반드시 쪼개야 하는 것 ─────────────────────────
 * 2026-08-19 실측: 오늘 정답 66건 중 24건(36%)이 쉼표로 이어진 복수 정답이다.
 *   예) "흡착, 수면, 안전망, 충전식, 자동살충"
 * 캐시워크 랜덤 출제형이라 같은 광고에 문제가 여러 개 붙고, 사용자는 자기 화면의
 * 초성 힌트에 맞는 하나만 고른다. 이걸 한 덩어리로 두면 모바일에서 드래그 선택을
 * 해야 하는데, 이게 이 사이트에서 가장 불편한 동작이 된다.
 * → 쉼표 단위로 쪼개 각각을 독립 복사 칩으로 만든다. 탭 한 번 = 그 값만 복사.
 *
 * ── 링크와 버튼을 분리한 이유 ────────────────────────────
 * <a> 안에 <button>을 넣는 건 HTML 규칙 위반이고(중첩 인터랙티브), 실제로도
 * 복사하려다 페이지가 이동해버린다. 그래서 행을 둘로 나눈다.
 *   · 문제 지문 영역 → 문제별 페이지 링크 (페이지 이동 = 전면광고 트리거 유지)
 *   · 정답 칩 영역   → 그 자리에서 복사 (이동 없음)
 * 둘 다 살리는 구조다.
 *
 * ⚠️ 정답 '값'은 반드시 data-nosnippet 안에 둔다.
 * 근거 — Google Search Central: data-nosnippet 은 span/div/section 에서만 동작한다.
 * 검색결과 미리보기에 정답이 새면 클릭할 이유가 사라진다(제로클릭). 색인·순위에는 영향 없음.
 */

/**
 * 정답 문자열을 복사 단위로 쪼갠다.
 * 쪼개면 안 되는 경우를 남기는 게 이 함수의 핵심이다 —
 * 문장형 정답에 쉼표가 들어 있으면 쪼갤 때 뜻이 망가진다.
 */
export function splitAnswers(answer, choices) {
  if (Array.isArray(choices) && choices.length > 0) return choices;

  const s = String(answer ?? '').trim();
  if (!s) return [];

  const parts = s.split(/\s*,\s*/).map((t) => t.trim()).filter(Boolean);
  if (parts.length < 2) return [s];

  // 조각 하나라도 길면 문장형이다("~를 확인하세요, 지금 신청" 같은 것). 통으로 둔다.
  if (parts.some((p) => p.length > 20)) return [s];

  return parts;
}

function CopyChip({ value }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // 구형 브라우저·비보안 컨텍스트 대비. 실패해도 조용히 넘어간다.
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
      <span data-nosnippet>{value}</span>
      <i className="ac-ico" aria-hidden="true">{copied ? '✓' : '⧉'}</i>
    </button>
  );
}

/** 오늘 정답 전체를 한 덩어리로 복사 — 공유·백업용. 맨 아래 사이트 주소가 따라간다. */
function CopyAll({ quiz, dateLabel, items }) {
  const [copied, setCopied] = useState(false);

  const build = () =>
    [
      `${quiz.searchKeyword} ${dateLabel}`,
      '',
      ...items.map((it, i) => {
        const vals = splitAnswers(it.answer, it.choices);
        return `${i + 1}. ${vals.join(' / ') || '(공개 대기)'}`;
      }),
      '',
      'quiz.jjyu.co.kr',
    ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(build());
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" className="ac-all" onClick={copy}>
      {copied ? `✓ ${items.length}개 복사됐어요` : `📋 오늘 정답 ${items.length}개 전체 복사`}
    </button>
  );
}

/**
 * items 는 서버(QuizDetail)에서 time 문자열까지 붙여서 내려준다.
 * lib/data 는 fs 를 쓰는 서버 모듈이라 클라이언트에서 formatTime 을 부를 수 없다.
 */
export default function AnswerList({ quiz, date, dateLabel, items }) {
  if (!items || items.length === 0) return null;

  return (
    <>
      <div className="a-lead">
        <b>
          오늘 {quiz.name}만 하더라도 무려 <em>{items.length}개</em> 허허허
        </b>
        <span>정답을 탭하면 바로 복사돼요 · 문제를 탭하면 자세히 볼 수 있어요</span>
      </div>

      <ol className="a-list">
        {items.map((item, i) => {
          const vals = splitAnswers(item.answer, item.choices);
          return (
            <li key={i} className="a-row">
              {/* 문제 지문 = 링크. 여기만 페이지 이동이다. */}
              <a href={`/quiz/${quiz.slug}/${date}/${i + 1}/`} className="a-head">
                <span className="a-time">{item.time || "—"}</span>
                <span className="a-no">{i + 1}</span>
                <p className="a-q">{item.question}</p>
              </a>

              {item.note && <p className="a-hint">{item.note}</p>}

              {/* 정답 = 복사 버튼. 이동하지 않는다. */}
              {vals.length > 0 ? (
                <div className="ac-wrap">
                  <span className="ac-label">
                    {quiz.eventType ? '참여 링크' : vals.length > 1 ? '정답 후보' : '정답'}
                  </span>
                  <div className="ac-chips">
                    {vals.map((v, k) => (
                      <CopyChip key={k} value={v} />
                    ))}
                  </div>
                </div>
              ) : (
                <a href={`/quiz/${quiz.slug}/${date}/${i + 1}/`} className="a-go">
                  자세히 보기 →
                </a>
              )}
            </li>
          );
        })}
      </ol>

      <div className="ac-foot">
        <CopyAll quiz={quiz} dateLabel={dateLabel} items={items} />
        <a href={`/quiz/${quiz.slug}/monthly/`} className="ac-month">
          📅 이번 달 정답 전체 보기 →
        </a>
      </div>
    </>
  );
}

