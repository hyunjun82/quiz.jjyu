'use client';

import { useState } from 'react';

/** 정답 표시 + 원터치 복사 */
export default function AnswerBox({ answer, label = '오늘의 정답' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="answer-final" onClick={copy}>
      <p className="af-label">{label}</p>
      <p className="af-value">{answer}</p>
      <button className="af-copy" onClick={copy}>
        {copied ? '복사되었습니다 ✓' : '탭해서 복사'}
      </button>
    </div>
  );
}
