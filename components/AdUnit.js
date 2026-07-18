'use client';

import { useEffect } from 'react';

/**
 * Google AdSense 반응형 광고 단위.
 * 로더 스크립트(adsbygoogle.js)는 layout.js head에서 1회 로드됨.
 */
export default function AdUnit({ slot, className = 'ad-slot' }) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  return (
    <div className={className}>
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
