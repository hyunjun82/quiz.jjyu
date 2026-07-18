'use client';

import { useEffect, useRef } from 'react';

/**
 * Google AdSense 반응형 광고 단위.
 * 로더 스크립트(adsbygoogle.js)는 layout.js head에서 1회 로드됨.
 * 숨겨진 컨테이너(모바일에서 display:none 처리된 PC 레일 등)에서는
 * 광고 요청을 보내지 않는다 — 모바일 오노출·무효 요청 방지.
 */
export default function AdUnit({ slot, className = 'ad-slot' }) {
  const ref = useRef(null);

  useEffect(() => {
    // 보이지 않거나 폭이 없는 자리(모바일의 PC 레일)는 요청하지 않음
    if (!ref.current || ref.current.offsetWidth < 200) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className={className} ref={ref}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client="ca-pub-2442517902625121"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
