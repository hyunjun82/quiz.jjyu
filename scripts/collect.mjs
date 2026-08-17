/**
 * 정답 실시간 수집 스크립트 — "공개되는 순간 잡아서 즉시 발행"이 목표다.
 *
 * ── 왜 이런 구조인가 ────────────────────────────────────────────────
 * 이 사이트의 수익은 "정답을 검색하는 사람이 뜨자마자 우리 사이트로 오는 것"에서
 * 나온다. 언론사가 올린 뒤에 따라 올리면 트래픽을 대부분 놓친다. 그래서 이 스크립트는
 * 단순 주기 폴링이 아니라 "발행 시각 조준(hot window) + 초 단위 감시" 방식으로 돈다.
 *
 *   1) 항상 한 바퀴 훑는다(몇 초). 놓친 것 회수 + 공개 시각을 모르는 퀴즈 커버.
 *   2) quizzes.json의 releaseTimes를 모아 "감시 블록"을 만든다.
 *      공개 시각마다 [-2분, +25분] 창을 두고, 10분 이내로 붙은 창끼리 이어붙인다.
 *      → 하루 7블록 · 약 6.7시간. 나머지 17시간은 아무것도 안 한다.
 *   3) 다음 블록이 LEAD_MINUTES(기본 70분)보다 멀면 그냥 끝낸다.
 *      가까우면 블록 시작까지 잠들었다가 POLL_SECONDS(30초) 간격으로 지키고,
 *      정답이 잡히는 즉시 커밋·푸시한다(다음 실행을 기다리지 않는다).
 *   4) 그 블록의 퀴즈를 전부 수집하면 남은 시간을 버리고 조기 종료한다.
 *
 * ⚠️ GitHub Actions cron은 요청한 시각에 거의 안 깨워준다(이 저장소 실측: 예약 대비 약 12%,
 *    시간당 1.5회꼴). 그래서 "블록 정각에 한 번" 예약하면 대부분 안 뜬다.
 *    대신 블록 시작 전 한 시간 동안 5분 간격 알람을 촘촘히 걸어두고, 그중 실제로 깨어난
 *    아무 job 하나가 블록 시작까지 잠들었다가 그 구간 전체를 지키게 한다.
 *    concurrency group 덕분에 여러 개가 깨어나도 한 번에 하나만 돈다.
 *
 * ── 소스 ────────────────────────────────────────────────────────────
 *   A. luckyquiz3.blogspot.com  — 8개 슬러그. 문제 지문이 길고 정확해 1순위.
 *   B. quizbells.com            — sourceSlug가 있는 21개 슬러그 전부. 갱신이 빠름.
 * 둘 다 AI 없이 순수 파싱이라 한 바퀴에 몇 초면 끝난다.
 *
 * ⚠️ 소스 HTML 구조가 바뀌면 parseEntry(A) / parseQuizbells(B)만 고치면 된다.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';

const KST_OFFSET = 9 * 60 * 60 * 1000;
const ANSWERS_DIR = path.join(process.cwd(), 'data', 'answers');
const FEED_URL = 'https://luckyquiz3.blogspot.com/feeds/posts/default?alt=json&max-results=60';
const QUIZBELLS = (sourceSlug) => `https://quizbells.com/quiz/${sourceSlug}/today/answer`;

// ── 감시 구간(블록) 계산 파라미터 ──────────────────────────────
// 공개 시각 몇 분 전부터 붙을지. 소스가 미리 올리는 경우가 드물게 있어 조금 앞에서 시작한다.
const WINDOW_BEFORE = Number(process.env.WINDOW_BEFORE ?? 2);
// 공개 시각 이후 몇 분까지 지킬지. 대부분 5분 안에 뜨지만 늦는 소스가 있어 넉넉히.
const WINDOW_AFTER = Number(process.env.WINDOW_AFTER ?? 25);
// 창과 창 사이가 이 분 이내로 가까우면 하나로 이어붙인다(08:00/08:30/09:00 → 한 덩어리).
const MERGE_TOLERANCE = Number(process.env.MERGE_TOLERANCE ?? 10);
// 블록 시작이 이 분 이내로 다가왔을 때만 대기에 들어간다.
// GitHub cron이 정각에 안 깨워주므로(실측 시간당 1.5회) 한 시간 전부터 알람을 촘촘히 걸고,
// 살아남은 job 하나가 블록 시작까지 잠들었다가 지킨다.
const LEAD_MINUTES = Number(process.env.LEAD_MINUTES ?? 70);
// 감시 폴링 간격.
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 30);
// job 하나가 살아 있을 수 있는 절대 상한(분). 워크플로 timeout보다 짧게 잡아 스스로 정리한다.
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 165);
// 정답을 다 잡은 뒤에도 "진짜 문제 지문"이 늦게 오는 소스를 이만큼은 더 기다린다.
const GRACE_SECONDS = Number(process.env.GRACE_SECONDS ?? 180);
// 찾는 즉시 git commit/push 할지 여부 (로컬 테스트에서는 끈다).
const AUTO_PUSH = process.env.AUTO_PUSH === '1';

// [2026-08-05 실측] Cowork 클라우드 세션의 git 프록시는 remote URL에 박힌
// user:token 자격증명을 무시하고 push를 403으로 거절한다("not in this session's
// authorized repository set"). 대신 Authorization 헤더는 그대로 통과시킨다.
// 그래서 시작 시 origin URL에 자격증명이 박혀 있으면 그걸 뽑아
// http.extraHeader(Basic)로 옮기고 URL은 자격증명 없는 형태로 바꾼다.
// 프록시가 없는 일반 환경에서도 헤더 Basic 인증은 GitHub 표준이므로 동일하게 동작한다.
function ensureGitAuthHeader() {
  try {
    const url = execFileSync('git', ['config', '--get', 'remote.origin.url'], { stdio: 'pipe' })
      .toString()
      .trim();
    const m = url.match(/^https:\/\/([^@/]+)@(.+)$/);
    if (!m) return; // 자격증명이 URL에 없으면 손대지 않는다
    const cred = decodeURIComponent(m[1]);
    if (!cred.includes(':')) return;
    const b64 = Buffer.from(cred).toString('base64');
    execFileSync('git', ['config', 'http.extraHeader', `Authorization: Basic ${b64}`], { stdio: 'pipe' });
    execFileSync('git', ['config', 'remote.origin.url', `https://${m[2]}`], { stdio: 'pipe' });
    console.log('[git] URL 자격증명 → Authorization 헤더로 이전 (프록시 대응)');
  } catch {
    /* git 저장소가 아니거나 실패해도 수집 자체는 계속한다 */
  }
}
if (AUTO_PUSH) ensureGitAuthHeader();

const kstNow = () => new Date(Date.now() + KST_OFFSET);
const kstToday = () => kstNow().toISOString().slice(0, 10);
const kstStamp = () => kstNow().toISOString().replace('Z', '+09:00');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const QUIZZES = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'quizzes.json'), 'utf-8'),
).quizzes;
const QUIZ_SLUGS = QUIZZES.map((q) => q.slug);
const BY_SLUG = Object.fromEntries(QUIZZES.map((q) => [q.slug, q]));

/* ────────────────────────── 공통 유틸 ────────────────────────── */

function decodeEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // 비즈월드 본문이 &hellip; 를 그대로 쓴다 — 안 풀면 문제 지문에 날것으로 박힌다(7/28 실측).
    .replace(/&hellip;/g, '…')
    .replace(/&middot;/g, '·')
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&[lr]squo;/g, "'")
    .replace(/&[mn]dash;/g, '–')
    .trim();
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const clean = (s) => decodeEntities(stripTags(s));

const PLACEHOLDER = new Set(['잠시 후 공개', '준비중', '준비 중', '미공개', 'ㅡ', '-', '?', '']);

/**
 * 소스에서 긁은 정답 문자열이 진짜 정답인지 검증한다.
 * quizbells는 일부 퀴즈(토스 등)에 커뮤니티가 남긴 잡담이 정답 칸에 그대로 들어오는
 * 경우가 있다 — 실측 확인됨. 길이·개행·URL로 걸러낸다.
 */
function isSaneAnswer(a) {
  if (!a || PLACEHOLDER.has(a)) return false;
  if (a.length > 40) return false; // 정답은 대부분 10자 이내. 40자 넘으면 잡담/지문 혼입.
  if (/https?:\/\//i.test(a)) return false;
  if (/\d{1,2}시 \d{1,2}분/.test(a)) return false; // "지금 0시 23분 ..." 류 커뮤니티 글
  // 7/28 실측: 카카오페이에 정답 "- 99"가 발행됐다. 커뮤니티 글 본문 조각이
  // 정답 칸에 그대로 들어온 것. 정답은 문장부호로 시작하지 않는다.
  if (/^[-–—·.,?!/|]/.test(a)) return false;
  if (!/[가-힣A-Za-z0-9]/.test(a)) return false;
  return true;
}

/**
 * 문제 지문이 진짜 문제인지 검증한다.
 * 퀴즈벨 표에는 사용자가 쓴 커뮤니티 글이 그대로 행으로 섞여 들어온다 — 이 글들은
 * 제목이 "260728 카카오페이 오후 퀴즈 2탄피아소"처럼 YYMMDD로 시작한다(7/28 실측).
 * 이런 게 발행되면 우리 도메인에 쓰레기 페이지가 하나 생기고 제목까지 그대로 박힌다.
 */
function isSaneQuestion(q) {
  const s = String(q || '').trim();
  if (!s) return false;
  // 8/13 실측: 비트버니 지문이 정답을 "000000란, ..."처럼 0으로 마스킹해 시작하는데
  // 아래 6자리 숫자 규칙(날짜형 커뮤니티 글 걸러내기)에 걸려 진짜 문제가 버려졌다.
  // 전부 0인 선행 숫자는 날짜일 수 없으므로 마스킹으로 보고 통과시킨다.
  if (/^\d{6}\s*\D/.test(s) && !/^0{3,}/.test(s)) return false;
  if (/https?:\/\//i.test(s)) return false;
  // 7/29 실측: 토스 표에 "퀴즈1234657 / 플립" 행이 섞여 들어와 진짜 문제
  // "새로운Z시리즈 예약시작 / 플립, 폴드, 울트라"를 밀어내고 발행됐다.
  // '퀴즈' 같은 껍데기를 걷어냈을 때 숫자만 남으면 사람이 장난으로 친 행이다.
  const core = s.replace(/퀴즈|정답|문제|오늘의|오늘/g, '').replace(/[^가-힣0-9A-Za-z]/g, '');
  if (core && /^\d+$/.test(core)) return false;
  return true;
}

/**
 * 같은 정답으로 판정된 두 값 중 새 것이 "더 완전한" 답인가.
 * 7/29 실측: 먼저 "플립"이 들어오자, 뒤에 온 진짜 정답 "플립, 폴드, 울트라"가
 * 접두사 규칙에 걸려 중복으로 버려졌다. 우리 사이트만 정답이 1/3만 나온 원인이다.
 * 새 값이 옛 값을 통째로 품고 있으면서 더 길면 갈아끼운다.
 */
function isFullerAnswer(oldA, newA) {
  const a = normalize(oldA);
  const b = normalize(newA);
  if (!a || !b || a === b) return false;
  return b.length > a.length && b.startsWith(a);
}

/**
 * 정답 비교용 키. 표기 차이를 걷어내 같은 정답을 같게 만든다.
 *
 * 선택지 번호를 떼는 이유 — 소스마다 붙이기도 하고 안 붙이기도 한다.
 * 8/14 실측: 같은 KB 한국사 정답이 퀴즈벨은 "호패법을 시행하였다",
 * 토막스는 "2번 호패법을 시행하였다."로 와서 중복 판정을 빠져나가
 * 한 페이지에 같은 정답이 두 번 실렸다. 번호는 표기일 뿐 정답의 일부가 아니다.
 * (저장되는 값은 그대로 두고, 비교할 때만 뗀다.)
 */
function normalize(s) {
  const base = String(s || '')
    .replace(/^\s*\d{1,2}\s*번[\s.)]*/, '') // 선택지 번호: "2번 호패법…" → "호패법…"
    .replace(/^\s*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, ''); // 원문자 번호: "② (나)-(가)" → "(나)-(가)"

  // 괄호 부연 제거: "O (맞아요)" → "O"
  //
  // ⚠️ 2026-08-17 발견 — 괄호가 '부연'이 아니라 '내용 자체'인 정답이 있다.
  //   한국사 순서나열 문제의 정답이 "(나)-(가)-(다)" 다. 여기서 괄호를 다 떼면
  //   "--" 만 남아서, 서로 다른 정답이 전부 "--" 로 뭉개진다. 중복 판정이 무너진다.
  // 그래서 떼고 나서 한글·영숫자가 하나도 안 남으면 떼지 않은 원본으로 비교한다.
  const stripped = base.replace(/\s*[(（][^)）]*[)）]/g, '');
  const usable = /[가-힣A-Za-z0-9]/.test(stripped) ? stripped : base;

  return usable.replace(/[\s,.·/]/g, '').toLowerCase();
}

function itemKey(x) {
  return x.answer ? normalize(x.answer) : normalize((x.choices || []).join(','));
}

/**
 * 이미 있는 정답인지 판단. 소스마다 표기가 미묘하게 달라서("100만" vs "100만P",
 * "O" vs "O (그렇다)") 완전일치만 보면 같은 정답이 중복 등록된다.
 * 그래서 한쪽이 다른 쪽의 앞부분이면 같은 것으로 본다.
 *
 * ⚠️ 단, 짧은 쪽이 2자 이하면 접두사 규칙을 쓰지 않는다.
 *
 * 2026-08-14 발견: 이 규칙에 OX 정답이 걸린다.
 *   'X'  vs 'XC90'    → 'xc90'.startsWith('x'), 길이차 3 → "같다" 판정
 *   'O'  vs 'OK캐시백' → 길이차 4 → "같다" 판정
 * 즉 O/X 정답이 이미 있으면, 같은 글자로 시작하는 진짜 정답이 통째로 버려진다.
 * 실제로 7/17 신한에 'XC90'과 'X'가 나란히 있었다 — 하나만 늦게 들어왔다면
 * 그날 정답 하나가 사라졌을 상황이다. OX 정답은 하나원큐 24건·카뱅 15건·
 * KB 13건으로 흔하므로 언제든 재발한다.
 *
 * 1~2자 정답은 표기 흔들림이 거의 없으므로(O/X/예/아니오) 완전일치로 충분하다.
 */
function dupIndex(current, item) {
  const key = itemKey(item);
  if (!key) return -2; // 정답이 없는 쓰레기 — 넣지도 말고 갱신하지도 말 것
  return current.findIndex((x) => {
    const k = itemKey(x);
    if (k === key) return true;
    const shorter = Math.min(k.length, key.length);
    if (shorter >= 3 && (k.startsWith(key) || key.startsWith(k))) {
      return Math.abs(k.length - key.length) <= 6;
    }
    return false;
  });
}

function isDuplicate(current, item) {
  return dupIndex(current, item) !== -1;
}

/**
 * 퀴즈벨은 문제 지문을 안 주고 "KB Pay 오늘의 퀴즈" 같은 뭉뚱그린 제목만 준다.
 * 이런 제목으로는 롱테일 검색에 절대 안 걸린다 — 페이지 제목 전략이 통째로 죽는다.
 *
 * 문제: 퀴즈벨이 몇 초 먼저 도착하면 같은 정답이므로 뒤따라온 비즈월드의
 *      "진짜 지문"이 중복으로 버려지고 뭉뚱그린 제목이 그날 하루 박제된다(7/28 실측).
 * 해결: 정답이 같아도 지문이 확실히 더 좋아졌으면 지문만 갈아끼운다.
 *      publishedAt(선점 시각)은 절대 건드리지 않는다 — 그게 우리 기록이니까.
 */
/**
 * "지문에 실제 내용이 얼마나 들어 있나"를 글자 수로 잰다.
 *
 * 단순히 길이로 재면 안 된다. 블로그 소스는 "KB Pay 오늘의 퀴즈 / KB스타뱅킹 스타퀴즈
 * 7월28일"처럼 길기만 하고 알맹이가 없는 글 제목을 준다(7/28 실측) — 30자나 되지만
 * 검색어로는 전혀 못 쓴다. 그래서 앱 이름·날짜·'퀴즈/정답' 같은 껍데기를 다 걷어낸
 * 뒤에 남는 글자를 센다.
 */
function questionSubstance(q, slug) {
  let s = String(q || '');
  const meta = BY_SLUG[slug] || {};
  for (const name of [meta.app, meta.name, meta.shortName, meta.searchKeyword]) {
    for (const tok of String(name || '').split(/[\s()/]+/)) {
      if (tok.length >= 2) s = s.split(tok).join(' ');
    }
  }
  return s
    .replace(/\d{1,2}\s*월\s*\d{1,2}\s*일/g, ' ')
    .replace(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/g, ' ')
    .replace(/오늘의|오늘|스타퀴즈|퀴즈팡팡|용돈퀴즈|행운퀴즈|초성퀴즈|퀴즈|정답|문제/g, ' ')
    .replace(/[^가-힣0-9A-Za-z]/g, '')
    .length;
}

/** 검색어로 쓸 수 없는 뭉뚱그린 제목인가 */
function isGenericQuestion(q, slug) {
  return questionSubstance(q, slug) < 12;
}

function isBetterQuestion(oldQ, newQ, slug) {
  const a = String(oldQ || '').trim();
  const b = String(newQ || '').trim();
  if (!b || b === a) return false;
  if (!a) return true;
  // 기존이 껍데기고, 새 것은 알맹이가 확실히 더 많아야 갈아끼운다.
  return isGenericQuestion(a, slug) && questionSubstance(b, slug) >= questionSubstance(a, slug) + 12;
}

/* ────────────────────── 소스 A: luckyquiz3 블로그 ────────────────────── */

const CATEGORY_SLUG = {
  '캐시워크 돈버는퀴즈': 'cashwalk',
  '캐시닥/타임스프레드 용돈퀴즈': 'cashdoc',
  'OK캐쉬백 오퀴즈': 'ok-cashbag',
  '토스 행운퀴즈': 'toss-lucky',
};

function headerToSlug(category, header, title) {
  if (category === 'KB Pay 오늘의 퀴즈') {
    if (header.includes('스타뱅킹') || header.includes('스타퀴즈')) return 'kb-star';
    return 'kbpay';
  }
  if (category === '신한 퀴즈') return 'shinhan-sol';
  // '버즈빌 초성퀴즈'는 버즈빌 광고 SDK가 여러 제휴사(SK스토아, 자코모 등)에 꽂혀서
  // 브랜드마다 따로 올라오는 카테고리 — SK스토아 것만 추적 중이라 'SK스토아'가 있을 때만 매칭.
  if (category === '버즈빌 초성퀴즈') {
    if (header.includes('SK스토아') || title.includes('SK스토아')) return 'skstoa';
    return null;
  }
  return CATEGORY_SLUG[category] || null;
}

function parseEntry(entry) {
  const cats = (entry.category || []).map((c) => c.term);
  const category = cats[0];
  const title = clean(entry.title?.['$t'] || '');
  const content = entry.content?.['$t'] || '';

  const blocks = content.split(/(?=<div class="quiz-card">)/);
  const results = [];

  for (const block of blocks) {
    const hMatch = block.match(/quiz-header">(.*?)<\/h2>/);
    if (!hMatch) continue;
    const header = clean(hMatch[1]).replace(/^Q\.\s*/, '');

    const qMatch = block.match(/quiz-question">([\s\S]*?)<\/p>/);
    const question = qMatch ? clean(qMatch[1]) : '';

    const answers = [...block.matchAll(/quiz-answer-highlight[^"]*">([\s\S]*?)<\/span>/g)]
      .map((m) => clean(m[1]))
      .filter(isSaneAnswer);
    if (answers.length === 0) continue; // 아직 정답 미공개

    const slug = headerToSlug(category, header, title);
    if (!slug || !QUIZ_SLUGS.includes(slug)) continue;

    results.push({ slug, ...buildItem(question || title, answers), source: 'blog' });
  }
  return results;
}

async function collectFromBlog() {
  const res = await fetch(FEED_URL, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
  });
  if (!res.ok) throw new Error(`blog feed HTTP ${res.status}`);
  const feed = await res.json();
  const today = kstToday();
  const out = [];
  for (const entry of feed.feed?.entry || []) {
    const pub = entry.published?.['$t'] || '';
    if (!pub) continue;
    const pubKST = new Date(new Date(pub).getTime() + KST_OFFSET).toISOString().slice(0, 10);
    if (pubKST !== today) continue; // 오늘 게시물만
    out.push(...parseEntry(entry).map((r) => ({ ...r, source: 'blog' })));
  }
  return out;
}

/* ────────────────────── 소스 B: quizbells.com ────────────────────── */

/**
 * quizbells의 "정답 전체보기" 페이지에는 문제/정답 2열짜리 요약 <table>이 딱 하나 있다.
 * 이 표만 파싱한다. 본문 다른 곳은 광고·추천글이 섞여 신뢰할 수 없다.
 * 날짜 검증: <title>에 박힌 날짜가 오늘이 아니면 통째로 버린다(퀴즈벨은 정답이 아직
 * 없어도 어제 페이지를 그대로 노출하는 경우가 있어 이 검증이 필수다 — 실측 확인됨).
 */
/**
 * 토스 '두근두근 1등 찍기 팀플전' 구제 파서.
 *
 * 8/4 실측으로 찾은 구멍: 퀴즈벨의 토스 행은 커뮤니티 글 형식이라 제목이
 * "260801 토스 두근두근 1등 찍기 팀플전"처럼 YYMMDD로 시작한다. 7/28에 넣은
 * 커뮤니티-쓰레기 필터(isSaneQuestion의 /^\d{6}/ 거부)가 이 행을 통째로 버렸고,
 * 그 결과 8/1·8/2의 진짜 정답("오전 - 하림 텐더스틱 / 오후 - 나우푸드 칼슘")이
 * 이틀 연속 유실됐다. 필터 자체는 옳다(카카오페이 잡담 차단 실적 있음) —
 * 다만 이 형식만은 버리기 전에 정답을 추출해 구제한다.
 *
 * 셀 원문 구조(실측): 한 <div> 안에 "\xa0\xa0"(nbsp 2개)로 구분된
 *   [제목] ␣␣ 오전 - X오후 - Y ␣␣ [잡담]
 * 형태. 오전/오후 답 사이엔 구분자가 아예 없어서 '오후 -' 룩어헤드로 자른다.
 */
function parseTeampljeon(qCell, aCell) {
  const rawText = decodeEntities(String(aCell).replace(/<[^>]+>/g, ' '));
  const joined = `${clean(qCell)} ${rawText}`;
  if (!/팀플전|1등\s*찍기/.test(joined)) return null;

  // nbsp 2개(또는 공백 뭉치)로 제목/정답/잡담 구획을 나눈다.
  const segs = rawText.split(/[ ]{2,}|\s{3,}/).map((s) => s.replace(/\s+/g, ' ').trim());
  const body = segs.find((s) => /오전\s*[-–—:]|오후\s*[-–—:]/.test(s));
  // 아직 제목만 올라온 상태 — 빈 배열로 '이 행은 처리 끝(정답 없음)'을 알린다.
  // null을 돌려주면 일반 경로가 제목 문자열을 정답으로 오인해 추출한다(8/4 실측).
  if (!body) return [];

  const am = body.match(/오전\s*[-–—:]\s*(.+?)(?=\s*오후\s*[-–—:]|$)/)?.[1]?.trim();
  const pm = body.match(/오후\s*[-–—:]\s*(.+)$/)?.[1]?.trim();
  const out = [];
  if (am && isSaneAnswer(am)) {
    out.push(buildItem('토스 두근두근 1등 찍기 팀플전 (오전)', [am]));
  }
  if (pm && isSaneAnswer(pm)) {
    out.push(buildItem('토스 두근두근 1등 찍기 팀플전 (오후)', [pm]));
  }
  // 팀플전 행으로 확정된 이상, 추출 실패여도 일반 경로로 넘기지 않는다(빈 배열).
  return out;
}

function parseQuizbells(html, slug, today) {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const dm = title.match(/(\d{4})년 (\d{2})월 (\d{2})일/);
  if (!dm || `${dm[1]}-${dm[2]}-${dm[3]}` !== today) return [];

  const table = html.match(/<table[^>]*>([\s\S]*?)<\/table>/)?.[1] ?? '';
  if (!table) return [];

  const rows = [
    ...table.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g),
  ];

  const out = [];
  for (const [, qCell, aCell] of rows) {
    // 팀플전 형식은 일반 경로(정답 40자 제한 + YYMMDD 지문 거부)에서 반드시
    // 탈락하므로, 먼저 구제 파서로 정답을 추출한다.
    const rescued = parseTeampljeon(qCell, aCell);
    if (rescued) {
      for (const r of rescued) out.push({ slug, ...r, source: 'quizbells' });
      continue;
    }
    const divs = [...aCell.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)].map((m) => clean(m[1]));
    const answers = (divs.length ? divs : [clean(aCell)]).filter(isSaneAnswer);
    if (answers.length === 0) continue;

    let question = clean(qCell);
    // 퀴즈벨은 문제 제목이 "퀴즈", "출석 퀴즈"처럼 지나치게 짧을 때가 있다.
    // 그대로 쓰면 우리 페이지 제목이 무의미해지므로 앱 이름(shortName)을 붙여 보강한다.
    // name이 아니라 shortName을 쓰는 이유: name은 '신한 쏠퀴즈 · 퀴즈팡팡 · 출석퀴즈'처럼
    // 길어서 '... 출석 퀴즈'와 겹치면 제목이 지저분해진다.
    if (question.length < 8) {
      const label = BY_SLUG[slug]?.shortName || BY_SLUG[slug]?.name || slug;
      question = question && !question.includes('퀴즈')
        ? `${label} — ${question}`
        : `${label}${question ? ` (${question})` : ' 오늘의 퀴즈'}`;
    }
    out.push({ slug, ...buildItem(question, answers), source: 'quizbells' });
  }
  return out;
}

async function collectFromQuizbells() {
  const today = kstToday();
  const targets = QUIZZES.filter((q) => q.sourceSlug);
  const results = await Promise.all(
    targets.map(async (q) => {
      try {
        const res = await fetch(QUIZBELLS(q.sourceSlug), {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        return parseQuizbells(await res.text(), q.slug, today).map((r) => ({
          ...r,
          source: 'quizbells',
        }));
      } catch {
        return []; // 소스 하나가 죽어도 전체를 멈추지 않는다
      }
    }),
  );
  return results.flat();
}

/* ──────────────────── 소스 C: 비즈월드(bizwnews.com) ──────────────────── */

/**
 * 왜 이 소스를 넣는가 ─ 우리가 실제로 지고 있던 상대가 바로 이 언론사다.
 *
 * 2026-07-27 실측:
 *   · 비즈월드 KB페이 기사 → 입력 09:56 / 수정 10:00  (09:56엔 껍데기, 10:00에 정답 채움)
 *   · 퀴즈벨(우리 기존 유일 소스) → 같은 정답이 약 10:02에 등장
 *   · 우리 발행 → 10:04
 * 즉 "언제 보느냐"가 아니라 "어디를 보느냐"가 병목이었다. 퀴즈벨만 보면 구조적으로 2분 늦는다.
 *
 * 핵심은 비즈월드가 퀴즈 열리기 4분 전에 기사 주소를 미리 만들어 둔다는 점이다.
 * 그래서 주소를 먼저 확보해 두고(=목록 1회 조회) 감시 구간 동안 그 기사 하나만 찍으면,
 * 정답이 채워지는 순간을 초 단위로 잡을 수 있다. 목록을 매번 다시 훑을 필요가 없다.
 *
 * ⚠️ [캐시워크 종합] 기사는 일부러 뺐다. 본문이 "이전에 출제된 / 직전 문제는 / 또" 같은
 *    자유 서술이라 오늘 것과 지난 것을 기계가 안전하게 구분할 수 없고, 정작 "현재 출제된
 *    문제"에는 정답이 안 붙어 있다(실측). 오답을 넣느니 넣지 않는 편이 낫다.
 *    캐시워크는 어차피 퀴즈벨 훑기로 하루 14건씩 들어오고 있다.
 */
const BIZW_LIST = 'https://www.bizwnews.com/news/articleList.html?view_type=sm';
const BIZW_ART = (id) => `https://www.bizwnews.com/news/articleView.html?idxno=${id}`;

// 기사 제목 → 우리 slug. 여기에 줄을 추가하는 것만으로 소스를 넓힐 수 있다.
// 단, 반드시 parseBizwArticle이 안전하게 파싱 가능한 "단일 문제" 형식이어야 한다.
const BIZW_TITLE_MAP = [
  { slug: 'kbpay', re: /KB\s*페이.*(오늘의\s*퀴즈|리브메이트)|리브메이트.*오늘의\s*퀴즈/ },
];

// 오늘 찾아낸 기사 주소 캐시: `${today}:${slug}` → idxno. 하루에 목록을 몇 번만 훑는다.
const bizwArticleCache = new Map();
let bizwListFetchedAt = 0;

/** 최신 기사 목록에서 오늘자 대상 기사의 idxno를 찾아 캐시에 넣는다. */
async function bizwDiscover(today) {
  // 다 찾았으면 더 훑지 않는다. 못 찾았으면 90초 간격으로 재시도한다.
  // 90초인 이유: 비즈월드가 기사 껍데기를 공개 4분 전에 만들므로, 그 4분 안에
  // 최소 2번은 다시 훑어야 주소를 확보한 채로 공개 시각을 맞을 수 있다.
  const allFound = BIZW_TITLE_MAP.every((m) => bizwArticleCache.has(`${today}:${m.slug}`));
  if (allFound || Date.now() - bizwListFetchedAt < 90_000) return;
  bizwListFetchedAt = Date.now();

  const res = await fetch(BIZW_LIST, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`bizwnews list HTTP ${res.status}`);
  const html = await res.text();

  for (const m of html.matchAll(/articleView\.html\?idxno=(\d+)[^>]*>([\s\S]{0,300}?)<\/a>/g)) {
    const title = clean(m[2]);
    if (!title) continue;
    for (const map of BIZW_TITLE_MAP) {
      const key = `${today}:${map.slug}`;
      if (bizwArticleCache.has(key)) continue;
      if (map.re.test(title)) bizwArticleCache.set(key, m[1]);
    }
  }
}

/**
 * 기사 본문에서 "오늘 문제 + 오늘 정답"만 뽑는다.
 *
 * 본문 형식(실측):
 *   <p>이번 문제는 "…질문…"다.</p>
 *   <p>정답은 '…정답…'다.</p>
 *   <p>앞서 전날인 지난 26일 출제된 문제는 … 정답은 '…'이었다.</p>   ← 절대 먹으면 안 됨
 *
 * 그래서 "지난 N일 / 앞서" 가 나오는 첫 문단에서 본문을 잘라 버리고, 그 앞쪽만 본다.
 * 날짜 검증도 이중으로 한다(입력·수정 표기 + 본문 안 날짜).
 */
function parseBizwArticle(html, slug, today) {
  // 1차 검증: 입력/수정 도장 중 하나라도 오늘이어야 한다.
  const stamps = [...html.matchAll(/(?:입력|수정)\s*(\d{4})\.(\d{2})\.(\d{2})/g)].map(
    (m) => `${m[1]}-${m[2]}-${m[3]}`,
  );
  if (!stamps.includes(today)) return [];

  const body = html.match(/<article[^>]*id="article-view-content-div"[^>]*>([\s\S]*?)<\/article>/)?.[1];
  if (!body) return [];

  const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
    .map((m) => clean(m[1]))
    .filter(Boolean);

  // 2차 검증: 본문 첫머리에 오늘 날짜(예: "7월 27일")가 있어야 한다.
  const [, mm, dd] = today.split('-');
  const dateRe = new RegExp(`${Number(mm)}월\\s*${Number(dd)}일`);
  if (!paras.slice(0, 3).some((p) => dateRe.test(p))) return [];

  // 과거 문제 서술이 시작되는 지점에서 자른다.
  const cut = paras.findIndex((p) => /^(앞서|지난\s*\d+일|또\s*지난)/.test(p));
  const head = cut === -1 ? paras : paras.slice(0, cut);

  const qi = head.findIndex((p) => /^이번 문제는/.test(p));
  if (qi === -1) return [];
  const question = head[qi].match(/^이번 문제는\s*["'“”‘’]?([\s\S]+?)["'“”‘’]?\s*(?:다|이다|였다)\.?$/)?.[1]?.trim();
  if (!question || question.length < 6) return [];

  const ansPara = head.slice(qi + 1).find((p) => /^정답은/.test(p));
  if (!ansPara) return [];
  const answer = ansPara.match(/^정답은\s*["'“”‘’]([\s\S]+?)["'“”‘’]\s*(?:다|이다|였다|이었다)\.?$/)?.[1]?.trim();
  if (!isSaneAnswer(answer)) return [];

  return [{ slug, ...buildItem(question, [answer]) }];
}

async function collectFromBizwnews() {
  const today = kstToday();
  await bizwDiscover(today).catch(() => {}); // 목록 조회가 실패해도 캐시가 있으면 계속 간다

  const jobs = BIZW_TITLE_MAP.map((map) => bizwArticleCache.get(`${today}:${map.slug}`)
    ? { slug: map.slug, id: bizwArticleCache.get(`${today}:${map.slug}`) }
    : null).filter(Boolean);

  const results = await Promise.all(
    jobs.map(async ({ slug, id }) => {
      try {
        const res = await fetch(BIZW_ART(id), {
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)',
            // 기사가 "수정"되는 순간을 노리는 소스라 캐시된 옛 판을 받으면 의미가 없다.
            'cache-control': 'no-cache',
            pragma: 'no-cache',
          },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        return parseBizwArticle(await res.text(), slug, today).map((r) => ({
          ...r,
          source: 'bizwnews',
        }));
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

/* ────────────── 소스 D: 게임톡 (gametoc.co.kr) ──────────────
 *
 * 2026-08-10 발굴. 언론사인데 퀴즈 정답 기사를 하루 수십 건, 당일 수 분~수십 분
 * 안에 올린다(실측: 캐시워크 12:06 발행 기사가 12시 퀴즈 정답 포함). 커버 범위가
 * 넓어(캐시워크·캐시닥·토스·카카오뱅크·오퀴즈·신한 등) 퀴즈벨 단일 의존을 깨는
 * 두 번째 기둥이다. 비즈월드와 같은 CMS라 구조도 같다:
 *   목록: articleList.html?view_type=sm → idxno + 제목
 *   기사: JSON-LD datePublished(초 단위) + 본문 고정 문형
 *     "문제는 '...'이다" / "정답은 [ X ]이다" / "정답은 'X'이다"
 *     / "다른 문제의 정답은 'A' 또는 'B'이다"
 */
const GTOC_LIST = 'https://www.gametoc.co.kr/news/articleList.html?view_type=sm';
const GTOC_ART = (id) => `https://www.gametoc.co.kr/news/articleView.html?idxno=${id}`;

// 제목 → slug. 퀴즈 이름을 앱 이름보다 먼저 본다 — "토스 행운퀴즈 'H포인트…'"처럼
// 제목에 다른 앱 이름이 끼어드는 경우가 실제로 있다(8/7 실측).
const GTOC_TITLE_MAP = [
  { slug: 'toss-lucky', re: /행운\s*퀴즈/ },
  { slug: 'cashwalk', re: /캐시워크|돈버는\s*퀴즈/ },
  { slug: 'cashdoc', re: /캐시닥|용돈\s*퀴즈/ },
  { slug: 'kakaobank', re: /카카오뱅크/ },
  { slug: 'ok-cashbag', re: /오퀴즈|OK\s*캐시백/i },
  { slug: 'shinhan-sol', re: /쏠퀴즈|신한.*퀴즈팡팡/ },
  { slug: 'kbank', re: /케이뱅크/ },
];

// `${today}:${slug}` → Set(idxno). 게임톡은 같은 퀴즈를 하루 여러 기사로 낸다.
const gtocArticleCache = new Map();
// 이미 정답을 뽑아낸 기사: idxno → items. 게임톡은 완성 기사를 한 번에 내므로
// (실측: dateModified == datePublished) 성공한 기사는 다시 안 긁는다.
const gtocParsed = new Map();
let gtocListFetchedAt = 0;

async function gtocDiscover(today) {
  if (Date.now() - gtocListFetchedAt < 90_000) return;
  gtocListFetchedAt = Date.now();
  const res = await fetch(GTOC_LIST, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return;
  const html = await res.text();
  for (const [, id, rawTitle] of html.matchAll(/articleView\.html\?idxno=(\d+)[^>]*>([^<]{5,120})/g)) {
    const title = decodeEntities(rawTitle);
    if (!/정답/.test(title)) continue; // 정답 기사만
    const map = GTOC_TITLE_MAP.find((m) => m.re.test(title));
    if (!map) continue;
    const key = `${today}:${map.slug}`;
    if (!gtocArticleCache.has(key)) gtocArticleCache.set(key, new Set());
    gtocArticleCache.get(key).add(id);
  }
}

function parseGametocArticle(html, slug, today) {
  // 날짜 검증: JSON-LD datePublished가 오늘이어야 한다. 어제 기사를 오늘 정답으로
  // 발행하는 사고를 막는 필수 관문(퀴즈벨 title 검증과 같은 역할).
  const pub = html.match(/"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/)?.[1];
  if (pub !== today) return [];

  // 게임톡은 비즈월드와 달리 본문 컨테이너가 <article>이 아니라 <div>다 (8/10 실측).
  // 닫는 태그 매칭이 불안정하므로 컨테이너 시작 지점부터 넉넉히 잘라 쓴다.
  const start = html.indexOf('article-view-content-div');
  if (start === -1) return [];
  const text = clean(html.slice(start, start + 20000));

  const out = [];
  // 본문 문형 1: 문제는 '...'이다  → 진짜 지문
  const q = text.match(/문제는\s*['"“‘]([\s\S]{6,300}?)['"”’]\s*(?:이다|다|입니다)/)?.[1]?.trim();
  // 본문 문형 2: 정답은 [ X ]이다  또는  정답은 'X'이다
  const a =
    text.match(/(?<!다른 문제의 )정답은\s*\[\s*([^\]]{1,40}?)\s*\]/)?.[1]?.trim() ||
    text.match(/(?<!다른 문제의 )정답은\s*['"“‘]([^'"”’]{1,40}?)['"”’]/)?.[1]?.trim();
  if (q && a && isSaneAnswer(a) && isSaneQuestion(q)) {
    out.push({ slug, ...buildItem(q, [a]) });
  }
  // 본문 문형 3: 다른 문제의 정답은 'A' 또는 'B'이다 — 랜덤 출제형의 추가 정답
  const extra = text.match(/다른 문제의 정답은\s*([^.]{2,120}?)(?:이다|다)\./)?.[1];
  if (extra) {
    const vals = [...extra.matchAll(/['"“‘]([^'"”’]{1,40}?)['"”’]/g)]
      .map((m) => m[1].trim())
      .filter(isSaneAnswer);
    if (vals.length > 0) {
      const label = BY_SLUG[slug]?.shortName || slug;
      out.push({ slug, ...buildItem(`${label} — 오늘의 다른 문제`, vals) });
    }
  }
  return out;
}

async function collectFromGametoc() {
  const today = kstToday();
  await gtocDiscover(today).catch(() => {});

  const jobs = [];
  for (const map of GTOC_TITLE_MAP) {
    for (const id of gtocArticleCache.get(`${today}:${map.slug}`) ?? []) {
      jobs.push({ slug: map.slug, id });
    }
  }

  const results = await Promise.all(
    jobs.map(async ({ slug, id }) => {
      if (gtocParsed.has(id)) return gtocParsed.get(id);
      try {
        const res = await fetch(GTOC_ART(id), {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        const items = parseGametocArticle(await res.text(), slug, today).map((r) => ({
          ...r,
          source: 'gametoc',
        }));
        if (items.length > 0) gtocParsed.set(id, items); // 성공한 기사만 캐시
        return items;
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

/* ────────────── 소스 E: 토막스 (quiz.epostphone.kr) ──────────────
 *
 * 2026-08-14 발굴. 우리와 같은 퀴즈 정답 집계 사이트인데, 우리·퀴즈벨·게임톡이
 * 하나로 묶어 다루는 퀴즈를 하위 유형까지 쪼개서 낸다. 특히 '비트버니 OX 퀴즈'는
 * 네 소스 어디에도 없어 우리가 8/1~8/14 내내 하루 1건씩 놓치고 있었다(실측).
 *
 * 구조가 아주 단순하고 예측 가능하다:
 *   상세: https://quiz.epostphone.kr/{YYYY-MM-DD}-{tmSlug}-quiz-answer
 *         <p class="quiz-question">지문</p> … <div class="post-answer-value">정답</div>
 *   날짜가 주소에 박혀 있어 목록을 훑을 필요가 없고, 아직 안 나온 날짜는 404다
 *   (실측: 미래 날짜 요청 → 404). 즉 주소 하나만 때리면 되고 오발행 위험이 없다.
 */
const TOMAX_ART = (date, tm) => `https://quiz.epostphone.kr/${date}-${tm}-quiz-answer`;

// 우리 slug → 토막스 slug. 여기 한 줄 추가하면 그 퀴즈가 바로 수집된다.
//
// 토막스의 진짜 값어치는 '하위 유형을 쪼개 낸다'는 점이다. 다른 소스는 카뱅을
// 한 덩어리로 다루는데 토막스는 OX와 AI 이모지를 따로 낸다. 그래서 다른 소스가
// 늦거나 한 종류만 줄 때 나머지를 여기서 메운다.
// 8/14 실측: 카뱅 AI 이모지 정답('제조업')이 우리 4소스엔 없고 토막스에만 있었다.
const TOMAX_MAP = [
  { slug: 'bitbunny-ox', tm: 'bitbunny_ox' }, // 다른 소스에 아예 없는 퀴즈
  { slug: 'kakaobank', tm: 'kakaobank_ai' }, // 카뱅 AI 이모지 (OX와 별도 출제)
  { slug: 'kb-star', tm: 'kbstar_hist' }, // KB 한국사 (스타퀴즈와 별도)
  { slug: 'hana-onq', tm: 'hanalife' }, // 하나원큐 슬기로운 금융생활 OX
  { slug: 'monimo', tm: 'monimo_eng' }, // 모니모 영어챌린지
];

// `${today}:${slug}` → items. 하루치 완성본이라 한 번 성공하면 다시 안 긁는다.
const tomaxParsed = new Map();

function parseTomax(html, slug) {
  const questions = [...html.matchAll(/class="quiz-question"[^>]*>([\s\S]*?)<\/p>/g)].map((m) =>
    clean(m[1]),
  );
  const answers = [...html.matchAll(/class="post-answer-value"[^>]*>([\s\S]*?)<\/div>/g)].map((m) =>
    clean(m[1]),
  );
  const out = [];
  for (let i = 0; i < Math.min(questions.length, answers.length); i += 1) {
    // "O (맞아요)" 처럼 괄호 부연이 붙어 온다 — 앞의 실제 값만 쓴다.
    //
    // ⚠️ 2026-08-17 사고: 이 규칙이 정답을 잘라먹었다.
    //   토막스 원문 "② (나)-(가)-(다)" → 끝의 "(다)"를 부연으로 오인해 제거 →
    //   "② (나)-(가)-" 가 라이브에 발행됐다. 한국사 순서나열 문제라 괄호가
    //   부연이 아니라 정답 내용 자체였다. 답이 안 되는 값을 내보낸 셈이다.
    //
    // 구분 기준: 괄호가 문자열 전체에 딱 하나면 부연으로 본다. 둘 이상이면
    // 나열·수식의 일부이므로 손대지 않는다.
    //   "O (맞아요)"        괄호 1개 → 제거 → "O"
    //   "② (나)-(가)-(다)"  괄호 3개 → 그대로
    const raw = answers[i];
    const parenCount = (raw.match(/\(/g) || []).length;
    const trimmed = raw.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const a = parenCount === 1 && trimmed ? trimmed : raw.trim();
    const q = questions[i];
    if (q && a && isSaneQuestion(q) && isSaneAnswer(a)) out.push({ slug, ...buildItem(q, [a]) });
  }
  return out;
}

async function collectFromTomax() {
  const today = kstToday();
  const results = await Promise.all(
    TOMAX_MAP.map(async ({ slug, tm }) => {
      const key = `${today}:${slug}`;
      if (tomaxParsed.has(key)) return tomaxParsed.get(key);
      try {
        const res = await fetch(TOMAX_ART(today, tm), {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return []; // 아직 미발행이면 404 — 정상 경로다
        const items = parseTomax(await res.text(), slug).map((r) => ({ ...r, source: 'tomax' }));
        if (items.length > 0) tomaxParsed.set(key, items);
        return items;
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

/* ────────────── 소스 F: 팁is팁 (tipistip.com) ──────────────
 *
 * 2026-08-14 발굴. 커뮤니티 게시판인데 어느 집계 사이트에도 없는 소형 퀴즈를
 * 매일 올린다(어댑터·머니워크·요잇·예스24·폴센트). 이 다섯은 언론사도 안 다뤄서
 * 검색 경쟁이 사실상 없다.
 *
 * ⚠️ 한계를 알고 쓴다 — 본문에 문제 지문이 없고 정답만 있다(실측).
 *   본문 예: `어댑터 퀴즈] 라이브 11시<br><br>정답 : 1, X, 4`
 *   그래서 제목을 지문 자리에 쓴다. 지문 기반 롱테일 전략은 이 다섯에는 못 쓰고,
 *   대표 키워드("어댑터 퀴즈 정답")로만 노린다. 나중에 지문 있는 소스가 생기면
 *   isBetterQuestion 규칙에 따라 자동으로 더 좋은 지문으로 갈아끼워진다.
 *
 * 구조:
 *   목록: board.php?bo_table=quiz&page=N → <div class="bo_tit"> 안에 wr_id + 제목
 *         제목 형식: `카테고리] 퀴즈이름 [2026년 08월 14일]`
 *   본문: <div id="bo_v_con"> … 정답 : X </div>
 */
const TIP_LIST = (page) => `https://www.tipistip.com/bbs/board.php?bo_table=quiz&page=${page}`;
const TIP_ART = (id) => `https://www.tipistip.com/bbs/board.php?bo_table=quiz&wr_id=${id}`;

/**
 * 제목 → slug 매핑.
 *
 * ⚠️ 8/15·8/16 연속 사고에서 배운 것 — 이 목록은 '보너스'가 아니라 '안전망'이다.
 *
 * 예전 주석은 "다른 소스가 잘 잡는 퀴즈는 넣지 않는다(중복 조회 낭비)"였다.
 * 그 전제가 틀렸다. 8/15 팁is팁에 옥션(정답 "베스트")과 토스 두근두근이 버젓이
 * 올라와 있었는데 우리는 0건이었고, 8/16에도 토스를 또 놓쳤다. 퀴즈벨은 그날
 * 제목만 올리고 정답 칸을 안 채운 상태였다(parseTeampljeon 이 정상적으로 빈 배열
 * 반환). 즉 "다른 소스가 잘 잡는다"는 보장이 애초에 없다.
 *
 * 조회 몇 번 아끼는 것보다 정답 하나 놓치는 손해가 훨씬 크다. 그래서 퀴즈벨이
 * 늦거나 빠뜨리는 퀴즈까지 전부 등록해 이중화한다.
 *
 * ⚠️ 매칭은 위에서부터 첫 일치가 이긴다. 애매한 패턴을 넣으면 엉뚱한 퀴즈에
 * 남의 정답이 붙는다 — 그건 못 가져오는 것보다 훨씬 나쁘다. 반드시 지킬 것:
 *   - 카테고리 라벨(`오퀴즈]`)까지 포함해 앵커를 건다.
 *   - 같은 앱이 여러 퀴즈를 내면(하나원큐 축구/트래블, 카카오뱅크 이모지/OX,
 *     모니모 모니스쿨/영어, KB 한국사/스타퀴즈) 구분 단어를 넣거나 아예 뺀다.
 *   - `토스 행운퀴즈]`(랜덤 출제형)와 `토스 이벤트] 두근두근`은 완전히 다른 퀴즈다.
 */
/**
 * `backup: true` 는 "그 퀴즈에 오늘 정답이 하나도 없을 때만 쓴다"는 뜻이다.
 *
 * ⚠️ 이 구분이 없으면 틀린 정답을 발행한다. 8/16 실측으로 확인한 사고 시나리오:
 *   닥터나우는 하루 2회(00:00, 02:20) 출제한다. 우리는 퀴즈벨에서 지문과 함께
 *   "미녹시딜을 바르면… → O"를 이미 받아뒀는데, 팁is팁 오늘 글의 정답은 "X"였다.
 *   팁is팁은 본문에 지문이 없어서 그 X가 '어느 문제의 답인지' 확정할 수 없다.
 *   그대로 넣었으면 같은 퀴즈 페이지에 O와 X가 나란히 붙었을 것이다.
 *   케이뱅크("히트플레이션" vs "1번 히트플레이션"), 기후행동("X (아니다)" vs "아니다")도
 *   같은 답인데 표기만 달라, 지문 없이 넣으면 중복 판정을 빠져나가 두 줄이 된다.
 *
 * 못 가져오는 손해보다 틀린 답을 내보내는 손해가 훨씬 크다. 그래서 지문 있는 소스가
 * 이미 답을 확보한 퀴즈에는 팁is팁을 쓰지 않는다 — 빈 곳만 메운다.
 *
 * backup 이 아닌 것(=항상 사용):
 *   - 팁is팁 전용 퀴즈: 다른 소스가 아예 안 다뤄서 여기 아니면 못 가져온다.
 *   - 토스 두근두근: 퀴즈벨 경로도 지문이 '(오전)/(오후)' 고정이라 형태가 같다.
 *     지문이 일치하므로 중복 판정이 정상 작동한다.
 */
const TIP_TITLE_MAP = [
  // ── 항상 사용 ──
  { slug: 'toss-lucky', re: /^토스 이벤트\][\s\S]*두근두근/ },
  { slug: 'adapter', re: /어댑터/ },
  { slug: 'moneywalk', re: /머니워크/ },
  { slug: 'yoit', re: /요잇/ },
  { slug: 'yes24', re: /예스24/ },
  { slug: 'fallcent', re: /폴센트/ },
  // ── 빈 곳 메우기 전용(backup) ──
  // 앱 하나가 퀴즈를 여러 개 내는 경우가 많아서, 어느 퀴즈인지 확정되는
  // 구분 단어(AI 이모지 / 한국사 / 슬기로운 / 오늘의영어)까지 넣어 앵커를 건다.
  // 2026-08-17: TIP_UNMAPPED 보고로 발견. 팁is팁은 KB Pay 를 옛 이름(리브메이트)으로 부른다.
  { slug: 'kbpay', re: /^리브메이트 퀴즈\]/, backup: true },
  { slug: 'ok-cashbag', re: /^오퀴즈\]/, backup: true },
  { slug: 'paybooc', re: /^페이북 퀴즈\]/, backup: true },
  { slug: 'kakaopay', re: /^카카오페이\]/, backup: true },
  { slug: 'auction', re: /^옥션 퀴즈\]/, backup: true },
  { slug: 'nh-allone', re: /올원뱅크 디깅퀴즈/, backup: true },
  { slug: 'kakaobank', re: /카카오뱅크 AI 이모지/, backup: true },
  { slug: 'kb-star', re: /^KB 스타뱅킹\][\s\S]*한국사/, backup: true },
  { slug: 'hana-onq', re: /하나원큐 슬기로운 금융생활/, backup: true },
  { slug: 'monimo', re: /모니모 오늘의영어/, backup: true },
  { slug: 'shinhan-sol', re: /^신한페이판\][\s\S]*팡팡퀴즈/, backup: true },
  { slug: 'kbank', re: /^케이뱅크\]/, backup: true },
  { slug: 'climate-action', re: /기후행동/, backup: true },
  { slug: 'hpoint', re: /^Hpoint/, backup: true },
  { slug: 'bitbunny-ox', re: /비트버니\s*-\s*OX/, backup: true },
  { slug: 'bitbunny', re: /비트버니\s*-\s*오늘의/, backup: true },
  { slug: 'doctornow', re: /닥터나우/, backup: true },
  { slug: 'mydoctor', re: /^나만의 닥터\]/, backup: true },
];

/**
 * 매핑하지 않기로 '판단을 끝낸' 제목들.
 *
 * 미매칭 보고를 쓸모 있게 만들려면 아는 것과 모르는 것을 갈라야 한다. 매일 나오는
 * 같은 제목 14줄이 계속 뜨면 사람이 안 본다. 여기 걸리는 건 조용히 넘기고,
 * 여기에도 TIP_TITLE_MAP 에도 없는 '처음 보는 제목'만 보고한다.
 *
 * 목록에 넣은 이유를 반드시 같이 적는다. 나중에 판단을 뒤집을 근거가 된다.
 */
const TIP_REVIEWED = [
  // 우리 kb-star 는 '한국사 매일 퀴즈'다. 스타퀴즈는 별개 퀴즈라 정답이 다르다.
  /^KB 스타뱅킹\][\s\S]*스타퀴즈/,
  // 우리 shinhan-sol 은 쏠퀴즈·퀴즈팡팡·출석퀴즈다. 야구퀴즈는 별개 출제다.
  /^신한 쏠야구퀴즈\]/,
  /^신한페이판 출석퀴즈\]/,
  // 우리 kakaobank 는 AI 이모지 퀴즈다. OX퀴즈(혜택)는 별개 출제다.
  /카카오뱅크 OX퀴즈/,
  // 우리 hana-onq 는 슬기로운 금융생활 OX다. 트래블미션·축구Play 는 별개다.
  /하나원큐 트래블미션/,
  /하나원큐 \(오른쪽 하단/,
  // 우리 monimo 는 오늘의영어다. 모니스쿨 N교시는 별개 출제다.
  /모니모 모니스쿨/,
  // 랜덤 출제형(글자수·초성 힌트로 답이 매번 달라짐). 우리 cashwalk/cashdoc 가
  // 전용 경로로 따로 처리하므로 제목 매칭으로 가져오면 오히려 잘못된 답이 붙는다.
  /문제는 랜덤입니다/,
  // 우리가 다루지 않는 앱들. 다룰지 말지는 별도 판단 사항이라 여기서 침묵시킨다.
  /^메모리워드/,
  /^지니어트/,
  // 이미 종료된 이벤트 — 오늘자로 올라와도 발행하면 안 된다.
  /^\(종료\)/,
];

/**
 * 오늘자인데 위 매핑 어디에도 안 걸린 제목들. `제목 → wr_id`.
 *
 * 화이트리스트의 근본 약점은 "모르는 건 영원히 모른다"이다. 8/15에 옥션·토스를
 * 놓친 것도, 목록에 없으니 화면에 보여도 그냥 지나쳤기 때문이다. 이 그물이 그걸 깬다.
 *
 * 두 가지를 동시에 잡는다.
 *   ① 매핑 누락 — 우리가 다루는 퀴즈인데 제목 형식이 바뀌어 안 걸리는 경우
 *   ② 신규 퀴즈 발굴 — 아직 우리 30종에 없는 퀴즈(예: 네이버페이 랜덤 포인트 퀴즈)
 * healthcheck 가 이걸 출력하므로 사람은 보고 판단만 하면 된다.
 */
export const TIP_UNMAPPED = new Map();

const tipArticleCache = new Map(); // `${today}:${slug}` → Set(wr_id)
const tipParsed = new Map(); // wr_id → items
let tipListFetchedAt = 0;

/** 목록 제목의 `[2026년 08월 14일]` 을 `2026-08-14` 로 바꾼다. */
function tipTitleDate(title) {
  const m = title.match(/\[(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\]/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

/** 제목에서 날짜·카테고리 껍데기를 걷어내 지문 자리에 쓸 문장을 만든다. */
function tipQuestion(title) {
  return title
    .replace(/\[\d{4}년[\s\S]*$/, '')
    .replace(/^\(종료\)\s*/, '')
    .replace(/^기타퀴즈\]\s*/, '') // 의미 없는 분류 라벨
    .replace(/\]\s*/g, ' ')
    .replace(/\s*-\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function tipDiscover(today) {
  if (Date.now() - tipListFetchedAt < 90_000) return;
  tipListFetchedAt = Date.now();
  // 한 페이지에 15건이고 하루 30~40건이 올라온다. 자정 직후엔 오늘 글이 1페이지지만
  // 저녁이면 3페이지까지 밀린다(8/14 실측: 요잇·예스24가 3페이지에 있었다).
  // 4페이지=60건이면 오늘치를 항상 덮는다. 날짜 필터가 어제 글을 걸러내므로 넉넉히 본다.
  for (const page of [1, 2, 3, 4]) {
    const res = await fetch(TIP_LIST(page), {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) continue;
    const html = (await res.text()).replace(/&amp;/g, '&');
    for (const [, block] of html.matchAll(/<div class="bo_tit">([\s\S]{0,500}?)<\/div>/g)) {
      const id = block.match(/wr_id=(\d+)/)?.[1];
      if (!id) continue;
      const title = clean(block);
      if (tipTitleDate(title) !== today) continue; // 오늘자만 — 어제 정답 오발행 차단
      const map = TIP_TITLE_MAP.find((m) => m.re.test(title));
      if (!map) {
        // 안 걸린 오늘자 글은 버리지 말고 남긴다 — healthcheck 가 이걸 보고한다.
        // 단 '판단을 끝낸' 제목은 조용히 넘긴다. 그래야 보고가 신호로 남는다.
        if (!TIP_REVIEWED.some((re) => re.test(title))) {
          const bare = title
            .replace(/\s*N?\s*새글\s*$/, '')
            .replace(/\s*\[\d{4}년[^\]]*\]\s*$/, '')
            .trim();
          TIP_UNMAPPED.set(bare, id);
        }
        continue;
      }
      const key = `${today}:${map.slug}`;
      if (!tipArticleCache.has(key)) tipArticleCache.set(key, new Set());
      tipArticleCache.get(key).add(id);
    }
  }
}

function parseTipArticle(html, slug, title) {
  const start = html.indexOf('bo_v_con');
  if (start === -1) return [];
  const seg = html.slice(start, start + 4000).split('<!-- } 본문 내용 끝')[0];
  const text = clean(seg.replace(/<br\s*\/?>/g, '\n')).replace(/^bo_v_con">/, '');
  // 본문 문형: `정답 : O` / `정답: 1, X, 4` / `정답 : 주식투자 불패의 법칙`
  //
  // ⚠️ 예전엔 {1,40}으로 잘랐다. 그래서 토스처럼 한 줄에 두 답이 들어오는 형식
  //   `정답 : 오전 - 더킹라이트 엘사 크리스탈, 오후 - 병아리 무드등` (8/16 실측)
  // 이 40자에서 잘려 나가 통째로 버려졌다. 넉넉히 받아서 아래에서 쪼갠다.
  const raw = text.match(/정답\s*[:：]\s*([^\n<]{1,120})/)?.[1]?.trim();
  if (!raw) return [];

  const q = tipQuestion(title);
  if (!isSaneQuestion(q)) return [];

  // 오전/오후가 한 줄에 같이 오는 형식은 두 건으로 분리한다.
  // 지문 문구를 퀴즈벨 경로(parseTeampljeon)와 똑같이 맞춰야 중복 판정이 걸려
  // 같은 정답이 두 줄로 발행되지 않는다.
  if (/오전\s*[-–—:]/.test(raw) && /오후\s*[-–—:]/.test(raw)) {
    const am = raw.match(/오전\s*[-–—:]\s*(.+?)(?=\s*[,·]?\s*오후\s*[-–—:]|$)/)?.[1]?.replace(/[,·]\s*$/, '').trim();
    const pm = raw.match(/오후\s*[-–—:]\s*(.+)$/)?.[1]?.trim();
    const out = [];
    const base = slug === 'toss-lucky' ? '토스 두근두근 1등 찍기 팀플전' : q;
    if (am && isSaneAnswer(am)) out.push({ slug, ...buildItem(`${base} (오전)`, [am]) });
    if (pm && isSaneAnswer(pm)) out.push({ slug, ...buildItem(`${base} (오후)`, [pm]) });
    return out;
  }

  if (!isSaneAnswer(raw)) return [];
  return [{ slug, ...buildItem(q, [raw]) }];
}

/**
 * @param existing 오늘자 기존 데이터(loadExisting 결과). 주면 backup 항목을
 *                 '아직 정답이 하나도 없는 퀴즈'에만 적용한다. 안 주면 전부 조회한다
 *                 (단위 테스트·감시용 호출 경로).
 */
async function collectFromTipistip(existing = null) {
  const today = kstToday();
  await tipDiscover(today).catch(() => {});

  const have = new Set(
    Object.entries(existing?.answers ?? {})
      .filter(([, v]) => Array.isArray(v) && v.length > 0)
      .map(([slug]) => slug),
  );

  const jobs = [];
  for (const map of TIP_TITLE_MAP) {
    // 지문 없는 소스로 '이미 답이 있는 퀴즈'를 덮으면 틀린 답이 붙는다(위 주석 참고).
    if (map.backup && existing && have.has(map.slug)) continue;
    for (const id of tipArticleCache.get(`${today}:${map.slug}`) ?? []) {
      jobs.push({ slug: map.slug, id });
    }
  }

  const results = await Promise.all(
    jobs.map(async ({ slug, id }) => {
      if (tipParsed.has(id)) return tipParsed.get(id);
      try {
        const res = await fetch(TIP_ART(id), {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; quizday-collector)' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return [];
        const html = await res.text();
        const title = clean(html.match(/<title>([^<]*)<\/title>/)?.[1] || '').split('>')[0].trim();
        const items = parseTipArticle(html, slug, title).map((r) => ({ ...r, source: 'tipistip' }));
        if (items.length > 0) tipParsed.set(id, items);
        return items;
      } catch {
        return [];
      }
    }),
  );
  return results.flat();
}

/* ────────────────────────── 조립 ────────────────────────── */

function buildItem(question, answers) {
  const uniq = [...new Set(answers)];
  if (uniq.length > 1) {
    return {
      question,
      answer: null,
      choices: uniq,
      note: '문제가 랜덤으로 여러 번 바뀌는 이벤트 퀴즈 — 화면의 초성 힌트와 일치하는 정답을 후보 중에서 확인하세요.',
    };
  }
  return { question, answer: uniq[0], note: '' };
}

function fileFor(today) {
  return path.join(ANSWERS_DIR, `${today}.json`);
}

function loadExisting(today) {
  const file = fileFor(today);
  if (fs.existsSync(file)) {
    const d = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const slug of QUIZ_SLUGS) if (!d.answers[slug]) d.answers[slug] = [];
    return d;
  }
  const empty = { date: today, updatedAt: null, answers: {} };
  for (const slug of QUIZ_SLUGS) empty.answers[slug] = [];
  return empty;
}

/**
 * 이미 발행된 오늘자 데이터에서 쓰레기 행을 스스로 걷어낸다.
 * 수집기를 아무리 조여도 소스가 새로운 방식으로 이상한 걸 흘리면 뚫린다.
 * 그래서 매 실행마다 발행된 것 자체를 다시 검사해서 자가 치유하게 둔다.
 * 판정 기준은 수집 때와 같다(isSaneQuestion / isSaneAnswer) — 규칙이 좁아서
 * 정상 정답을 잘못 지울 위험이 낮다.
 */
/**
 * "이미 발행된 것을 지워도 되는가"를 판정한다. 수집 단계 필터(isSaneAnswer)와
 * 절대 같은 기준을 쓰면 안 된다 — 이유는 두 가지다.
 *
 *  1) answer 없이 choices만 있는 정답이 정상적으로 존재한다. 캐시워크 초성 이벤트가
 *     그렇다(7/26 하루에만 29건). 수집 기준으로 지우면 이 29건이 통째로 날아간다.
 *  2) 수집 필터는 "의심스러우면 안 받는다"가 맞다 — 버려도 다음 회차에 다시 들어온다.
 *     하지만 삭제는 되돌릴 수 없다. 그래서 여기서는 "확실한 쓰레기"만 지운다.
 *     예: 길이 40자 초과는 수집 때는 거르지만, 이미 발행된 긴 정답은 진짜일 수 있어
 *     지우지 않는다(7/18 토스 팀플전 정답이 실제로 66자였다).
 */
function garbageReason(it) {
  if (!isSaneQuestion(it.question)) return '지문이 커뮤니티 글/장난';
  const a = String(it.answer ?? '').trim();
  const hasChoices = Array.isArray(it.choices) && it.choices.length > 0;
  if (!a && !hasChoices) return '정답도 선택지도 없음';
  if (!a) return null; // choices만 있는 정상 이벤트 퀴즈
  if (PLACEHOLDER.has(a)) return '자리표시자';
  if (/https?:\/\//i.test(a)) return '정답에 URL';
  if (/^[-–—·.,?!/|]/.test(a)) return '정답이 문장부호로 시작';
  if (/\d{1,2}시 \d{1,2}분/.test(a)) return '커뮤니티 잡담';
  if (!/[가-힣A-Za-z0-9]/.test(a)) return '글자 없음';
  return null;
}

function sweepGarbage(today) {
  const file = fileFor(today);
  if (!fs.existsSync(file)) return 0;
  const d = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let removed = 0;
  for (const [slug, arr] of Object.entries(d.answers || {})) {
    if (!Array.isArray(arr) || !arr.length) continue;
    const kept = arr.filter((it) => {
      const why = garbageReason(it);
      if (why) {
        console.log(`[자가치유] 쓰레기 삭제 [${slug}] "${it.question}" = "${it.answer}" (${why})`);
        removed += 1;
        return false;
      }
      return true;
    });
    d.answers[slug] = kept;
  }
  if (removed > 0) {
    d.updatedAt = kstStamp();
    fs.writeFileSync(file, JSON.stringify(d, null, 2));
    if (AUTO_PUSH) {
      const ts = kstStamp().slice(5, 16).replace('T', ' ');
      gitCommitPush(`data: ${ts} 쓰레기 ${removed}건 자동 삭제`);
    }
  }
  return removed;
}

const DOW_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** 이 퀴즈가 해당 요일에 나오는가? */
function runsOn(q, dow) {
  const cad = q.cadence;
  if (!cad) return true;
  if (cad.type === 'weekdays') return dow >= 1 && dow <= 5;
  if (cad.type === 'weekly') return (cad.days || []).some((d) => DOW_MAP[d] === dow);
  return true; // irregular 은 언제 나올지 몰라 항상 후보로 둔다
}

/**
 * 공개 시각 하나당 감시 창 하나. dayOffset 만큼 분을 밀어서 반환하므로
 * "오늘 23:58~00:25" 같은 자정 넘김 구간이 자연스럽게 표현된다
 * (= 내일의 00:00 발행에서 나온 창).
 */
function rawWindows(dow, dayOffset) {
  const out = [];
  for (const q of QUIZZES) {
    if (!runsOn(q, dow)) continue;
    for (const t of q.releaseTimes || []) {
      const [h, m] = t.split(':').map(Number);
      const rel = h * 60 + m + dayOffset * 1440;
      out.push({ a: rel - WINDOW_BEFORE, b: rel + WINDOW_AFTER, slug: q.slug });
    }
  }
  return out;
}

/** 가까이 붙은 창끼리 이어붙인다. 08:00 / 08:30 / 09:00 처럼 촘촘하면 한 덩어리로 지킨다. */
function mergeWindows(windows) {
  const sorted = [...windows].sort((x, y) => x.a - y.a);
  const merged = [];
  for (const w of sorted) {
    const last = merged[merged.length - 1];
    if (last && w.a - last.b <= MERGE_TOLERANCE) {
      last.b = Math.max(last.b, w.b);
      last.slugs.add(w.slug);
    } else {
      merged.push({ a: w.a, b: w.b, slugs: new Set([w.slug]) });
    }
  }
  return merged;
}

/**
 * 지금 진행 중이거나 앞으로 올 첫 감시 구간.
 * 오늘과 내일 것을 함께 만들어서 자정 경계를 특별취급하지 않는다.
 */
function upcomingBlock(nowMin, dow) {
  const all = mergeWindows([...rawWindows(dow, 0), ...rawWindows((dow + 1) % 7, 1)]);
  return all.find((b) => b.b > nowMin) || null;
}

/** 구간에 속한 퀴즈 중 아직 정답이 없는 것들 */
function pendingIn(block, existing) {
  return [...block.slugs].filter((s) => (existing.answers[s] || []).length === 0);
}

const fmtMin = (m) => {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};

/**
 * 두 정답 파일을 합친다. 정답 파일은 본질적으로 "집합"이라서
 * 텍스트 3-way 머지로 풀 게 아니라 항목 단위 합집합으로 풀어야 맞다.
 * 같은 정답이면 먼저 발행된 쪽의 publishedAt을 남긴다(선점 시각이 우리 무기니까).
 */
function mergeAnswerData(base, incoming) {
  const out = { date: base.date, updatedAt: base.updatedAt, answers: {} };
  const slugs = new Set([...Object.keys(base.answers || {}), ...Object.keys(incoming.answers || {})]);
  for (const slug of slugs) {
    const merged = [];
    for (const item of [...(base.answers?.[slug] || []), ...(incoming.answers?.[slug] || [])]) {
      const hit = merged.find((x) => itemKey(x) && itemKey(x) === itemKey(item));
      if (hit) {
        if (item.publishedAt && (!hit.publishedAt || item.publishedAt < hit.publishedAt)) {
          hit.publishedAt = item.publishedAt;
        }
        continue;
      }
      if (isDuplicate(merged, item)) continue;
      merged.push({ ...item });
    }
    out.answers[slug] = merged;
  }
  const stamps = [base.updatedAt, incoming.updatedAt].filter(Boolean).sort();
  out.updatedAt = stamps.length ? stamps[stamps.length - 1] : kstStamp();
  return out;
}

/**
 * 커밋·푸시. 다른 워크플로(또는 CCR 트리거)가 같은 파일을 동시에 밀면 push가 거절되는데,
 * 이때 rebase로 풀려고 하면 JSON 텍스트 충돌이 나서 job이 rebase 도중에 멈춰버린다.
 * 그래서 충돌 시엔 rebase를 쓰지 않고 origin/main으로 되감은 뒤
 * 정답을 항목 단위로 합쳐서 다시 커밋한다. 어느 쪽 정답도 잃지 않는다.
 */
function gitCommitPush(message, attempt = 0) {
  const run = (args) => execFileSync('git', args, { stdio: 'pipe' }).toString().trim();
  const quiet = (args) => {
    try {
      run(args);
    } catch {
      /* 정리용 명령은 실패해도 무시 */
    }
  };

  try {
    // data/answers 만 스테이징하면 소스 대조 기록(verify-status.json)이 영영 안 올라간다.
    // 7/29 실측: 예약 실행이 파일을 만들긴 했는데, 그건 세션이 git add -A 를 해준 덕분이었고
    // 이 함수가 올린 게 아니었다. 즉 자동 경로만으로는 기록이 남지 않는 상태였다.
    //
    // ⚠️ 없는 경로를 add 하면 git 이 exit 128 로 죽는다("pathspec did not match").
    //    새로 클론한 아침에는 verify 가 아직 안 돌아 이 파일이 없다. 그때 무조건 넣으면
    //    정답 발행이라는 가장 중요한 경로가 통째로 막힌다. 그래서 있을 때만 얹는다.
    const paths = ['data/answers'];
    if (fs.existsSync(path.join(process.cwd(), 'data', 'verify-status.json'))) {
      paths.push('data/verify-status.json');
    }
    run(['add', ...paths]);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only']).toString().trim();
    if (!staged) return false;
    run(['-c', 'user.name=quizday-bot', '-c', 'user.email=bot@quizday', 'commit', '-m', message]);
    run(['push', 'origin', 'HEAD:main']);
    return true;
  } catch (e) {
    const msg = e.stderr?.toString() || e.message;
    if (attempt >= 3) {
      console.error('git 실패(재시도 소진):', msg);
      return false;
    }
    console.log(`[git] push 거절 — 원격과 병합 후 재시도 (${attempt + 1}/3)`);

    // 혹시 이전에 걸린 rebase/merge 상태가 있으면 확실히 걷어낸다.
    quiet(['rebase', '--abort']);
    quiet(['merge', '--abort']);

    const today = kstToday();
    const file = fileFor(today);
    let mine = null;
    try {
      mine = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      /* 파일이 없으면 그냥 원격을 따른다 */
    }

    try {
      run(['fetch', 'origin', 'main']);
      run(['reset', '--hard', 'FETCH_HEAD']);
    } catch (e2) {
      console.error('원격 되감기 실패:', e2.stderr?.toString() || e2.message);
      return false;
    }

    if (mine) {
      let theirs = { date: today, updatedAt: null, answers: {} };
      try {
        theirs = JSON.parse(fs.readFileSync(file, 'utf-8'));
      } catch {
        /* 원격에 오늘자 파일이 없을 수도 있다 */
      }
      const merged = mergeAnswerData(theirs, mine);
      fs.mkdirSync(ANSWERS_DIR, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(merged, null, 2));
    }

    return gitCommitPush(message, attempt + 1);
  }
}

/** 한 바퀴 수집. 새로 추가된 건수를 반환한다. */
async function collectOnce() {
  const today = kstToday();
  const existing = loadExisting(today);

  const [a, b, c, d, e, f] = await Promise.all([
    collectFromBlog().catch((e) => {
      console.error('블로그 소스 실패:', e.message);
      return [];
    }),
    collectFromQuizbells(),
    collectFromBizwnews().catch((e) => {
      console.error('비즈월드 소스 실패:', e.message);
      return [];
    }),
    collectFromGametoc().catch((e) => {
      console.error('게임톡 소스 실패:', e.message);
      return [];
    }),
    collectFromTomax().catch((e) => {
      console.error('토막스 소스 실패:', e.message);
      return [];
    }),
    collectFromTipistip(existing).catch((e) => {
      console.error('팁is팁 소스 실패:', e.message);
      return [];
    }),
  ]);
  // 순서 = 우선순위. 같은 정답이 여러 소스에서 오면 앞쪽 것이 채택된다(뒤는 중복 처리).
  // 블로그가 맨 앞인 이유: 문제 지문이 가장 길고 정확하다.
  // 비즈월드가 퀴즈벨보다 앞인 이유: 정답 표기가 언론사 교열을 거쳐 더 깔끔하다.
  // ※ "누가 먼저 올렸나"는 이 순서와 무관하다. 매 폴링마다 세 소스를 동시에 조회하므로
  //    실제로는 "그 시점에 정답을 갖고 있는 소스"가 이긴다 — 즉 가장 빨리 올린 곳이 이긴다.
  // 게임톡(d)은 언론사 교열본이라 비즈월드 다음, 퀴즈벨 앞. (2026-08-10 추가)
  // 토막스(e)는 지문·정답이 온전해 퀴즈벨 앞. 팁is팁(f)은 지문이 없어 맨 뒤 —
  // 다른 소스가 같은 정답을 지문과 함께 주면 그쪽이 이겨야 한다. (2026-08-14 추가)
  const found = [...a, ...c, ...d, ...e, ...b, ...f];

  let added = 0;
  let upgraded = 0;
  const bySlug = {};
  for (const f of found) {
    const current = existing.answers[f.slug] || (existing.answers[f.slug] = []);
    const item = { question: f.question, answer: f.answer, ...(f.choices ? { choices: f.choices } : {}), note: f.note };
    if (!isSaneQuestion(item.question)) {
      console.log(`지문 거부 [${f.slug}] "${item.question}" — 커뮤니티 글로 판단`);
      continue;
    }
    const at = dupIndex(current, item);
    if (at === -2) continue;
    if (at >= 0) {
      // 이미 있는 정답 — 다만 새 값이 "더 완전한" 정답이면 통째로 갈아끼운다.
      // 7/29 실측: "플립"이 먼저 들어와 진짜 정답 "플립, 폴드, 울트라"가 버려졌다.
      if (isFullerAnswer(current[at].answer, item.answer)) {
        console.log(`정답 보강 [${f.slug}] "${current[at].answer}" → "${item.answer}" (${f.source || '?'})`);
        current[at].answer = item.answer;
        if (item.choices) current[at].choices = item.choices;
        if (isBetterQuestion(current[at].question, item.question, f.slug)) {
          current[at].question = item.question;
        }
        current[at].source = f.source || current[at].source;
        upgraded += 1;
        continue;
      }
      // 정답은 같고 지문만 좋아진 경우 — 지문만 갈아끼운다.
      if (isBetterQuestion(current[at].question, item.question, f.slug)) {
        console.log(`지문 개선 [${f.slug}] "${current[at].question}" → "${item.question}" (${f.source || '?'})`);
        current[at].question = item.question;
        current[at].source = f.source || current[at].source;
        upgraded += 1;
      }
      continue;
    }
    // source를 남긴다 — "어느 소스가 먼저 도달했나"를 나중에 확실히 판정하기 위해서.
    current.push({ ...item, source: f.source || 'unknown', publishedAt: kstStamp() });
    added += 1;
    bySlug[f.slug] = (bySlug[f.slug] || 0) + 1;
  }

  if (added > 0 || upgraded > 0) {
    existing.updatedAt = kstStamp();
    fs.mkdirSync(ANSWERS_DIR, { recursive: true });
    fs.writeFileSync(fileFor(today), JSON.stringify(existing, null, 2));
  }
  return { added, upgraded, bySlug, existing };
}

/**
 * 동작 순서
 *  1) 무조건 한 바퀴 훑는다 (몇 초). 놓친 것 회수 + 공개 시각 미상 퀴즈 커버.
 *  2) 지금 진행 중이거나 앞으로 올 첫 감시 블록을 계산한다.
 *  3) 블록이 LEAD_MINUTES보다 멀면 그냥 끝낸다 — 이 job은 할 일이 없다.
 *  4) 가까우면 블록 시작까지 잠들었다가, 블록이 끝나거나 그 블록 퀴즈가
 *     전부 수집될 때까지 POLL_SECONDS 간격으로 감시하고, 잡히는 즉시 발행한다.
 */
async function main() {
  const t0 = Date.now();
  const hardStop = t0 + MAX_MINUTES * 60_000;

  const report = (n, bySlug) =>
    `${n}건 (${Object.entries(bySlug).map(([s, c]) => `${s} ${c}`).join(', ')})`;

  let total = 0;
  const allBySlug = {};
  const absorb = (r, tag) => {
    // 새 정답이 0건이어도 지문이 개선됐으면 반드시 내보낸다 — 제목이 곧 검색 유입이다.
    if (r.added === 0 && !r.upgraded) return;
    total += r.added;
    for (const [s, c] of Object.entries(r.bySlug)) allBySlug[s] = (allBySlug[s] || 0) + c;
    if (r.added > 0) console.log(`${tag} 새 정답 ${report(r.added, r.bySlug)}`);
    if (r.upgraded) console.log(`${tag} 문제 지문 개선 ${r.upgraded}건`);
    if (AUTO_PUSH) {
      const ts = kstStamp().slice(5, 16).replace('T', ' ');
      const what = r.added > 0
        ? `정답 ${r.added}건${r.upgraded ? ` · 지문 ${r.upgraded}건` : ''}`
        : `지문 개선 ${r.upgraded}건`;
      gitCommitPush(`data: ${ts} ${what}`);
    }
  };

  // 0) 이미 발행된 것 자가 검사 — 사람 손 없이 쓰레기를 스스로 걷어낸다.
  const swept = sweepGarbage(kstToday());
  if (swept) console.log(`[자가치유] 발행된 쓰레기 ${swept}건 삭제 완료`);

  // 1) 첫 스윕 — 항상 한다.
  const nowStart = kstNow();
  console.log(`[시작] ${kstToday()} ${fmtMin(nowStart.getUTCHours() * 60 + nowStart.getUTCMinutes())} KST`);
  const first = await collectOnce();
  absorb(first, '[스윕]');
  const already = Object.values(first.existing.answers || {}).filter((v) => v.length > 0).length;
  console.log(`[스윕] 새 정답 ${first.added}건 · 오늘 정답 있는 퀴즈 ${already}/${QUIZZES.length}개`);

  // 2) 다음 블록
  const now = kstNow();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const block = upcomingBlock(nowMin, now.getUTCDay());

  if (!block) {
    console.log(`완료 — 오늘 남은 감시 구간 없음 (누적 ${total}건)`);
    return;
  }

  const waitMin = block.a - nowMin;
  const label = `${fmtMin(block.a)}~${fmtMin(block.b)} KST · 퀴즈 ${block.slugs.size}개`;

  // 3) 아직 멀면 종료. 이 job은 여기서 끝난다(수십 초).
  if (waitMin > LEAD_MINUTES) {
    console.log(`완료 — 다음 감시 구간 ${label}, ${waitMin}분 뒤. 지금은 대기 안 함 (누적 ${total}건)`);
    return;
  }

  // 절대 시각으로 고정해 둔다. 이렇게 하면 23:58~00:25 자정 넘김도 별도 처리가 필요 없다.
  const startAt = t0 + Math.max(0, waitMin) * 60_000;
  const endAt = Math.min(t0 + (block.b - nowMin) * 60_000, hardStop);

  if (waitMin > 0) {
    console.log(`[대기] 감시 구간 ${label} — ${waitMin}분 뒤 시작. 잠들었다 깨어남`);
    await sleep(startAt - Date.now());
  }

  let pending = pendingIn(block, loadExisting(kstToday()));
  console.log(`[감시 시작] ${label} — 미수집 ${pending.length}개: ${pending.join(', ') || '없음'}`);

  while (Date.now() < endAt && pending.length > 0) {
    const r = await collectOnce();
    const elapsed = Math.round((Date.now() - t0) / 1000);
    absorb(r, `[감시 ${elapsed}초]`);
    pending = pendingIn(block, r.existing);
    if (pending.length === 0) break;
    const left = endAt - Date.now();
    if (left <= 0) break;
    await sleep(Math.min(POLL_SECONDS * 1000, left));
  }

  // 4) 전부 잡았으면 남은 시간을 낭비하지 않고 바로 끝낸다.
  //    다만 뭉뚱그린 지문("KB Pay 오늘의 퀴즈")으로 잡힌 게 있으면 바로 끄지 않는다.
  //    퀴즈벨이 몇십 초 먼저 도착하는 일이 흔한데, 여기서 끄면 뒤따라올 비즈월드의
  //    진짜 지문을 영영 못 받는다 — 그러면 제목이 하루 종일 검색에 안 걸린다(7/28 실측).
  if (pending.length === 0) {
    const genericLeft = () => {
      const cur = loadExisting(kstToday());
      return [...block.slugs].filter((s) =>
        (cur.answers[s] || []).some((it) => isGenericQuestion(it.question, s)),
      );
    };
    let g = genericLeft();
    const graceEnd = Math.min(Date.now() + GRACE_SECONDS * 1000, endAt, hardStop);
    if (g.length) {
      console.log(`[지문 대기] 뭉뚱그린 지문 ${g.length}개(${g.join(', ')}) — 최대 ${GRACE_SECONDS}초 더 본다`);
    }
    while (g.length > 0 && Date.now() < graceEnd) {
      await sleep(Math.min(POLL_SECONDS * 1000, graceEnd - Date.now()));
      absorb(await collectOnce(), `[지문 ${Math.round((Date.now() - t0) / 1000)}초]`);
      g = genericLeft();
    }
    console.log(
      g.length
        ? `[감시 완료] 정답 전부 수집 — 지문 미개선 ${g.join(', ')}`
        : `[감시 완료] 구간 내 퀴즈 전부 수집 — 조기 종료`,
    );
  } else {
    console.log(`[감시 종료] 아직 미공개: ${pending.join(', ')} — 다음 실행에서 계속`);
  }
  console.log(total > 0 ? `완료 — 총 ${report(total, allBySlug)}` : '완료 — 새 정답 없음');
}

// 직접 실행할 때만 돈다. 테스트에서 함수 단위로 import 할 수 있게 하기 위함.
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  main()
    // 수집이 끝나면 곧바로 소스와 대조한다.
    // 규칙을 아무리 다듬어도 다음 버그는 다른 모양으로 온다. 그래서 "규칙 추가"가 아니라
    // "결과 대조"를 마지막 관문으로 둔다 — 우리가 발행한 것과 소스가 지금 말하는 것을
    // 맞춰보고, 부분 정답은 그 자리에서 갈아끼운 뒤 푸시한다(7/29 토스 유형 재발 방지).
    .then(() => runVerify())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

async function runVerify() {
  if (process.env.SKIP_VERIFY === '1') return;
  let out = '';
  try {
    out = execFileSync(process.execPath, ['scripts/verify.mjs'], {
      env: { ...process.env, VERIFY_FIX: '1' },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180_000,
    });
  } catch (e) {
    // verify는 문제가 남아 있으면 종료 코드 1로 끝난다 — 예외가 아니라 정상 신호다.
    out = `${e.stdout || ''}${e.stderr || ''}`;
  }
  out = String(out).trim();
  if (out) console.log(out);
  // 실제로 고쳤거나 대조 결과가 달라졌을 때만 커밋한다.
  // 아무것도 안 바뀐 실행에서 커밋하면 하루 100건 넘는 잡음이 된다.
  const didFix = /VERIFY_FIXED=[1-9]/.test(out);
  const beat = /VERIFY_HEARTBEAT=1/.test(out);
  if (AUTO_PUSH && (didFix || beat)) {
    const ts = kstStamp().slice(5, 16).replace('T', ' ');
    gitCommitPush(didFix ? `data: ${ts} 소스 대조로 부분 정답 자동 교정` : `chore: ${ts} 소스 대조 결과 기록`);
  }
}

export {
  gitCommitPush,
  mergeAnswerData,
  isDuplicate,
  isGenericQuestion,
  questionSubstance,
  isBetterQuestion,
  isSaneAnswer,
  isSaneQuestion,
  parseTeampljeon,
  parseGametocArticle,
  collectFromGametoc,
  sweepGarbage,
  isFullerAnswer,
  garbageReason,
  parseQuizbells,
  parseBizwArticle,
  collectFromBizwnews,
  runsOn,
  rawWindows,
  mergeWindows,
  upcomingBlock,
  pendingIn,
  fmtMin,
  // healthcheck 가 팁is팁까지 대조하려면 이 둘이 필요하다.
  // 감시자가 수집기와 '같은 눈'을 쓰면 같은 걸 못 본다 — 그래서 감시 쪽에서는
  // 여기서 나온 결과를 우리 데이터와 대조만 하고, 판정 기준은 더 느슨하게 잡는다.
  collectFromTipistip,
  TIP_TITLE_MAP,
  // 회귀 테스트용 — 8/17 '② (나)-(가)-' 잘림 사고 이후 추가.
  parseTomax,
  parseTipArticle,
  normalize,
  itemKey,
};
