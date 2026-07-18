export const metadata = {
  title: '개인정보처리방침',
  description: 'QUIZDAY(quiz.jjyu.co.kr)의 개인정보처리방침 및 쿠키 사용 안내입니다.',
  alternates: { canonical: '/privacy/' },
};

export default function PrivacyPage() {
  return (
    <main className="container detail">
      <div className="detail-grid">
        <div className="detail-main">
          <h1>개인정보처리방침</h1>
          <div className="howto" style={{ marginTop: 20 }}>
            시행일: 2026년 7월 18일 · 운영: QUIZDAY (quiz.jjyu.co.kr)
          </div>

          <section className="policy">
            <h2>1. 수집하는 정보</h2>
            <p>
              QUIZDAY는 회원가입 없이 이용하는 정보 서비스로, 이용자로부터 이름·연락처 등
              개인정보를 직접 수집하지 않습니다. 서비스 이용 과정에서 브라우저 종류, 접속
              기기, 방문 일시, 접속 로그 등 비식별 정보가 자동으로 생성·수집될 수 있습니다.
            </p>

            <h2>2. 쿠키 및 광고</h2>
            <p>
              본 사이트는 Google AdSense 광고를 게재합니다. Google을 포함한 제3자 광고
              사업자는 쿠키를 사용하여 이용자의 이전 방문 기록을 바탕으로 맞춤형 광고를
              제공할 수 있습니다. Google의 광고 쿠키 사용에 대한 자세한 내용과 맞춤 광고
              해제는{' '}
              <a
                href="https://policies.google.com/technologies/ads?hl=ko"
                rel="noopener noreferrer"
                target="_blank"
                style={{ textDecoration: 'underline' }}
              >
                Google 광고 정책
              </a>
              에서 확인할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수
              있습니다.
            </p>

            <h2>3. 통계 도구</h2>
            <p>
              서비스 개선을 위해 방문 통계 도구(예: Google Analytics, Cloudflare Analytics)를
              사용할 수 있으며, 이 과정에서 수집되는 정보는 개인을 식별할 수 없는 형태로
              처리됩니다.
            </p>

            <h2>4. 제공 정보의 성격</h2>
            <p>
              본 사이트가 제공하는 퀴즈 정답 정보는 각 앱 운영사가 공개한 이벤트 정보를
              정리한 것으로, 각 이벤트 주최사와 무관하며 정답은 이벤트 진행 중 변경될 수
              있습니다. 표기된 상표·로고는 각 소유자의 자산입니다.
            </p>

            <h2>5. 문의</h2>
            <p>
              개인정보 관련 문의는 이메일(33han58@gmail.com)로 연락해 주시기 바랍니다.
              본 방침은 관련 법령 또는 서비스 변경에 따라 개정될 수 있으며, 개정 시 본
              페이지에 게시합니다.
            </p>
          </section>
        </div>
        <aside className="rail" />
      </div>
    </main>
  );
}
