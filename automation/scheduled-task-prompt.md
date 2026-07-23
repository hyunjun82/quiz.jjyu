# 정답 수집 자동화 — 현재 운영 방식 (2026-07-23 기준)

이 저장소의 정답 수집은 **Claude Code Remote 예약 작업(스케줄 트리거) 1개**로 운영됩니다.
과거에 있었던 GitHub Actions 기반 수집(`.github/workflows/collect.yml`, `scripts/collect.mjs`)은
실제 파싱 로직이 구현되지 않은 미완성 상태로 3일간 방치되어 있었고, 아무 데이터도 수집하지
못했음을 확인하여 삭제했습니다. (`icons.yml`, `indexnow.yml`은 수집과 무관한 별도 용도라 유지)

## 동작 원리

- 트리거 1개가 **매시간 정각 즈음** 실행됩니다.
- 실행마다 새 세션이 열려 `data/quizzes.json`의 30개 퀴즈 전체를 확인하고,
  현재 시각 기준 최근 공개된(releaseTimes) 퀴즈부터 우선 수집합니다.
- WebSearch/WebFetch로 언론 기사·정답 블로그를 교차 검증해 정답을 수집하고,
  `data/answers/{날짜}.json`에 변경이 있을 때만 커밋 → Cloudflare Pages 자동 재배포.
- 트리거 프롬프트 전문은 Claude Code Remote(`list_triggers`)에서 확인·수정 가능합니다.
  (트리거 이름: "퀴즈데이 정답 자동수집·발행 (전체 통합)")

## 알려진 제약

- 트리거 프롬프트에 GitHub PAT가 평문으로 들어있습니다 — Claude Code Remote 예약 작업 도구가
  프롬프트 외에 별도 시크릿 저장소를 제공하지 않아, 현재는 repo 권한만 있는 fine-grained
  토큰으로 리스크를 최소화한 상태입니다. 주기적 로테이션 권장.
- Claude Code Remote 예약 작업의 최소 주기는 1시간입니다(그보다 촘촘한 실시간 감지는
  플랫폼 제약상 불가능).
- quizbells.com은 갱신이 1~6일 지연되는 경우가 확인되어 보조 소스로만 사용합니다
  (페이지에 적힌 날짜가 오늘인지 반드시 확인 후 채택).
