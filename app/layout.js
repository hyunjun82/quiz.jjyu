import './globals.css';

const SITE_URL = 'https://quiz.jjyu.co.kr';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '오늘의 퀴즈 정답 실시간 — 토스행운퀴즈·돈버는퀴즈·쏠퀴즈·오퀴즈 | QUIZDAY',
    template: '%s | QUIZDAY',
  },
  description:
    '토스행운퀴즈 정답, 캐시워크 돈버는퀴즈 정답, 신한 쏠퀴즈 정답, 오퀴즈 정답 등 앱테크 퀴즈 정답을 공개 즉시 실시간으로 업데이트합니다.',
  openGraph: { type: 'website', locale: 'ko_KR', siteName: 'QUIZDAY' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
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
        {children}
        <footer className="site-footer">
          <div className="container">
            <p>
              QUIZDAY는 각 앱에서 진행되는 퀴즈 이벤트의 정답 정보를 정리해 제공하는 정보
              서비스이며, 각 이벤트 주최사와 무관합니다.
            </p>
            <p>정답은 이벤트 진행 중 변경될 수 있으니 앱 내 안내를 함께 확인해 주세요.</p>
            <p>© {new Date().getFullYear()} quiz.jjyu.co.kr</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
