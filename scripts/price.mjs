/**
 * 금·은·환율 시세 수집기 — public/price.json 을 만든다.
 *
 * ── 이 파일이 왜 퀴즈 저장소에 있나 ────────────────────────────
 * 금시세 화면은 머니위키(jjyu.co.kr)에 붙는데, 거기는 페이지가 2,138개다.
 * 시세가 바뀔 때마다 그 2,138개를 재빌드할 수 없다(빌드 한도).
 * 그리고 지금 그 저장소는 글 리라이트 작업이 돌고 있어서 커밋이 겹치면 push가 튕긴다.
 *
 * 그래서 데이터만 이쪽에 둔다:
 *   퀴즈 저장소가 price.json 을 들고 있고 → quiz.jjyu.co.kr/price.json 으로 서빙
 *   → 머니위키 금시세 페이지가 브라우저에서 그걸 읽어 화면을 채운다
 * 머니위키는 재빌드가 필요 없고, 저장소가 달라 충돌이 원천적으로 불가능하다.
 *
 * ⚠️ 다른 출처(jjyu.co.kr)에서 읽으므로 public/_headers 에 CORS 허용이 반드시 필요하다.
 *
 * ── 소스 4개 (2026-08-15 실측) ────────────────────────────────
 *  A 종로금거래소  금은방 소매가(내가 팔 때/살 때, 원/돈). 사람들이 검색하는 그 숫자.
 *  B 공공데이터포털 KRX 금시장 도매 종가(원/그램) + 과거치 → 추이 그래프용.
 *  C 야후 파이낸스  국제 금·은 선물(달러/온스). 분 단위.
 *  D 야후 파이낸스  원/달러 환율.
 *
 * 한쪽이 죽어도 나머지로 파일을 채운다. 전부 실패하면 기존 파일을 그대로 둔다
 * (빈 값으로 덮어써서 화면에 0원이 뜨는 게 시세 사이트에서 가장 치명적인 사고다).
 */
import fs from 'fs';
import path from 'path';

const OUT = path.join(process.cwd(), 'public', 'price.json');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const OZ_TO_G = 31.1034768; // 트로이온스 → 그램
const DON_TO_G = 3.75; // 1돈 = 3.75g

const kstStamp = () =>
  new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00');
const round = (n, d = 0) => (Number.isFinite(n) ? Number(n.toFixed(d)) : null);
const num = (s) => {
  const n = Number(String(s).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ────────────────────────────────────────────────────────────
// A. 종로금거래소 — 금은방 소매가 (원/돈)
// ────────────────────────────────────────────────────────────
/**
 * 화면 표기를 그대로 옮긴다. 임의로 부가세를 더하거나 빼지 않는다.
 *   내가팔때 = 사용자가 금을 팔고 받는 돈(업체 매입가)
 *   내가살때 = 사용자가 금을 사며 내는 돈 — 원문에 "(VAT별도)" 라고 붙어 있다
 * 이 단서를 note 로 같이 내려보내서 화면에도 반드시 함께 표기하게 한다.
 *
 * HTML 구조(2026-08-15 실측):
 *   <h2>오늘의 금시세 <span>2026. 08. 15</span></h2>
 *   <td>순금시세</td>
 *   <td><span class="point up">4,000</span><span class="price">731,000원</span></td>
 *   <td><span class="point up">7,000</span><span class="price">795,000원</span></td>
 * class 가 up/down/none 이라 등락 방향을 추측 없이 그대로 읽을 수 있다.
 */
const RETAIL_MAP = [
  { match: '순금', key: 'gold24', name: '순금 24K' },
  { match: '18K', key: 'gold18', name: '18K' },
  { match: '14K', key: 'gold14', name: '14K' },
  { match: '백금', key: 'platinum', name: '백금' },
  { match: '은시세', key: 'silver', name: '은' },
];

/** 한 칸(<td>)에서 { price, change, dir } 를 뽑는다. */
function parseCell(td) {
  const dirRaw = td.match(/class="point\s+(up|down|none)"/)?.[1] ?? 'none';
  const change = num(td.match(/class="point[^"]*"[^>]*>([^<]*)</)?.[1]);
  const price = num(td.match(/class="price"[^>]*>([^<]*)</)?.[1]);
  if (!price) return null; // 0원 = 그 업체가 취급 안 하는 항목. 화면에 0을 띄우면 안 되므로 버린다.
  return {
    price,
    change: dirRaw === 'down' ? -(change ?? 0) : change ?? 0,
    dir: dirRaw, // 'up' | 'down' | 'none' — 화면에서 상승 빨강▲ / 하락 파랑▼ 로 쓴다
  };
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function retail() {
  // https 가 막히는 망이 있어 http 로도 한 번 더 시도한다(같은 사이트, 같은 내용).
  let html = null;
  for (const u of ['https://www.jongrogx.com/', 'http://www.jongrogx.com/']) {
    try {
      html = await fetchHtml(u);
      break;
    } catch {
      /* 다음 후보로 */
    }
  }
  if (!html) throw new Error('종로금거래소 접속 실패');

  const quoteDate =
    html
      .match(/오늘의 금시세\s*<span>\s*([\d.\s]+)<\/span>/)?.[1]
      ?.replace(/\s/g, '')
      .replace(/\.$/, '')
      .replace(/\./g, '-') ?? null;

  const items = [];
  for (const [, row] of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
    if (tds.length < 3) continue;
    const label = tds[0].replace(/<[^>]*>/g, '').trim();
    const def = RETAIL_MAP.find((m) => label.includes(m.match));
    if (!def) continue;
    const userSell = parseCell(tds[1]); // 내가 팔 때
    const userBuy = parseCell(tds[2]); // 내가 살 때 (VAT별도)
    if (!userSell && !userBuy) continue;
    items.push({ key: def.key, name: def.name, userSell, userBuy });
  }
  if (items.length === 0) throw new Error('종로금거래소 표를 읽지 못함');

  return {
    source: '종로금거래소',
    sourceUrl: 'https://www.jongrogx.com/',
    quoteDate, // 업체가 고시한 날짜 (예: 2026-08-15)
    unit: '원/돈',
    note: '내가 살 때 가격은 원문에 부가세 별도로 표기되어 있습니다.',
    items,
  };
}

// ────────────────────────────────────────────────────────────
// B. 공공데이터포털 — KRX 금시장 도매 종가 (원/그램)
// ────────────────────────────────────────────────────────────
/**
 * 키는 코드에 절대 넣지 않는다. GitHub 저장소 Secrets → 워크플로 env 로 주입한다.
 *
 * 실측으로 확인한 성질(2026-08-15):
 *  - 하루 1회 갱신, 전 영업일 기준. 오늘 시점 최신이 이틀 전일 수 있다.
 *    → 그래서 이 값은 "오늘 금값" 자리에 쓰지 않는다. 추이 그래프와 도매가 참고용이다.
 *  - endBasDt 는 미포함(exclusive)이다. 8/13 까지 받으려면 8/14 를 넣어야 한다.
 *  - 종목 04020000 = 금 99.99_1kg (기준 종목), 04020100 = 미니금 100g
 *  - 일일 트래픽 10,000회. 우리는 하루 수십 회라 여유가 크다.
 */
const KRX_ENDPOINT =
  'https://apis.data.go.kr/1160100/service/GetGeneralProductInfoService/getGoldPriceInfo';
const KRX_MAIN_CODE = '04020000';
/** 추이 그래프용으로 받아올 기간(일). 영업일만 오므로 실제 건수는 이보다 적다. */
const KRX_DAYS = 180;

const ymd = (d) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;

async function krx() {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error('DATA_GO_KR_KEY 미설정');

  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const from = new Date(now.getTime() - KRX_DAYS * 86400 * 1000);
  const to = new Date(now.getTime() + 86400 * 1000); // endBasDt 는 미포함이라 하루 더 준다

  const url =
    `${KRX_ENDPOINT}?serviceKey=${key}&resultType=json&numOfRows=400&pageNo=1` +
    `&likeSrtnCd=${KRX_MAIN_CODE}&beginBasDt=${ymd(from)}&endBasDt=${ymd(to)}`;

  const res = await fetch(url, {
    headers: { 'user-agent': UA },
    signal: AbortSignal.timeout(25000),
  });
  const json = await res.json();
  if (json?.response?.header?.resultCode !== '00') {
    throw new Error(
      json?.response?.header?.resultMsg ||
        json?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg ||
        '알 수 없는 오류',
    );
  }
  const raw = json.response.body?.items?.item;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : [])
    .map((x) => ({
      date: `${x.basDt.slice(0, 4)}-${x.basDt.slice(4, 6)}-${x.basDt.slice(6, 8)}`,
      krwPerGram: num(x.clpr),
      krwPerDon: round(num(x.clpr) * DON_TO_G),
      change: num(x.vs),
      changePct: num(x.fltRt),
    }))
    .filter((x) => x.krwPerGram)
    .sort((a, b) => (a.date < b.date ? -1 : 1)); // 과거 → 최신

  if (list.length === 0) throw new Error('KRX 응답에 데이터 없음');

  return {
    source: '한국거래소 KRX 금시장 (공공데이터포털)',
    sourceUrl: 'https://www.data.go.kr/data/15094805/openapi.do',
    item: '금 99.99_1kg',
    unit: '원/그램',
    note: '하루 1회 갱신되는 전 영업일 종가입니다. 실시간 시세가 아닙니다.',
    latest: list[list.length - 1],
    history: list, // [{date, krwPerGram, krwPerDon, change, changePct}] 과거→최신
  };
}

// ────────────────────────────────────────────────────────────
// C·D. 야후 파이낸스 — 국제 시세 / 환율
// ────────────────────────────────────────────────────────────
async function yahoo(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`,
    { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const m = (await res.json())?.chart?.result?.[0]?.meta;
  if (!m?.regularMarketPrice) throw new Error('야후 응답에 값 없음');
  const prev = m.previousClose ?? m.chartPreviousClose ?? m.regularMarketPrice;
  return {
    price: m.regularMarketPrice,
    change: m.regularMarketPrice - prev,
    changePct: prev ? ((m.regularMarketPrice - prev) / prev) * 100 : 0,
  };
}

const dirOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'none');

// ────────────────────────────────────────────────────────────
export async function buildPrice() {
  const sources = []; // 어느 소스가 실제로 쓰였는지 남긴다 — 나중에 원인 추적용
  const out = { updatedAt: kstStamp(), sources };

  // 4개를 동시에 친다. 하나가 느려도 전체가 그만큼 늦어지지 않는다.
  const [rRetail, rKrx, rGold, rSilver, rFx] = await Promise.allSettled([
    retail(),
    krx(),
    yahoo('GC=F'),
    yahoo('SI=F'),
    yahoo('KRW=X'),
  ]);

  if (rRetail.status === 'fulfilled') {
    out.retail = rRetail.value;
    sources.push('retail:jongrogx');
  } else sources.push(`retail:FAIL(${rRetail.reason?.message})`);

  if (rKrx.status === 'fulfilled') {
    out.krx = rKrx.value;
    sources.push('krx:data.go.kr');
  } else sources.push(`krx:FAIL(${rKrx.reason?.message})`);

  const usdkrw = rFx.status === 'fulfilled' ? rFx.value.price : null;
  if (usdkrw) {
    out.fx = {
      usdkrw: round(rFx.value.price, 2),
      change: round(rFx.value.change, 2),
      changePct: round(rFx.value.changePct, 2),
      dir: dirOf(rFx.value.change),
      source: 'Yahoo Finance',
    };
    sources.push('fx:yahoo');
  } else sources.push('fx:FAIL');

  const intl = (r, name) => {
    if (r.status !== 'fulfilled') return null;
    const perGram = usdkrw ? (r.value.price / OZ_TO_G) * usdkrw : null;
    return {
      name,
      usdPerOz: round(r.value.price, 2),
      changePct: round(r.value.changePct, 2),
      dir: dirOf(r.value.change),
      // 환율로 환산한 참고값. 국내 소매가와는 세공비·마진·부가세만큼 차이가 난다.
      krwPerGram: round(perGram),
      krwPerDon: perGram ? round(perGram * DON_TO_G) : null,
      source: 'Yahoo Finance (COMEX 선물)',
    };
  };
  out.intl = {};
  const g = intl(rGold, '금');
  const s = intl(rSilver, '은');
  if (g) {
    out.intl.gold = g;
    sources.push('intl.gold:yahoo');
  } else sources.push('intl.gold:FAIL');
  if (s) {
    out.intl.silver = s;
    sources.push('intl.silver:yahoo');
  } else sources.push('intl.silver:FAIL');

  return out;
}

/**
 * 파일에 쓴다. 값이 하나도 안 잡혔으면 기존 파일을 건드리지 않는다.
 * 값이 그대로면 쓰지 않는다 — 의미 없는 커밋(=의미 없는 배포)을 만들지 않기 위해.
 */
export async function updatePriceFile() {
  let prev = null;
  try {
    prev = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
  } catch {
    /* 첫 실행 */
  }

  // ── 최소 간격 제동 ─────────────────────────────────────────
  // 국제 시세는 초 단위로 흔들려서, 놔두면 실행할 때마다 파일이 바뀌고
  // 그때마다 커밋 → Cloudflare 재배포가 일어난다. 무료 플랜 빌드 한도가 월 500회라
  // 이걸 막지 않으면 시세 하나 때문에 배포 예산을 다 쓴다.
  //
  // 그래서 마지막 갱신 이후 이 시간이 안 지났으면 조회조차 하지 않는다.
  // cron 은 촘촘히 걸어두고(예약이 자주 불발되므로) 실제 쓰기는 여기서 조인다.
  const MIN_INTERVAL_MINUTES = Number(process.env.MIN_INTERVAL_MINUTES ?? 60);
  if (prev?.updatedAt && MIN_INTERVAL_MINUTES > 0) {
    const elapsed = (Date.now() - Date.parse(prev.updatedAt)) / 60000;
    if (elapsed < MIN_INTERVAL_MINUTES) {
      console.log(
        `[시세] ${Math.round(elapsed)}분 전 갱신됨 — 최소 간격 ${MIN_INTERVAL_MINUTES}분 미달, 건너뜀`,
      );
      return false;
    }
  }

  let data;
  try {
    data = await buildPrice();
  } catch (e) {
    console.error('[시세] 수집 실패:', e.message);
    return false;
  }
  if (!data.retail && !data.krx && !data.intl?.gold) {
    console.error('[시세] 소스 전부 실패 — 기존 파일 유지');
    return false;
  }

  // updatedAt(매번 바뀜)과 sources 를 뺀 나머지가 같으면 실질 변동이 없는 것이다.
  const strip = (o) => {
    if (!o) return '';
    const { updatedAt, sources, ...rest } = o;
    return JSON.stringify(rest);
  };
  if (prev && strip(prev) === strip(data)) {
    console.log('[시세] 변동 없음 — 파일 유지');
    return false;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));

  const g24 = data.retail?.items?.find((i) => i.key === 'gold24');
  console.log(
    `[시세] 갱신 · 순금 살때 ${g24?.userBuy?.price?.toLocaleString() ?? '-'}원/돈 · ` +
      `팔때 ${g24?.userSell?.price?.toLocaleString() ?? '-'}원/돈 · ` +
      `KRX ${data.krx?.latest?.krwPerDon?.toLocaleString() ?? '-'}원/돈 · ` +
      `달러 ${data.fx?.usdkrw ?? '-'}원`,
  );
  console.log(`[시세] 소스: ${data.sources.join(', ')}`);
  return true;
}

// 단독 실행: node scripts/price.mjs
if (process.argv[1] && process.argv[1].endsWith('price.mjs')) {
  updatePriceFile();
}
