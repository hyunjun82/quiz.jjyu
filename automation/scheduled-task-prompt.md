# Cowork 예약 작업(스케줄 작업) 프롬프트 템플릿

아래 프롬프트를 Cowork 예약 작업으로 등록하면, 매 실행마다 새 세션이 열려
정답을 수집하고 GitHub에 커밋 → Cloudflare Pages가 자동 재배포합니다.

권장 스케줄: 매시간 1회 (07:00 ~ 23:00 KST)
- 퀴즈마다 공개 시각이 달라서(쏠퀴즈 오전, 오퀴즈 10시/14시, 토스 수시)
  하루 1회로는 부족하고, 매시간 돌면서 "변경이 있을 때만" 커밋하는 방식이 안전합니다.
- 변경이 없으면 커밋하지 않으므로 불필요한 재배포가 없습니다.

## 사전 준비 (1회)

1. GitHub에 quizday 저장소 생성, 이 프로젝트 푸시
2. Cloudflare Pages에서 저장소 연결 (빌드 명령: `npm run build`, 출력: `out`)
3. GitHub Personal Access Token (repo 권한, Fine-grained 권장) 발급
4. 예약 작업 프롬프트에 저장소 주소를 기재 (토큰은 프롬프트에 직접 넣지 말고
   저장소의 비공개 설정 파일 또는 Cowork 세션에서 안전한 방식으로 전달)

## 예약 작업 프롬프트 (복사해서 사용)

```
당신은 quiz.jjyu.co.kr 퀴즈 정답 사이트의 데이터 수집 봇입니다.

1. 오늘 날짜(KST)를 확인한다.
2. 아래 공개 소스에서 오늘자 앱테크 퀴즈 정답을 수집한다:
   - https://quizbells.com/ 의 각 퀴즈 페이지
   - https://luckyquiz3.blogspot.com/ 최신 글
   - (검색) "토스 행운퀴즈 오늘 정답", "오퀴즈 정답" 등으로 교차 검증
3. 수집 대상 퀴즈 slug: toss-lucky, cashwalk, shinhan-sol, kakaobank, ok-cashbag, kbpay
4. 두 소스 이상에서 일치하는 정답만 채택한다 (교차 검증 실패 시 제외).
5. git clone https://github.com/<계정>/quizday 후
   data/answers/YYYY-MM-DD.json 을 갱신한다.
   - 형식은 기존 파일과 동일 (question, answer, note, publishedAt)
   - question/answer는 사실 정보만 기록하고, 원문 사이트의 문장을 그대로
     복사하지 않는다 (정답 자체는 사실이므로 문제없으나 설명문 표절 금지).
6. 기존 파일과 비교해 변경이 있을 때만 커밋 & 푸시한다.
   커밋 메시지: "data: YYYY-MM-DD HH:mm 정답 업데이트 (N건)"
7. 변경 사항 요약을 보고한다.
```

## 등록 방법

Cowork 채팅에서 다음과 같이 요청:
"위 프롬프트로 매시간(오전 7시~오후 11시) 실행되는 예약 작업 만들어줘"

Claude가 create_trigger로 cron `0 7-23 * * *` (KST 기준) 예약 작업을 등록합니다.
