import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const alt = 'QUIZDAY — 오늘의 앱테크 퀴즈 정답 실시간';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * 정적 OG 이미지 — 경쟁사(퀴즈벨 등)는 og:image가 있는데 우리는 없어서 카톡/네이버
 * 공유 미리보기가 텅 비어 보였음. 브랜드 그라디언트(#6d5cff → #3d7bfa)로 통일.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6d5cff 0%, #3d7bfa 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 96,
              height: 96,
              borderRadius: 24,
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              fontSize: 56,
              fontWeight: 800,
            }}
          >
            Q
          </div>
          <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#fff' }}>
            QUIZDAY
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700, color: '#fff' }}>
          오늘의 앱테크 퀴즈 정답, 실시간 업데이트
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 28,
            fontSize: 30,
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          토스 · 캐시워크 · 쏠퀴즈 · 오퀴즈 · KB페이 외 20개+
        </div>
      </div>
    ),
    { ...size },
  );
}
