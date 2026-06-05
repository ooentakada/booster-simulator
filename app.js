const initialState = {
  week: 1,
  selected: [],
  stats: {
    relation: 0,
    concept: 0,
    roles: 0,
    commitment: 0,
    ai: 0,
    reach: 0,
    trust: 50,
  },
  people: {
    interested: 0,
    attendees: 0,
    supporters: 0,
    crew: 0,
    core: 0,
  },
  multipliers: {
    nextPost: 0,
    nextLaunch: 0,
  },
  resources: {
    timeMax: 10,
    money: 30,
  },
  log: [
    "BOOSTER酒場に企画の地図を広げた。まだ仲間は少ない。ここから12週間で、みんなで30人集められる状態を作ろう。",
  ],
  currentWeekLog: [
    "BOOSTER酒場に企画の地図を広げた。まだ仲間は少ない。ここから12週間で、みんなで30人集められる状態を作ろう。",
  ],
  learning:
    "募集前から応援は始まっています。まずは誰かの挑戦にリアクションして、酒場に会話を増やしましょう。",
  lastLearning: "",
  ended: false,
};

const pillarMeta = [
  ["relation", "関係性の影響力", "#4f8d5d"],
  ["concept", "企画の魅力", "#d95043"],
  ["ai", "AI仕掛け力", "#2f9aa0"],
  ["trust", "信頼残高", "#7b5fc6"],
];

const cards = [
  {
    id: "react",
    title: "リアクションする",
    icon: "!",
    phase: "seed",
    text: "人の挑戦に反応して、募集前の接点を増やす。",
    apply: (s) => {
      addStat(s, "relation", 10);
      addStat(s, "reach", 1);
      addStat(s, "trust", 6);
      s.people.supporters += roll(1, 3);
      s.multipliers.nextPost += 2;
      addLog(s, "人の投稿にリアクションした。小さな接点が、次の募集への反応を少し温めた。");
    },
  },
  {
    id: "spotlight",
    title: "スポットライトを当てる",
    icon: "光",
    phase: "seed",
    text: "自分の宣伝より、相手や仲間の価値に光を当てる。",
    apply: (s) => {
      addStat(s, "relation", 8);
      addStat(s, "reach", 3);
      addStat(s, "trust", 6);
      s.people.supporters += roll(2, 6);
      s.multipliers.nextPost += 2;
      addLog(s, "相手や仲間にスポットライトを当てた。自分をすごく見せるより、誰かを輝かせる人に応援は集まり始める。");
    },
  },
  {
    id: "comment",
    title: "応援コメントする",
    icon: "＋",
    phase: "seed",
    text: "いいねで終わらせず、相手の挑戦に言葉を届ける。",
    apply: (s) => {
      addStat(s, "relation", 12);
      addStat(s, "reach", 2);
      addStat(s, "trust", 8);
      s.people.supporters += roll(2, 5);
      addLog(s, "応援コメントを届けた。酒場に『この人は応援してくれる人だ』という空気が生まれた。");
    },
  },
  {
    id: "preConsult",
    title: "事前相談する",
    icon: "談",
    phase: "seed",
    text: "完成前に軽く相談して、未来の仲間に種をまく。",
    apply: (s) => {
      addStat(s, "relation", 6);
      addStat(s, "concept", 6);
      addStat(s, "trust", 5);
      s.people.interested += roll(2, 7);
      s.multipliers.nextPost += 2;
      addLog(s, "事前相談をした。未完成な計画が、相手にとって『自分も関われるかも』という入り口になった。");
    },
  },
  {
    id: "twentyGo",
    title: "20%でGO",
    icon: "%",
    phase: "seed",
    text: "未完成のまま出して、伸び代を関わりしろに変える。",
    apply: (s) => {
      addStat(s, "concept", 4);
      addStat(s, "roles", 5);
      s.people.interested += roll(1, 6);
      addLog(s, "20%の完成度で出してみた。完璧ではないからこそ、周りが関われる余白が生まれた。");
    },
  },
  {
    id: "catchcopy",
    title: "キャッチコピーを磨く",
    icon: "言",
    phase: "seed",
    text: "誰に何が届く企画なのか、一言で伝わる言葉にする。",
    apply: (s) => {
      addStat(s, "concept", 10);
      addStat(s, "ai", 2);
      s.multipliers.nextPost += 3;
      addLog(s, s.stats.relation < 18
        ? "キャッチコピーを磨いた。言葉は強くなったが、まだ届ける相手との接点が少ない。"
        : "キャッチコピーを磨いた。企画の魅力が一言で伝わりやすくなった。");
    },
  },
  {
    id: "lpDraft",
    title: "LPを作る",
    icon: "LP",
    phase: "seed",
    text: "イベントの魅力、背景、参加導線を1ページにまとめる。",
    apply: (s) => {
      addStat(s, "concept", 12);
      addStat(s, "ai", 4);
      addStat(s, "trust", -4);
      s.multipliers.nextLaunch += 5;
      addLog(s, "LPを作った。企画は伝わりやすくなったが、作業にこもった分、酒場の会話は少し静かになった。");
    },
  },
  {
    id: "oneonone",
    title: "1対1で壁打ち",
    icon: "◇",
    phase: "seed",
    text: "気になる人に相談して、企画を一緒に磨く。",
    apply: (s) => {
      addStat(s, "concept", 8);
      addStat(s, "relation", 5);
      addStat(s, "commitment", 4);
      addStat(s, "trust", 4);
      if (s.people.interested > 4 && chance((s.stats.roles + s.stats.relation) / 180)) {
        s.people.crew += 1;
        addStat(s, "commitment", 5);
        addLog(s, "壁打ち相手が『それ、一緒に作りたい』と言ってくれた。企画へのYESが仲間化に近づいた。");
      } else {
        addLog(s, "1対1で壁打ちした。言葉が磨かれ、相手との距離も近くなった。");
      }
    },
  },
  {
    id: "seedpost",
    title: "企画の種を投稿",
    icon: "□",
    phase: "seed",
    text: "完成前の企画を出して、反応を見にいく。",
    apply: (s) => {
      const gain = Math.max(0, Math.round((s.stats.concept + s.stats.relation) / 18) + roll(0, 4) + s.multipliers.nextPost);
      s.people.interested += gain;
      s.people.supporters += Math.max(0, Math.floor(gain / 2));
      s.multipliers.nextPost = 0;
      addLog(s, gain > 3
        ? `企画の種を投稿した。${gain}人が『気になる』と反応した。`
        : "企画の種を投稿したが、反応は薄かった。先に関係性の土台と企画の言葉を温めたい。");
    },
  },
  {
    id: "aiConcept",
    title: "AIで企画整理",
    icon: "A",
    phase: "seed",
    text: "対象者、価値、言葉を整理して企画を磨く。",
    apply: (s) => {
      addStat(s, "ai", 8);
      addStat(s, "concept", 5);
      s.multipliers.nextPost += 2;
      addLog(s, "AIで企画を整理した。ワクワクは残したまま、伝わる言葉が少し増えた。");
    },
  },
  {
    id: "lpImprove",
    title: "LPを改善",
    icon: "改",
    phase: "bond",
    text: "反応を見て、見出し、導線、参加理由を磨き直す。",
    apply: (s) => {
      addStat(s, "concept", 8);
      addStat(s, "ai", 4);
      addStat(s, "trust", -2);
      s.multipliers.nextLaunch += 5;
      addLog(s, s.people.interested > 8
        ? "LPを改善した。相談で出た言葉を反映したことで、参加導線がわかりやすくなった。"
        : "LPを改善した。ページは整ったが、まだ人の声を拾えていないので温度は乗り切っていない。");
    },
  },
  {
    id: "interest",
    title: "興味ある人いますか？",
    icon: "?",
    phase: "bond",
    text: "企画への1つ目のYESを取りにいく。",
    apply: (s) => {
      const base = (s.stats.relation * 0.12) + (s.stats.concept * 0.13) + s.multipliers.nextPost;
      const gain = Math.max(0, Math.round(base + roll(-2, 5)));
      addStat(s, "trust", -3);
      s.people.interested += gain;
      s.people.supporters += Math.floor(gain * 0.7);
      s.multipliers.nextPost = 0;
      addLog(s, gain >= 8
        ? `募集の前段階として興味を聞いた。${gain}人が手を挙げ、酒場がざわつき始めた。`
        : "興味を聞いたが、まだ反応は少ない。投稿だけではなく、普段のリアクションと壁打ちが必要そうだ。");
    },
  },
  {
    id: "openConsult",
    title: "公開相談会を開く",
    icon: "◎",
    phase: "bond",
    text: "Zoomやライブで相談しながら、企画を公開で育てる。",
    apply: (s) => {
      const gain = Math.max(2, Math.round((s.stats.relation + s.stats.concept + s.stats.reach) / 16) + roll(0, 8));
      s.people.interested += gain;
      s.people.supporters += roll(3, 10);
      addStat(s, "concept", 5);
      addStat(s, "reach", 3);
      addStat(s, "trust", 2);
      addLog(s, `公開相談会を開いた。${gain}人が企画の背景を知り、応援の輪に近づいた。`);
    },
  },
  {
    id: "roles",
    title: "関わり方を提示",
    icon: "≡",
    phase: "bond",
    text: "受付、シェア、紹介、進行などの役割を見える化する。",
    apply: (s) => {
      addStat(s, "roles", 12);
      addStat(s, "trust", 1);
      const supporterGain = s.people.interested > 6 ? roll(2, 6) : roll(0, 2);
      const crewGain = s.people.interested > 10 && s.stats.relation > 42 && chance(0.2) ? 1 : 0;
      s.people.supporters += supporterGain;
      s.people.crew += crewGain;
      addLog(s, crewGain
        ? `関わり方を提示した。${crewGain}人が運営に近づき、${supporterGain}人が応援しやすくなった。`
        : `関わり方を提示した。${supporterGain}人が『それなら応援できる』と動きやすくなった。`);
    },
  },
  {
    id: "ifRole",
    title: "もしもロール",
    icon: "if",
    phase: "bond",
    text: "もし関わるなら何が楽しいか、相手に選んでもらう。",
    apply: (s) => {
      addStat(s, "roles", 8);
      addStat(s, "commitment", 6);
      addStat(s, "trust", 2);
      const supporterGain = s.people.interested > 5 ? roll(1, 4) : 0;
      const crewGain = s.stats.relation > 45 && s.stats.concept > 35 && chance(0.28) ? 1 : 0;
      s.people.supporters += supporterGain;
      s.people.crew += crewGain;
      addLog(s, supporterGain || crewGain
        ? `もしもロールで関わり方を聞いた。${supporterGain}人が応援しやすくなり、${crewGain}人が運営候補に近づいた。`
        : "もしもロールで関わり方を聞いた。手伝うかどうかではなく、どう関わると楽しいかの会話が始まった。");
    },
  },
  {
    id: "rewardMenu",
    title: "役割と報酬メニュー",
    icon: "品",
    phase: "bond",
    text: "表・裏・裏の裏まで、関わる価値をセットで見せる。",
    apply: (s) => {
      addStat(s, "roles", 10);
      addStat(s, "commitment", 4);
      s.people.supporters += s.people.interested > 8 ? roll(2, 6) : roll(0, 2);
      if (s.people.interested > 12 && s.stats.relation > 42 && chance(0.22)) s.people.crew += 1;
      addLog(s, "役割と報酬のメニューを作った。参加、運営、紹介、裏方まで、それぞれの人が選べる入口が増えた。");
    },
  },
  {
    id: "crewTalk",
    title: "運営候補と話す",
    icon: "◆",
    phase: "bond",
    text: "興味ある人と話し、企画へのYESを関わり方へのYESに変える。",
    apply: (s) => {
      addStat(s, "commitment", 10);
      addStat(s, "trust", 4);
      const score = s.stats.relation + s.stats.concept + s.stats.roles + s.people.interested;
      const crewGain = score > 115 ? roll(1, 2) : chance(score / 180) ? 1 : 0;
      const coreChance =
        s.stats.commitment * 0.006 +
        s.stats.relation * 0.002 +
        s.stats.roles * 0.003 +
        s.people.crew * 0.08;
      const coreGain =
        s.stats.commitment > 38 && s.stats.roles > 32 && s.people.interested > 8 && chance(coreChance) ? 1 : 0;
      s.people.crew += crewGain;
      s.people.core += coreGain;
      addLog(s, crewGain || coreGain
        ? `運営候補と話した。${crewGain}人が運営に、${coreGain}人がコアメンバーになった。`
        : "運営候補と話した。興味はあるが、まだ自分ごとになるにはもう一歩。");
    },
  },
  {
    id: "xday",
    title: "X-Dayを宣言",
    icon: "日",
    phase: "launch",
    text: "開催日を物語の締切にして、応援の焦点を作る。",
    apply: (s) => {
      addStat(s, "commitment", 10);
      addStat(s, "reach", 5);
      addStat(s, "trust", -4);
      s.multipliers.nextLaunch += 5;
      addLog(s, "X-Dayを宣言した。イベント当日が、ただの日付ではなく、みんなで見届けたい物語の山場になった。");
    },
  },
  {
    id: "report",
    title: "ほうれんそう投稿",
    icon: "報",
    phase: "launch",
    text: "進捗、壁、感謝を共有して、船の現在地を見せる。",
    apply: (s) => {
      addStat(s, "commitment", 8);
      addStat(s, "relation", 4);
      addStat(s, "trust", 6);
      s.people.supporters += roll(3, 8);
      if (s.people.crew > 0 && chance(0.22 + s.people.crew * 0.05)) {
        s.people.core += 1;
        addLog(s, "ほうれんそう投稿をした。進捗と壁が見えたことで、運営メンバーの一人が本気で伴走し始めた。");
      } else {
        addLog(s, "ほうれんそう投稿をした。船が今どこにいるかを見せることで、応援者が見守りやすくなった。");
      }
    },
  },
  {
    id: "thanksBoost",
    title: "おかげさまブースト",
    icon: "祝",
    phase: "launch",
    text: "成果を自慢せず、貢献してくれた仲間に光を当てる。",
    apply: (s) => {
      addStat(s, "relation", 6);
      addStat(s, "commitment", 6);
      addStat(s, "reach", 4);
      addStat(s, "trust", 8);
      s.people.supporters += roll(2, 8);
      if (s.people.crew > 0 && chance(0.3)) s.people.core += 1;
      addLog(s, "おかげさまブーストで仲間の貢献に光を当てた。応援が『回収』ではなく、次の応援の燃料になった。");
    },
  },
  {
    id: "aiRoles",
    title: "AIで役割案",
    icon: "AI",
    phase: "bond",
    text: "必要な役割、依頼文、関わり方の選択肢を作る。",
    apply: (s) => {
      addStat(s, "ai", 6);
      addStat(s, "roles", 10);
      addLog(s, "AIで役割案を出した。『手伝って』ではなく『この関わり方ならできる』が見え始めた。");
    },
  },
  {
    id: "announce",
    title: "イベント告知",
    icon: "旗",
    phase: "launch",
    text: "正式にイベント参加者を募集する。",
    apply: (s) => {
      addStat(s, "trust", -10);
      if (s.week <= 4 && s.stats.relation < 24 && s.stats.concept < 24) {
        const gain = roll(0, 2);
        s.people.attendees += gain;
        s.multipliers.nextLaunch = 0;
        addLog(s, gain
          ? `いきなり告知した。${gain}人は申し込んだが、酒場の反応は薄い。先に関係性と企画の言葉を温めたい。`
          : "いきなり告知したが、ほとんど反応はなかった。募集前に応援し合う土台と、相談の種まきが必要そうだ。");
        return;
      }

      const base = (s.stats.concept * 0.11) + (s.stats.relation * 0.08) + (s.stats.reach * 0.06) + (s.people.supporters * 0.025) + s.multipliers.nextLaunch;
      const weakLaunchPenalty = s.stats.relation < 35 || s.stats.concept < 30 ? 0.58 : 1;
      const trustPenalty = s.stats.trust < 25 ? 0.45 : s.stats.trust < 45 ? 0.75 : 1;
      const rawGain = Math.max(0, Math.round((base * weakLaunchPenalty * trustPenalty) + roll(-2, 5)));
      const gain = s.people.crew + s.people.core === 0 ? Math.min(rawGain, 8) : rawGain;
      s.people.attendees += gain;
      s.multipliers.nextLaunch = 0;
      addLog(s, gain >= 8
        ? `イベント告知を出した。${gain}人が申し込んだ。企画と関係性が集客に変わり始めた。`
        : "イベント告知を出したが、参加者は少なかった。告知日より前の種まきが足りないようだ。");
    },
  },
  {
    id: "referral",
    title: "仲間に紹介依頼",
    icon: "→",
    phase: "launch",
    text: "一人で集めず、仲間と応援者の力を借りる。",
    apply: (s) => {
      const base = (s.stats.commitment * 0.1) + (s.stats.relation * 0.05) + (s.people.crew * 2.2) + (s.people.core * 4.2) + (s.people.supporters * 0.025);
      addStat(s, "trust", s.people.crew + s.people.core > 0 ? -4 : -8);
      const trustPenalty = s.stats.trust < 25 ? 0.55 : 1;
      const gain = Math.max(0, Math.round((base * trustPenalty) + roll(-1, 5)));
      s.people.attendees += gain;
      s.people.supporters += roll(0, 10);
      addStat(s, "reach", Math.min(8, Math.floor(gain / 2)));
      addLog(s, gain >= 8
        ? `仲間に紹介をお願いした。${gain}人の参加につながった。船は一人ではなく、みんなで押し出されている。`
        : "紹介をお願いしたが、大きくは動かなかった。仲間の本気度と役割の合意をもう少し育てたい。");
    },
  },
  {
    id: "live",
    title: "ライブ配信する",
    icon: "▶",
    phase: "launch",
    text: "背景や想いをリアルタイムで届ける。",
    apply: (s) => {
      const gain = Math.round((s.stats.concept + s.stats.reach) / 22) + roll(1, 7);
      addStat(s, "trust", -4);
      s.people.interested += gain;
      addStat(s, "reach", 6);
      if (s.stats.ai > 45) {
        s.multipliers.nextLaunch += 4;
        addLog(s, `ライブ配信をした。${gain}人が興味を持ち、AIで切り出した投稿が次の告知を押し上げそうだ。`);
      } else {
        addLog(s, `ライブ配信をした。${gain}人が興味を持った。想いが少し遠くまで届いた。`);
      }
    },
  },
  {
    id: "aiImprove",
    title: "AIで投稿改善",
    icon: "↗",
    phase: "launch",
    text: "反応を見て、言葉や訴求を改善する。",
    apply: (s) => {
      addStat(s, "ai", 5);
      addStat(s, "concept", 3);
      s.multipliers.nextLaunch += 5;
      addLog(s, "AIで反応を分析し、投稿を改善した。量産ではなく、PDCAの速度が上がった。");
    },
  },
  {
    id: "lastCall",
    title: "ラスト募集",
    icon: "!",
    phase: "launch",
    text: "イベント直前の最後の呼びかけ。",
    apply: (s) => {
      const team = s.people.crew * 2.4 + s.people.core * 4.8;
      const base = (s.stats.concept * 0.1) + (s.stats.reach * 0.08) + (s.stats.commitment * 0.08) + team * 0.8 + s.multipliers.nextLaunch;
      addStat(s, "trust", -12);
      const trustPenalty = s.stats.trust < 25 ? 0.45 : s.stats.trust < 45 ? 0.7 : 1;
      const gain = Math.max(0, Math.round((base * trustPenalty) + roll(-2, 7)));
      s.people.attendees += gain;
      s.multipliers.nextLaunch = 0;
      addLog(s, gain >= 10
        ? `ラスト募集が届いた。${gain}人が申し込んだ。ここまでの関係性と仲間の力が最後に効いた。`
        : "ラスト募集をしたが、伸びは小さかった。最後だけ頑張っても、船は急には進まない。");
    },
  },
];

// 各カードのコスト。time=毎週の持ち時間消費 / money=資金消費。
// 応援・相談・感謝などの「人間的な行動」は money:0（無料）。AI・LP・広告・会場はお金がかかる。
const cardCost = {
  react: { time: 2, money: 0 },
  comment: { time: 2, money: 0 },
  spotlight: { time: 2, money: 0 },
  preConsult: { time: 2, money: 0 },
  twentyGo: { time: 2, money: 0 },
  seedpost: { time: 2, money: 0 },
  oneonone: { time: 3, money: 0 },
  catchcopy: { time: 3, money: 0 },
  aiConcept: { time: 3, money: 3 },
  lpDraft: { time: 5, money: 8 },
  interest: { time: 2, money: 0 },
  openConsult: { time: 4, money: 4 },
  roles: { time: 3, money: 0 },
  ifRole: { time: 2, money: 0 },
  rewardMenu: { time: 3, money: 0 },
  crewTalk: { time: 3, money: 0 },
  aiRoles: { time: 3, money: 3 },
  lpImprove: { time: 4, money: 5 },
  xday: { time: 2, money: 0 },
  report: { time: 2, money: 0 },
  thanksBoost: { time: 2, money: 0 },
  announce: { time: 2, money: 5 },
  referral: { time: 2, money: 0 },
  live: { time: 4, money: 3 },
  aiImprove: { time: 3, money: 3 },
  lastCall: { time: 3, money: 6 },
};

const FEE_PER_HEAD = 1;

cards.forEach((card) => {
  const cost = cardCost[card.id] || { time: 3, money: 0 };
  card.time = cost.time;
  card.money = cost.money;
});

const phaseNames = {
  seed: "種まき",
  bond: "仲間化",
  launch: "集客",
};

const SAVE_KEY = "booster-sim-save-v2";
const INTRO_KEY = "booster-sim-intro-seen-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.week !== "number" || !parsed.stats || !parsed.people) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

let state = loadState() || structuredClone(initialState);

const els = {
  week: document.querySelector("#week"),
  attendees: document.querySelector("#attendees"),
  supporters: document.querySelector("#supporters"),
  crew: document.querySelector("#crew"),
  core: document.querySelector("#core"),
  statusList: document.querySelector("#statusList"),
  cards: document.querySelector("#cards"),
  selectedCount: document.querySelector("#selectedCount"),
  timeNow: document.querySelector("#timeNow"),
  timeMax: document.querySelector("#timeMax"),
  money: document.querySelector("#money"),
  runButton: document.querySelector("#runButton"),
  resetButton: document.querySelector("#resetButton"),
  phaseText: document.querySelector("#phaseText"),
  learning: document.querySelector("#learning"),
  log: document.querySelector("#log"),
  party: document.querySelector("#party"),
  ship: document.querySelector("#ship"),
  rankPreview: document.querySelector("#rankPreview"),
  dialog: document.querySelector("#resultDialog"),
  resultRank: document.querySelector("#resultRank"),
  resultType: document.querySelector("#resultType"),
  resultMessage: document.querySelector("#resultMessage"),
  resultAdvice: document.querySelector("#resultAdvice"),
  finalAttendees: document.querySelector("#finalAttendees"),
  finalSupporters: document.querySelector("#finalSupporters"),
  finalCrew: document.querySelector("#finalCrew"),
  finalCore: document.querySelector("#finalCore"),
  copyResult: document.querySelector("#copyResult"),
  copyStatus: document.querySelector("#copyStatus"),
  closeResult: document.querySelector("#closeResult"),
  introDialog: document.querySelector("#introDialog"),
  introStart: document.querySelector("#introStart"),
  helpButton: document.querySelector("#helpButton"),
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function roll(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(probability) {
  return Math.random() < clamp(probability, 0, 0.95);
}

function addStat(s, key, amount) {
  s.stats[key] = clamp(s.stats[key] + amount);
}

function addLog(s, message) {
  const line = `Week ${s.week}: ${message}`;
  s.log.push(line);
  s.currentWeekLog.push(line);
}

function getPhase(week = state.week) {
  if (week <= 4) return "seed";
  if (week <= 8) return "bond";
  return "launch";
}

function getAvailableCards() {
  const phase = getPhase();
  const cardOrder = {
    seed: ["react", "comment", "spotlight", "preConsult", "oneonone", "twentyGo", "seedpost", "catchcopy", "aiConcept", "lpDraft", "announce"],
    bond: ["interest", "openConsult", "roles", "ifRole", "rewardMenu", "crewTalk", "aiRoles", "lpImprove", "comment", "announce"],
    launch: ["xday", "report", "thanksBoost", "referral", "live", "aiImprove", "lastCall", "announce"],
  };
  return cardOrder[phase].map((id) => cards.find((card) => card.id === id));
}

function selectedCost() {
  let time = 0;
  let money = 0;
  state.selected.forEach((id) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    time += card.time || 0;
    money += card.money || 0;
  });
  return { time, money };
}

function selectCard(id) {
  if (state.ended) return;
  if (state.selected.includes(id)) {
    state.selected = state.selected.filter((cardId) => cardId !== id);
  } else if (state.selected.length < 3) {
    const card = cards.find((c) => c.id === id);
    const spent = selectedCost();
    if (spent.time + (card.time || 0) > state.resources.timeMax) return;
    if (spent.money + (card.money || 0) > state.resources.money) return;
    state.selected.push(id);
  }
  render();
}

function runWeek() {
  if (state.selected.length !== 3 || state.ended) return;

  const chosen = state.selected.map((id) => cards.find((card) => card.id === id));
  const moneyCost = chosen.reduce((sum, card) => sum + (card.money || 0), 0);
  const attBefore = state.people.attendees;
  state.currentWeekLog = [];
  chosen.forEach((card) => card.apply(state));
  applyPassiveEvents(state, chosen);
  normalizePeople(state);
  const income = Math.max(0, state.people.attendees - attBefore) * FEE_PER_HEAD;
  state.resources.money = clamp(state.resources.money - moneyCost + income, 0, 999);
  state.learning = getLearning(state, chosen);
  state.lastLearning = state.learning;
  state.selected = [];

  if (state.week >= 12) {
    state.ended = true;
    render();
    showResult();
    return;
  }

  state.week += 1;
  render();
}

function normalizePeople(s) {
  s.people.interested = clamp(s.people.interested, 0, 80);
  s.people.attendees = clamp(s.people.attendees, 0, 120);
  s.people.supporters = clamp(s.people.supporters, 0, 120);
  s.people.crew = clamp(s.people.crew, 0, 8);
  s.people.core = clamp(s.people.core, 0, 5);
}

function applyPassiveEvents(s, chosen) {
  const ids = chosen.map((card) => card.id);

  if (getPhase() === "seed" && ids.some((id) => ["announce", "lastCall"].includes(id)) && s.stats.relation < 35) {
    addLog(s, "告知したが、反応はほとんどなかった。まだ関係性の土台が足りないようだ。");
  }

  if (s.people.interested > 10 && s.stats.roles < 28 && chance(0.42)) {
    addLog(s, "いいねは集まったが、手を挙げる人はいなかった。関わり方が見えていない。");
  }

  if (s.stats.ai > 55 && s.stats.relation < 35 && chance(0.38)) {
    addLog(s, "投稿数は増えたが、反応は伸びなかった。先に人との接点を増やす必要がありそうだ。");
  }

  if (s.stats.concept > 62 && s.stats.roles < 36 && chance(0.34)) {
    addLog(s, "面白そうとは言われたが、誰が何をすればいいかが見えず、仲間化しなかった。");
  }

  if (s.stats.relation > 55 && s.people.supporters > 45 && chance(0.34)) {
    const gain = roll(2, 8);
    s.people.attendees += gain;
    addStat(s, "reach", 3);
    addLog(s, `応援者が友人に紹介してくれた。普段の応援が、${gain}人の参加につながった。`);
  }

  if (s.stats.roles > 52 && s.people.interested > 12 && chance(0.35)) {
    const gain = roll(2, 7);
    s.people.supporters += gain;
    addLog(s, `『それなら応援できる』という声が上がった。${gain}人が紹介やシェアをしやすくなった。`);
  }

  if (s.stats.relation > 55 && s.stats.concept > 50 && s.stats.roles > 48 && chance(0.28)) {
    s.people.crew += 1;
    addStat(s, "commitment", 5);
    addLog(s, "企画に共感した人が、運営メンバーとして関わってくれることになった。");
  }

  if (
    s.people.crew > s.people.core &&
    s.stats.commitment > 52 &&
    s.stats.roles > 42 &&
    s.stats.relation > 50 &&
    chance(0.26 + s.people.crew * 0.04)
  ) {
    s.people.core += 1;
    addStat(s, "reach", 4);
    addLog(s, "運営メンバーの一人が、自分ごとのコアメンバーに変わった。役割と想いが重なった瞬間だった。");
  }

  if (s.people.attendees >= 18 && s.people.crew + s.people.core === 0 && chance(0.45)) {
    addLog(s, "集客は進んだが、ほとんど一人で動いている。次回に向けて仲間づくりが必要だ。");
  }

  if (s.stats.trust < 18 && chance(0.5)) {
    addLog(s, "信頼残高が少なくなっている。お願いや告知を重ねる前に、応援、相談、感謝で酒場の温度を戻したい。");
  }
}

function getLearning(s, chosen) {
  const ids = chosen.map((card) => card.id);
  const candidates = [];
  if (s.stats.trust < 22) {
    candidates.push(
      "信頼残高が減ると、同じ告知でも届きにくくなります。お願いの前に、応援、相談、感謝で残高を戻しましょう。",
      "信頼は一気に増えません。小さなリアクションと進捗共有を重ねるほど、募集したときの反応が戻ってきます。",
    );
  }
  if (ids.includes("catchcopy") || ids.includes("lpDraft") || ids.includes("lpImprove")) {
    candidates.push(
      "LPやコピーは企画の魅力を磨きます。ただし、ページだけ作っても人は動きません。相談と関係性があるほど言葉が届きます。",
      "作り込む時間も大切です。でも酒場から離れすぎると温度が下がります。LPづくりと会話づくりを往復しましょう。",
    );
  }
  if (ids.includes("announce") && s.week <= 4 && s.stats.relation < 28) {
    candidates.push(
      "告知はスタートではなく、ここまでの関係性の結果です。先に応援コメントや壁打ちを増やすと、募集への反応が変わります。",
      "反応が薄い告知は失敗ではなくサインです。企画が弱いのか、関係性が薄いのか、関わり方が見えないのかを見直しましょう。",
    );
  }
  if (ids.includes("spotlight") || ids.includes("thanksBoost")) {
    candidates.push(
      "自分に光を当てるより、仲間や貢献者に光を当てる。スポットライトが外を向くほど、応援の空気が育ちます。",
      "応援される人は、自分だけを主役にしません。関わってくれた人が誇れる場面を増やすと、次の応援が生まれます。",
    );
  }
  if (ids.includes("preConsult") || ids.includes("twentyGo")) {
    candidates.push(
      "未完成は弱さではなく、関わりしろです。早めに相談すると、企画が『私たちごと』に変わり始めます。",
      "完成してから見せるより、途中で相談する。余白があるほど、相手は自分の意見を乗せやすくなります。",
    );
  }
  if (ids.includes("ifRole") || ids.includes("rewardMenu")) {
    candidates.push(
      "お願いではなく、選べる関わり方を用意する。人は『やらされる』より『自分で選ぶ』と動きやすくなります。",
      "応援したい気持ちがあっても、関わり方が見えないと動けません。小さな役割を見せるほど、仲間化が進みます。",
    );
  }
  if (ids.includes("xday") || ids.includes("report")) {
    candidates.push(
      "本気は頭の中にあるだけでは伝わりません。X-Dayと進捗共有で、仲間が船の現在地を見られるようになります。",
      "締切と現在地が見えると、応援者は動きやすくなります。進捗、壁、感謝を出すほど船に乗る理由が増えます。",
    );
  }
  if (ids.includes("react") || ids.includes("comment")) {
    candidates.push(
      "リアクションは目的ではなく、関係性の入口。募集したときに反応が返ってくる土台になります。",
      "いきなり募集しても、酒場は振り向いてくれません。先に誰かの挑戦に反応すると、会話の温度が上がります。",
    );
  }
  if (ids.includes("roles") || ids.includes("aiRoles")) {
    candidates.push(
      "いいねを仲間に変えるには、関わりしろが必要です。何を手伝えばいいかが見えると、人は動きやすくなります。",
      "『手伝って』だけでは重く感じます。受付、紹介、壁打ち、拡散など、選べる入口があると一歩目が軽くなります。",
    );
  }
  if (ids.includes("crewTalk") || ids.includes("oneonone")) {
    candidates.push(
      "企画へのYESを、関わり方へのYESに変える。ここで本気の仲間が生まれます。",
      "一対一の相談は、相手の温度を知る時間です。何にワクワクするかを聞くと、役割の合意に近づきます。",
    );
  }
  if (ids.includes("announce") || ids.includes("lastCall")) {
    candidates.push(
      "告知は刈り取りではなく、ここまでの関係性と企画づくりの結果です。",
      "最後の募集だけで船は急に進みません。告知前のリアクション、相談、関わりしろが当日の人数に変わります。",
    );
  }
  if (ids.some((id) => id.startsWith("ai"))) {
    candidates.push(
      "AIは魔法ではなく、壁打ちと改善の速度を上げる道具。人との接点と組み合わせるほど効きます。",
      "AIで量を増やすだけだと温度が足りません。反応を見て言葉を直し、人に相談して熱を戻しましょう。",
    );
  }
  candidates.push(
    "30人集めることより、30人をみんなで集められる状態を作ることが大事です。",
    "参加者だけでなく、運営とコアメンバーが増えるほど、企画はあなた一人の手を離れて育ち始めます。",
  );

  const fresh = candidates.filter((message) => message !== s.lastLearning);
  return fresh[roll(0, fresh.length - 1)];
}

function getRank() {
  const p = state.people;
  if (state.stats.trust < 18) {
    return ["Dランク", "信頼残高が尽きかけています。告知やお願いを重ねる前に、応援、相談、感謝で酒場の温度を戻しましょう。"];
  }
  if (p.attendees >= 30 && p.supporters >= 100 && p.crew >= 3 && p.core >= 3 && state.stats.trust >= 35) {
    return ["Sランク", "30人集客を、仲間と応援者の力で達成した。これは一人の集客ではなく、応援共創のムーブメントです。"];
  }
  if (p.attendees >= 30 && (p.crew > 0 || p.core > 0)) {
    return ["Aランク", "イベントは形になり、仲間も生まれた。次は関わりしろをさらに増やすと、もっと広がります。"];
  }
  if (p.attendees >= 15 && p.crew + p.core < 2) {
    return ["Cランク", "集客は進んだが、ほぼ一人で頑張った状態です。30人集めることより、30人をみんなで集められる状態を作ることが大事です。"];
  }
  if (p.attendees >= 15 && (p.supporters >= 40 || p.crew > 0)) {
    return ["Bランク", "まだ満席ではないが、応援される土台は育っている。次回は募集前の関係性づくりをさらに厚くしましょう。"];
  }
  return ["Dランク", "募集しても反応が薄かった。まずはリアクション、応援コメント、壁打ちから始めて、関係性の土台を作りましょう。"];
}

function render() {
  els.week.textContent = state.week;
  els.attendees.textContent = state.people.attendees;
  els.supporters.textContent = state.people.supporters;
  els.crew.textContent = state.people.crew;
  els.core.textContent = state.people.core;
  els.selectedCount.textContent = state.selected.length;
  const spent = selectedCost();
  if (els.timeNow) els.timeNow.textContent = state.resources.timeMax - spent.time;
  if (els.timeMax) els.timeMax.textContent = state.resources.timeMax;
  if (els.money) els.money.textContent = state.resources.money;
  els.runButton.disabled = state.selected.length !== 3 || state.ended;
  els.learning.textContent = state.learning;
  els.phaseText.textContent = `${phaseNames[getPhase()]}: ${getPhaseDescription()}`;

  const progress = clamp((state.people.attendees / 30) * 72 + (state.people.core / 3) * 18 + (state.people.crew / 3) * 10, 0, 92);
  els.ship.style.setProperty("--ship-x", `${8 + progress * 0.72}%`);

  const [rank] = getRank();
  els.rankPreview.textContent = state.ended ? rank : "航海中";

  renderStats();
  renderCards();
  renderLog();
  renderParty();
  saveState();
}

function getPillarValue(key) {
  if (key === "trust") return state.stats.trust;
  if (key === "relation") return Math.round((state.stats.relation * 0.7) + (state.stats.reach * 0.3));
  if (key === "concept") return Math.round((state.stats.concept * 0.72) + (state.stats.roles * 0.28));
  return Math.round((state.stats.ai * 0.72) + (state.stats.reach * 0.28));
}

function getPhaseDescription() {
  if (getPhase() === "seed") return "まずは関係性の土台づくり。";
  if (getPhase() === "bond") return "興味を、関わり方へのYESに変える。";
  return "仲間と応援者の力で30人を目指す。";
}

function renderStats() {
  els.statusList.innerHTML = pillarMeta
    .map(([key, label, color]) => {
      const value = getPillarValue(key);
      return `
        <div class="status-row">
          <div class="status-label"><span>${label}</span><span>${value}</span></div>
          <div class="bar"><div class="bar-fill" style="--value:${value}%; --color:${color};"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderCards() {
  const available = getAvailableCards();
  const spent = selectedCost();
  els.cards.innerHTML = available
    .map((card) => {
      const selected = state.selected.includes(card.id);
      const full = !selected && state.selected.length >= 3;
      const overTime = !selected && spent.time + (card.time || 0) > state.resources.timeMax;
      const overMoney = !selected && spent.money + (card.money || 0) > state.resources.money;
      const disabled = full || overTime || overMoney;
      let reason = card.text;
      if (overMoney) reason = "資金が足りません";
      else if (overTime) reason = "今週の時間が足りません";
      const costLabel = `⏳${card.time || 0}${card.money ? ` 💰${card.money}` : ""}`;
      return `
        <button class="card-button ${selected ? "selected" : ""}" ${disabled ? "disabled" : ""} data-card="${card.id}" title="${reason}">
          <div class="card-title"><span class="card-icon">${card.icon}</span><span class="card-name">${card.title}</span><span class="card-cost">${costLabel}</span></div>
          <p>${card.text}</p>
        </button>
      `;
    })
    .join("");

  els.cards.querySelectorAll("[data-card]").forEach((button) => {
    button.addEventListener("click", () => selectCard(button.dataset.card));
  });
}

function renderLog() {
  const visibleLog = state.currentWeekLog.length ? state.currentWeekLog : state.log.slice(-1);
  els.log.innerHTML = visibleLog
    .slice(0, 3)
    .map((message) => `<li>${message}</li>`)
    .join("");
}

function renderParty() {
  const memberCount = clamp(state.people.crew * 2 + state.people.core * 3, 0, 16);
  const colors = ["#d95043", "#2f9aa0", "#4f8d5d", "#f3b546", "#7b5fc6", "#cc6f2b"];
  els.party.innerHTML = Array.from({ length: memberCount })
    .map((_, index) => `<span class="sprite" style="--shirt:${colors[index % colors.length]}"></span>`)
    .join("");
}

function getDiagnosis() {
  const p = state.people;
  const relation = getPillarValue("relation");
  const concept = getPillarValue("concept");
  const ai = getPillarValue("ai");

  if (state.stats.trust < 22) {
    return {
      type: "信頼残高ぎりぎり型",
      advice: "告知やお願いの回数に対して、応援、相談、感謝が足りていません。次回は募集前に人の挑戦へ反応し、進捗と感謝を共有して、酒場の温度を戻しましょう。",
    };
  }

  if (p.attendees >= 30 && p.core >= 3) {
    return {
      type: "応援共創型",
      advice: "参加者もコアメンバーも生まれています。次は運営メンバーに小さなリーダー役を渡すと、あなた一人の企画から、みんなの企画に変わっていきます。",
    };
  }

  if (p.attendees >= 30 && p.crew + p.core < 2) {
    return {
      type: "一人で集めきり型",
      advice: "集客力はあります。ただ、仲間化が弱いので次回は告知前に『誰がどう関われるか』を出して、企画へのYESを関わり方へのYESに変えましょう。",
    };
  }

  if (relation < concept && relation < ai) {
    return {
      type: "企画先行・関係性不足型",
      advice: "企画や仕掛けは動いていますが、募集前の接点が足りません。リアクション、応援コメント、1対1の壁打ちを増やすと、投稿への反応が返ってきやすくなります。",
    };
  }

  if (concept < relation && concept < ai) {
    return {
      type: "関係性先行・企画磨き待ち型",
      advice: "応援される土台はあります。次は『なぜ今やるのか』『誰がどう嬉しいのか』『シェアしたくなる一言』を磨くと、応援が参加や紹介に変わりやすくなります。",
    };
  }

  if (ai > relation + 18) {
    return {
      type: "AI加速・人肌不足型",
      advice: "仕掛けの数は増えています。次はAIで作った言葉をそのまま出すより、人に相談して温度を足すと、量が関係性に変わり始めます。",
    };
  }

  if (p.crew > 0 && p.core < 2) {
    return {
      type: "運営候補育成型",
      advice: "一緒に動く人は生まれています。次は進捗、壁、お願いしたい役割を共有して、運営メンバーが自分ごととして動ける余白を作りましょう。",
    };
  }

  return {
    type: "土台づくり型",
    advice: "まずは反応が返ってくる土台を厚くしましょう。人の挑戦にリアクションし、未完成の段階で相談し、応援者が関われる入口を小さく出すのが次の一手です。",
  };
}

function showResult() {
  const [rank, message] = getRank();
  const diagnosis = getDiagnosis();
  els.resultRank.textContent = rank;
  els.resultType.textContent = diagnosis.type;
  els.resultMessage.textContent = message;
  els.resultAdvice.textContent = diagnosis.advice;
  els.finalAttendees.textContent = state.people.attendees;
  els.finalSupporters.textContent = state.people.supporters;
  els.finalCrew.textContent = state.people.crew;
  els.finalCore.textContent = state.people.core;
  els.dialog.showModal();
}

async function copyResult() {
  const [rank, message] = getRank();
  const diagnosis = getDiagnosis();
  const text = [
    "応援共創シミュレーターをやってみました",
    `結果: ${rank}`,
    `タイプ: ${diagnosis.type}`,
    `参加者: ${state.people.attendees}/30`,
    `応援者: ${state.people.supporters}/100`,
    `運営: ${state.people.crew}/3`,
    `コアメンバー: ${state.people.core}/3`,
    `コメント: ${message}`,
    `次のアドバイス: ${diagnosis.advice}`,
    "",
    "フィードバック観点:",
    "1. 面白かったところ",
    "2. わかりにくかったところ",
    "3. BOOSTERらしい/らしくないと感じたところ",
    "4. もう一度やりたいと思うか",
  ].join("\n");

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    els.copyStatus.textContent = "結果をコピーしました";
  } catch {
    els.copyStatus.textContent = "コピーできませんでした";
  }
}

function resetGame() {
  clearSave();
  state = structuredClone(initialState);
  els.copyStatus.textContent = "";
  render();
}

function openIntro() {
  if (els.introDialog && typeof els.introDialog.showModal === "function") {
    els.introDialog.showModal();
  }
}

function closeIntro() {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {}
  if (els.introDialog) els.introDialog.close();
}

function maybeShowIntroOnLoad() {
  let seen = false;
  try {
    seen = !!localStorage.getItem(INTRO_KEY);
  } catch {}
  if (!seen) openIntro();
}

els.runButton.addEventListener("click", runWeek);
els.resetButton.addEventListener("click", resetGame);
els.copyResult.addEventListener("click", copyResult);
els.closeResult.addEventListener("click", () => {
  els.dialog.close();
  resetGame();
});
if (els.introStart) els.introStart.addEventListener("click", closeIntro);
if (els.helpButton) els.helpButton.addEventListener("click", openIntro);

render();
maybeShowIntroOnLoad();
if (state.ended) showResult();
