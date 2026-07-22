'use client';

import { useState } from 'react';

function CopyChip({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <button className="af-choice-chip" onClick={copy}>
      {value}
      <span className="af-choice-copied">{copied ? '✓ 복사됨' : '탭해서 복사'}</span>
    </button>
  );
}

/**
 * 정답 표시 + 원터치 복사.
 * choices가 있으면(=랜덤 출제형: 문제마다 힌트가 달라 정답 후보가 여러 개) 후보 목록을 보여준다.
 * choices가 없으면(=고정형: 매일 하나의 확정 정답) 단일 정답을 보여준다.
 */
export default function AnswerBox({ answer, choices, label = '오늘의 정답' }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (choices && choices.length > 0) {
    return (
      <div className="answer-final answer-choices">
        <p className="af-label">오늘의 정답 후보 ({choices.length}개)</p>
        <p className="af-choice-hint">
          이 퀴즈는 문제가 랜덤으로 여러 번 바뀌는 방식이에요. 내 화면에 뜬 초성 힌트와 글자 수가 맞는 정답을 아래에서 찾아 복사하세요.
        </p>
        <div className="af-choice-list">
          {choices.map((c, i) => (
            <CopyChip key={i} value={c} />
          ))}
        </div>
      </div>
    );
  }

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
