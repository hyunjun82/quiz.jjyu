import './globals.css';
import Ticker from '../components/Ticker';

const SITE_URL = 'https://quiz.jjyu.co.kr';

/**
 * 구글 서치콘솔 소유확인 코드.
 *
 * 2026-08-18 확인: 지난 7일 트래픽 소스에서 구글 유입이 $0으로,
 * Bing($5.22)보다도 적었다. 네이버 인증 태그만 있고 구글은 없다.
 *
 * 넣는 법 — 서치콘솔 → 속성 추가 → 'URL 접두어'에 https://quiz.jjyu.co.kr 입력
 * → 소유권 확인 방법에서 'HTML 태그' 선택 → 나오는 코드의 content="..." 안의
 * 값만 아래 따옴표 사이에 붙여넣으면 된다. 빈 문자열이면 태그가 렌더링되지 않는다.
 */
const GOOGLE_SITE_VERIFICATION = '';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '토스·캐시워크·쏠퀴즈 정답 실시간 | QUIZDAY',
    template: '%s | QUIZDAY',
  },
  description:
    '토스행운퀴즈·캐시워크·쏠퀴즈·오퀴즈 등 앱테크 퀴즈 정답을 공개 즉시 실시간 업데이트합니다.',
  keywords: [
    '퀴즈정답', '토스행운퀴즈 정답', '돈버는퀴즈 정답', '쏠퀴즈 정답',
    '오퀴즈 정답', '카뱅 AI 퀴즈 정답', '용돈퀴즈 정답', '앱테크',
  ],
  openGraph: { type: 'website', locale: 'ko_KR', siteName: 'QUIZDAY' },
  robots: { index: true, follow: true },
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'QUIZDAY',
      description: '앱테크 퀴즈 정답 실시간 업데이트',
      inLanguage: 'ko-KR',
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'QUIZDAY',
      url: SITE_URL,
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta
          name="naver-site-verification"
          content="aeab35a19c380adc4d6926a966e13249ca4ac495"
        />
        {GOOGLE_SITE_VERIFICATION ? (
          <meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
        ) : null}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="QUIZDAY — 오늘의 앱테크 퀴즈 정답"
          href="/rss.xml"
        />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        {/* Offerwall 표시 제어 — 정답이 공개되는 페이지(/today, /quiz/앱/날짜…)에서만 오퍼월을 허용한다.
            목록 페이지(문제만 보임)에서는 오퍼월을 보류해, "정답 확인 클릭 → 정답 페이지 도착 → 오퍼월 → 광고 → 정답" 순서를 만든다.
            반드시 애드센스 스크립트보다 먼저 실행돼야 한다(구글 공식 controlledMessagingFunction 규격).
            오퍼월 외 다른 메시지 유형은 건드리지 않는다. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.googlefc=window.googlefc||{};googlefc.callbackQueue=googlefc.callbackQueue||[];googlefc.controlledMessagingFunction=function(m){var p=location.pathname;var reveal=/^\\/today(\\/|$)/.test(p)||/^\\/quiz\\/[^/]+\\/\\d{4}-\\d{2}-\\d{2}(\\/|$)/.test(p);if(reveal){m.proceed(true);}else{var t=[];try{if(window.googlefc.MessageTypeEnum){t.push(window.googlefc.MessageTypeEnum.OFFERWALL);}}catch(e){}m.proceed(false,t);}};",
          }}
        />
        {/* Google AdSense — 사이트 소유 확인 및 광고 게재 */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2442517902625121"
          crossOrigin="anonymous"
        />
        {/* 폰트 CSS 비동기 로드 — 렌더링 차단 제거 (시스템 폰트 즉시 표시 후 교체) */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';document.head.appendChild(l);})();",
          }}
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body>
        <div className="glow" />
        <header className="site-header">
          <div className="container">
            <a href="/" className="logo">
              <span className="mark">Q</span>
              QUIZ<em>DAY</em>
            </a>
            <span className="live-pill">
              <span className="live-dot" />
              실시간 업데이트
            </span>
          </div>
        </header>
        <Ticker />
        {children}
        <footer className="site-footer">
          <div className="container">
            <p>
              QUIZDAY는 각 앱에서 진행되는 퀴즈 이벤트의 정답 정보를 정리해 제공하는 정보
              서비스이며, 각 이벤트 주최사와 무관합니다. 표기된 로고·상표는 각 소유자의
              자산입니다.
            </p>
            <p>정답은 이벤트 진행 중 변경될 수 있으니 앱 내 안내를 함께 확인해 주세요.</p>
            <p>
              © {new Date().getFullYear()} quiz.jjyu.co.kr ·{' '}
              <a href="/privacy/" style={{ textDecoration: 'underline' }}>
                개인정보처리방침
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
