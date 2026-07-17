'use client';

import { useState } from 'react';

/**
 * 인라인 정답 공개 — 블러 처리된 정답을 탭하면 선명해지고 복사 버튼이 나타난다.
 * (광고 시청을 조건으로 잠그는 UX는 AdSense 정책 위반이므로 사용하지 않음)
 */
export default function AnswerReveal({ answer }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="ans-line">
      <button
        className={`ans-pill ${revealed ? 'open' : ''}`}
        onClick={() => (revealed ? copy({ stopPropagation: () => {} }) : setRevealed(true))}
        aria-label={revealed ? '정답 복사' : '정답 보기'}
      >
        <span className="ans-text">{answer}</span>
        {!revealed && <span className="ans-hint">탭해서 보기</span>}
      </button>
      {revealed && (
        <button className="ans-copy" onClick={copy}>
          {copied ? '복사됨 ✓' : '복사'}
        </button>
      )}
    </div>
  );
}
