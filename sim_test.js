// バランス検証ハーネス: app.jsをDOMスタブ付きで読み込み、戦略別にN回プレイしてランク分布を出す。
// 使い方: node sim_test.js [試行回数]
const fs = require("fs");
const path = require("path");

const N = Number(process.argv[2]) || 3000;
const code = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

// --- 万能DOMスタブ ---
function makeStub() {
  const f = function () {
    return [];
  };
  return new Proxy(f, {
    get(target, key) {
      if (key === Symbol.toPrimitive) return () => "";
      if (key === "style") return { setProperty() {} };
      if (key === "classList") return { toggle() {}, add() {}, remove() {} };
      if (key === "querySelectorAll") return () => [];
      if (key === "addEventListener") return () => {};
      if (key === "showModal" || key === "close") return () => {};
      if (key === "value") return "";
      if (!(key in target)) target[key] = makeStub();
      return target[key];
    },
    set() {
      return true;
    },
    apply() {
      return makeStub();
    },
  });
}

const documentStub = {
  querySelector: () => makeStub(),
  createElement: () => makeStub(),
  body: makeStub(),
};
const localStorageStub = { getItem: () => null, setItem() {}, removeItem() {} };
const windowStub = { open() {}, location: {} };
const navigatorStub = {};

const expose = `
;globalThis.__game = {
  get state() { return state; },
  cards, cardPool, runWeek, resetGame, getRank, getDiagnosis, drawHand, selectCard, getChainR, getPhase,
};
`;

const boot = new Function("document", "localStorage", "window", "navigator", code + expose);
boot(documentStub, localStorageStub, windowStub, navigatorStub);
const G = globalThis.__game;

// --- 戦略定義 ---
// 賢い戦略は state を見て優先リストを組む（関数）。単純な戦略は固定の優先リスト。
function smartOrder(s, phase, useChain) {
  const order = [];
  if (phase === "seed") {
    if (s.resources.money > 18) order.push("drink");
    order.push("comment", "oneonone", "spotlight", "react", "preConsult");
    if (s.stats.concept < 35) order.push("catchcopy", "aiOneTen");
    order.push("seedpost", "twentyGo", "interest", "aiConcept", "catchcopy", "aiOneTen");
    // 回避: 種まき期の告知・重い制作・罠
    order.push("prepare", "xday", "lpDraft", "aiAllIn", "announce", "lastCall");
  } else if (phase === "bond") {
    if (s.stats.wom < 45) order.push("wom");
    order.push("monitor", "crewTalk");
    if (useChain) order.push("nextHero");
    if (s.stats.trust < 45) order.push("comment");
    order.push("roles", "ifRole", "comment", "rewardMenu", "openConsult");
    if (s.stats.trust > 55) order.push("interest");
    order.push("interest", "aiOneTen", "aiRoles", "lpImprove", "prepare", "xday", "aiAllIn", "announce", "lastCall");
  } else {
    if (s.stats.prep < 55) order.push("prepare");
    if (s.stats.trust < 30) order.push("thanksBoost", "report");
    if (useChain) order.push("proxyYurubo", "nextHero");
    if (s.stats.wom >= 25 && s.people.crew + s.people.core > 0) order.push("referral");
    if (s.stats.trust >= 30) order.push("announce");
    order.push("thanksBoost", "report", "referral", "wom", "prepare", "live", "aiImprove", "xday");
    if (s.week >= 11 && s.stats.trust >= 45) order.push("lastCall");
    order.push("aiAllIn", "announce", "lastCall");
  }
  return order;
}

const strategies = {
  熟練: (s, phase) => smartOrder(s, phase, false),
  連鎖熟練: (s, phase) => smartOrder(s, phase, true),
  そこそこ_準備なし: {
    seed: ["comment", "react", "spotlight", "oneonone", "catchcopy", "seedpost"],
    bond: ["wom", "monitor", "crewTalk", "roles", "interest", "comment"],
    launch: ["referral", "announce", "thanksBoost", "lastCall", "live", "report"],
  },
  弱め_作り込み型: {
    seed: ["catchcopy", "lpDraft", "aiConcept", "seedpost", "twentyGo", "react"],
    bond: ["lpImprove", "aiRoles", "interest", "openConsult", "roles", "comment"],
    launch: ["announce", "aiImprove", "live", "lastCall", "prepare", "report"],
  },
  浪費家: {
    seed: ["lpDraft", "drink", "aiConcept", "announce", "catchcopy", "react"],
    bond: ["lpImprove", "drink", "openConsult", "aiRoles", "announce", "interest"],
    launch: ["lastCall", "announce", "live", "aiImprove", "prepare", "report"],
  },
  告知連打: {
    seed: ["announce", "seedpost", "interest", "catchcopy", "react", "comment"],
    bond: ["announce", "interest", "lpImprove", "openConsult", "comment", "roles"],
    launch: ["announce", "lastCall", "live", "referral", "report", "thanksBoost"],
  },
  AI全任せ罠: (s, phase) => ["aiAllIn"].concat(smartOrder(s, phase, false)),
};

function playOnce(prio) {
  G.resetGame();
  let guard = 0;
  while (!G.state.ended && guard < 40) {
    guard += 1;
    const phase = G.getPhase(G.state.week);
    const order = typeof prio === "function" ? prio(G.state, phase) : prio[phase] || [];
    const hand = G.state.hand.slice();
    const ranked = hand
      .slice()
      .sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    for (const id of ranked) {
      if (G.state.selected.length >= 3) break;
      if (!G.state.selected.includes(id)) G.selectCard(id);
    }
    if (G.state.selected.length !== 3) break; // 詰み（起きないはず）
    G.runWeek();
  }
  const [rank] = G.getRank();
  return {
    rank: rank.replace("ランク", ""),
    att: G.state.people.attendees,
    chain: G.state.stats.chain,
    R: G.getChainR(G.state),
    sat: G.state.stats.prep,
    trustDead: G.state.stats.trust < 18,
  };
}

for (const [name, prio] of Object.entries(strategies)) {
  const dist = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  let attSum = 0;
  let rSum = 0;
  let trustDead = 0;
  const atts = [];
  for (let i = 0; i < N; i++) {
    const r = playOnce(prio);
    dist[r.rank] = (dist[r.rank] || 0) + 1;
    attSum += r.att;
    rSum += r.R;
    if (r.trustDead) trustDead += 1;
    atts.push(r.att);
  }
  atts.sort((a, b) => a - b);
  const pct = (k) => `${((dist[k] / N) * 100).toFixed(1)}%`;
  console.log(
    `${name.padEnd(12)} S:${pct("S")} A:${pct("A")} B:${pct("B")} C:${pct("C")} D:${pct("D")} | 参加者 中央値:${atts[Math.floor(N / 2)]} 平均:${(attSum / N).toFixed(1)} | R平均:${(rSum / N).toFixed(2)} | 信頼死:${((trustDead / N) * 100).toFixed(1)}%`,
  );
}
