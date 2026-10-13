'use client';

import { useEffect, useState } from 'react';

/**
 * 헤더 아래 흐르는 실시간 현황 티커.
 *
 * 글자는 서버가 만드는 HTML 에 넣지 않고, 열린 뒤에 /ticker.json 에서 받아 채운다.
 * (이전에는 37개 앱 현황 한 줄을 두 번 반복해 모든 페이지에 넣어 페이지당 426단어가 7,500개 URL 에
 *  똑같이 들어갔다 — 본문 중복률 약 90%의 절반.) 화면 높이는 그대로 유지해 레이아웃이 움직이지 않는다.
 */
export default function Ticker() {
  const [line, setLine] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/ticker.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.line) setLine(j.line);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        <span>{line ? `${line}  ✦  ` : ' '}</span>
        <span>{line ? `${line}  ✦  ` : ' '}</span>
      </div>
    </div>
  );
}
