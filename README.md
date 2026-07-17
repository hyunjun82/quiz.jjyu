# 퀴즈데이 (quiz.jjyu.co.kr)

앱테크 퀴즈 정답 사이트 MVP. Next.js 정적 내보내기(`output: 'export'`) 기반으로
Cloudflare Pages에 배포합니다.

## 구조

```
data/quizzes.json          # 다루는 퀴즈 목록 (앱 추가는 여기만 수정)
data/answers/YYYY-MM-DD.json  # 날짜별 정답 데이터 (자동 수집 봇이 갱신)
app/page.js                # 홈 — 오늘의 퀴즈 카드 그리드
app/quiz/[slug]/page.js    # 퀴즈별 정답 페이지 (FAQPage JSON-LD 포함)
components/AnswerReveal.js # 정답 확인 버튼 (1클릭 공개, 정책 준수형)
automation/                # Cowork 예약 작업 프롬프트 템플릿
```

## 로컬 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # out/ 폴더에 정적 파일 생성
```

## Cloudflare Pages 배포

1. GitHub 저장소에 푸시
2. Cloudflare Pages → 저장소 연결
   - 빌드 명령: `npm run build`
   - 빌드 출력 디렉터리: `out`
3. Custom domain에 `quiz.jjyu.co.kr` 추가 (DNS CNAME 자동 설정)

## 데이터 업데이트 흐름

`data/answers/` 에 새 JSON을 커밋하면 Pages가 자동 재빌드합니다.
자동화는 `automation/scheduled-task-prompt.md` 참고.

## AdSense 적용 시 주의 (중요)

- `.ad-slot` 자리에 AdSense 코드를 넣되, **광고 시청/클릭을 조건으로 정답을
  잠그는 UX는 절대 금지** (인센티브 트래픽 → 계정 정지 사유)
- 정답 버튼과 광고를 겹치거나 붙여 배치하지 말 것 (실수 클릭 유도 금지)
- 승인 전 최소 2~4주간 콘텐츠 이력을 쌓고 개인정보처리방침 페이지 추가 권장
