#!/usr/bin/env bash
# IndexNow 핑 — 오늘 자 정답 페이지 전부를 네이버·빙에 즉시 알린다.
#
# 왜 별도 스크립트인가 (2026-09-14):
#   indexnow.yml 은 data/answers 푸시 이벤트로 뜨는데, 9/14 00:01~08:09 Actions 수집 커밋 20건에
#   대해 한 번도 뜨지 않았다(실측: 그날 indexnow 실행 1회 = 사람이 PAT 로 민 커밋뿐).
#   GitHub 는 GITHUB_TOKEN 으로 민 푸시에서 다른 워크플로를 깨우지 않는다. 그래서 수집 job 이
#   푸시한 직후 스스로 핑을 보낸다. 트래픽의 86% 가 검색 유입이고 구글은 이 사이트를 색인하지
#   않으므로(GSC 색인 0) 네이버에 "새 페이지 있음"을 알리는 이 핑이 사실상 유일한 노출 경로다.
set -u
TODAY=$(TZ=Asia/Seoul date +%F)
URLS=$(TODAY=$TODAY node -e "
  const fs = require('fs');
  const q = require('./data/quizzes.json').quizzes;
  const today = process.env.TODAY;
  const urls = ['https://quiz.jjyu.co.kr/', 'https://quiz.jjyu.co.kr/today/'];
  let data = { answers: {} };
  try { data = JSON.parse(fs.readFileSync('./data/answers/' + today + '.json', 'utf8')); } catch {}
  for (const x of q) {
    urls.push('https://quiz.jjyu.co.kr/quiz/' + x.slug + '/');
    urls.push('https://quiz.jjyu.co.kr/quiz/' + x.slug + '/' + today + '/');
    const items = (data.answers || {})[x.slug] || [];
    items.forEach((_, i) => urls.push('https://quiz.jjyu.co.kr/quiz/' + x.slug + '/' + today + '/' + (i + 1) + '/'));
  }
  console.log(JSON.stringify(urls));
")
N=$(node -e 'console.log(JSON.parse(process.argv[1]).length)' "$URLS")
cat > /tmp/indexnow-payload.json <<JSON
{
  "host": "quiz.jjyu.co.kr",
  "key": "a602f498b33460cda8275cccdab72820",
  "keyLocation": "https://quiz.jjyu.co.kr/a602f498b33460cda8275cccdab72820.txt",
  "urlList": $URLS
}
JSON
CODE=$(curl -s -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  --retry 3 --retry-delay 5 --retry-all-errors \
  --connect-timeout 15 --max-time 60 \
  -d @/tmp/indexnow-payload.json -o /dev/null -w "%{http_code}") || CODE="000"
echo "[indexnow] ${N}개 URL 핑 → HTTP $CODE"

# 2026-10-05: 네이버에 직접도 보낸다.
#   10/3 부터 api.indexnow.org 로 보낸 핑은 계속 HTTP 200 인데도 네이버가 새 날짜 페이지를 가져가지 않았다
#   (site: 검색에 10/3·10/4·10/5 페이지 0개, 서치어드바이저 노출 10/2 약 21만 → 10/4 1.7만).
#   10/5 15:50 같은 URL 목록을 searchadvisor.naver.com/indexnow 로 직접 보내자 4분 만에 10/5 페이지가,
#   몇 분 뒤 10/3·10/4 페이지가 네이버 site: 검색에 나타났다. 공용 엔드포인트만 믿지 말고 네이버로도 보낸다.
NCODE=$(curl -s -X POST "https://searchadvisor.naver.com/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  --retry 3 --retry-delay 5 --retry-all-errors \
  --connect-timeout 15 --max-time 60 \
  -d @/tmp/indexnow-payload.json -o /dev/null -w "%{http_code}") || NCODE="000"
echo "[indexnow] 네이버 직접 ${N}개 URL 핑 → HTTP $NCODE"
exit 0
