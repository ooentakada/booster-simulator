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
    wom: 0,
    prep: 0,
    chain: 0,
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
    timeMax: 11,
    money: 30,
  },
  hand: [],
  weekResult: null,
  phaseAnnounce: null,
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
  ["wom", "口コミ力", "#e08a2b"],
  ["chain", "連鎖力", "#b0486e"],
  ["prep", "本番準備", "#c77d3a"],
  ["trust", "信頼残高", "#7b5fc6"],
];

// ===== RSMの核となる計算式 =====
// 反応 ＝ 言葉の力 × 関係資本（信頼残高・関係性）。
// 関係資本が薄いと、どんなにいい言葉でも反応はほぼ返らない（ゆるぼの大前提）。
function kizunaFactor(s) {
  return clamp((s.stats.trust * 0.7 + s.stats.relation * 0.5) / 66, 0.12, 1.25);
}

// 言葉の力。AIに全部書かせる（aiFlat）と平均化して温度が下がり、反応が伸びない。
// 反応系カードを1回使うたびにペナルティは1段階抜ける（言葉を出して学ぶ）。
function wordPower(s) {
  let p = 1;
  const flat = s.multipliers.aiFlat || 0;
  if (flat > 0) {
    p = Math.max(0.35, Math.pow(0.6, flat));
    s.multipliers.aiFlat = flat - 1;
  }
  return p;
}

// 連鎖係数R ＝ 反応者が次の発信者・応援者になる度合い。R > 1 で連鎖は勝手に広がり続ける。
function getChainR(s) {
  const r = 0.55 + s.stats.chain * 0.007 + s.stats.wom * 0.0022 + s.people.crew * 0.02 + s.people.core * 0.03;
  return Math.round(clamp(r, 0, 1.6) * 100) / 100;
}

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
    id: "drink",
    title: "飲みに行く",
    icon: "杯",
    phase: "seed",
    text: "酒場で一緒に飲んで本音で語り合う。一気に距離が縮まり、企画のアイディアも湧く。お金はかかる。",
    apply: (s) => {
      addStat(s, "relation", 16);
      addStat(s, "trust", 10);
      addStat(s, "commitment", 5);
      addStat(s, "concept", 6);
      s.people.supporters += roll(2, 5);
      s.multipliers.nextPost += 2;
      if (s.people.interested > 4 && chance((s.stats.relation + s.stats.commitment) / 220)) {
        s.people.crew += 1;
        addLog(s, "飲みながら本音で語り合った。『その挑戦、おれも一緒にやりたい』と、運営に近づく仲間が生まれた。");
      } else {
        addLog(s, "酒場で一緒に飲んだ。建前が外れて距離が縮まり、ふと企画を面白くするアイディアも湧いた。");
      }
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
      addStat(s, "prep", 4);
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
      addStat(s, "prep", 5);
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
      addStat(s, "prep", 3);
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
      const raw = (s.stats.concept + s.stats.relation) / 18 + roll(0, 4) + s.multipliers.nextPost;
      const gain = Math.max(0, Math.round(raw * kizunaFactor(s) * wordPower(s) * 1.2));
      s.people.interested += gain;
      s.people.supporters += Math.max(0, Math.floor(gain / 2));
      s.multipliers.nextPost = 0;
      addLog(s, gain > 3
        ? `企画の種を投稿した。${gain}人が『気になる』と反応した。`
        : "企画の種を投稿したが、反応は薄かった。反応は言葉の力×信頼残高。先に応援貯金で土台を温めたい。");
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
      addStat(s, "prep", 2);
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
      addStat(s, "prep", 4);
      s.multipliers.nextLaunch += 5;
      addLog(s, s.people.interested > 8
        ? "LPを改善した。相談で出た言葉を反映したことで、参加導線がわかりやすくなった。"
        : "LPを改善した。ページは整ったが、まだ人の声を拾えていないので温度は乗り切っていない。");
    },
  },
  {
    id: "interest",
    title: "ゆるぼを出す",
    icon: "ゆ",
    phase: "bond",
    text: "「こんなこと考えてるんだけど、興味ある人いる？」— 売り込まず、ゆるく募集して反応を先に取る。反応は 言葉の力×信頼残高 で決まる。",
    apply: (s) => {
      const base = (s.stats.relation * 0.1) + (s.stats.concept * 0.13) + s.multipliers.nextPost;
      const gain = Math.max(0, Math.round(base * kizunaFactor(s) * wordPower(s) * 1.35 + roll(-2, 5)));
      addStat(s, "trust", -3);
      s.people.interested += gain;
      s.people.supporters += Math.floor(gain * 0.7);
      s.multipliers.nextPost = 0;
      addLog(s, gain >= 8
        ? `ゆるぼを出した。${gain}人が「興味ある！」と手を挙げ、酒場がざわつき始めた。反応から企画が育っていく。`
        : "ゆるぼを出したが、反応は少ない。反応は言葉の力×信頼残高。先に応援貯金（リアクション・応援コメント）を積みたい。");
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
      addStat(s, "prep", 2);
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
    id: "wom",
    title: "口コミを設計する",
    icon: "口",
    phase: "bond",
    text: "何を・誰に・どう伝えてもらうか。紹介の言葉と体験談を設計する。これが無いと紹介は広がらない。",
    apply: (s) => {
      addStat(s, "wom", 18);
      addStat(s, "reach", 4);
      addStat(s, "concept", 4);
      s.people.supporters += roll(1, 4);
      addLog(s, s.stats.wom < 22
        ? "口コミを設計し始めた。『何を伝えてもらうか』が言葉になると、紹介が動き出す準備が整う。"
        : "口コミの設計を磨いた。紹介したくなる一言と体験談が揃い、仲間が広げやすくなった。");
    },
  },
  {
    id: "monitor",
    title: "モニターで試す",
    icon: "声",
    phase: "bond",
    text: "小さくお試し体験してもらい、喜びの声を集める。声が企画の魅力の証拠になり、信頼も高まる。",
    apply: (s) => {
      addStat(s, "concept", 13);
      addStat(s, "trust", 8);
      addStat(s, "wom", 6);
      addStat(s, "reach", 2);
      addStat(s, "prep", 5);
      s.people.supporters += roll(2, 5);
      addLog(s, s.stats.concept > 45
        ? "モニターで試してもらった。集まった喜びの声が積み重なり、『これは間違いない』という空気が企画を後押しした。"
        : "モニターで試してもらった。『これ良い！』という声が、自分で魅力を語るより強く企画の価値を証明してくれた。");
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
      const rawGain = Math.max(0, Math.round((base * weakLaunchPenalty * trustPenalty * wordPower(s)) + roll(-2, 5)));
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
      // 口コミ設計の度合いで紹介の効きが変わる。設計していないと紹介はほぼ広がらない。
      const womFactor = clamp(0.35 + s.stats.wom * 0.0085, 0.35, 1.1);
      const gain = Math.max(0, Math.round((base * trustPenalty * womFactor) + roll(-1, 4)));
      s.people.attendees += gain;
      s.people.supporters += roll(0, 8);
      addStat(s, "reach", Math.min(8, Math.floor(gain / 2)));
      addLog(s, s.stats.wom < 25
        ? "紹介をお願いしたが、何をどう伝えればいいかが共有できておらず、あまり広がらなかった。先に口コミを設計したい。"
        : gain >= 8
        ? `仲間に紹介をお願いした。${gain}人の参加につながった。設計した口コミが、仲間の口を借りて広がっている。`
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
      const gain = Math.max(0, Math.round(((s.stats.concept + s.stats.reach) / 22 + roll(1, 7)) * wordPower(s)));
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
      const gain = Math.max(0, Math.round((base * trustPenalty * wordPower(s)) + roll(-2, 7)));
      s.people.attendees += gain;
      s.multipliers.nextLaunch = 0;
      addLog(s, gain >= 10
        ? `ラスト募集が届いた。${gain}人が申し込んだ。ここまでの関係性と仲間の力が最後に効いた。`
        : "ラスト募集をしたが、伸びは小さかった。最後だけ頑張っても、船は急には進まない。");
    },
  },
  {
    id: "prepare",
    title: "本番の準備をする",
    icon: "幕",
    phase: "launch",
    text: "当日の進行・台本・おもてなしを整える。仲間（運営・コアメンバー）が多いほど準備は加速し、企画も磨かれる。一人だとほとんど進まない。",
    apply: (s) => {
      const gain = 2 + s.people.crew * 2 + s.people.core * 4;
      addStat(s, "prep", gain);
      addStat(s, "concept", 3);
      addStat(s, "commitment", 3);
      addStat(s, "trust", 3);
      const mates = s.people.crew + s.people.core;
      addLog(s, mates === 0
        ? "一人で本番の準備を始めたが、できることはわずか。仲間が増えるほど準備は一気に進む。"
        : `運営${s.people.crew}人・コア${s.people.core}人と手分けして準備。仲間がいるほど、当日に向けて準備も企画も磨かれていく。`);
    },
  },
  {
    id: "proxyYurubo",
    title: "代理ゆるぼをお願いする",
    icon: "横",
    phase: "launch",
    text: "「私も行きたいんだけど、一緒に行く人いる？」— 反応してくれた人に、その人の言葉でゆるぼを出してもらう（横の連鎖）。口コミ設計と応援者が土台。",
    apply: (s) => {
      if (s.stats.wom < 22 || s.people.supporters < 12) {
        addStat(s, "chain", 4);
        addLog(s, "代理ゆるぼをお願いしたが、渡せる言葉がなくて広がらなかった。先に口コミを設計し、応援者を増やしたい。");
        return;
      }
      addStat(s, "chain", 16);
      addStat(s, "reach", 5);
      const gain = Math.max(1, Math.round((s.people.supporters * 0.2 + s.stats.wom * 0.16) * kizunaFactor(s)) + roll(1, 4));
      s.people.attendees += gain;
      s.people.supporters += roll(1, 5);
      addLog(s, `仲間が自分の言葉でゆるぼを出してくれた。${gain}人が、あなたの影響圏の外からやって来た。これが横の連鎖。`);
    },
  },
  {
    id: "nextHero",
    title: "「あなたも？」と声をかける",
    icon: "縦",
    phase: "bond",
    text: "反応してくれた人に「次はあなたの番。みんなで応援するよ」— 反応者を次の主役にする（縦の連鎖）。反応で終わらせない。",
    apply: (s) => {
      addStat(s, "chain", 13);
      addStat(s, "trust", 4);
      addStat(s, "commitment", 5);
      if (s.people.supporters >= 8 && chance(0.35 + s.stats.relation * 0.003)) {
        s.people.crew += 1;
        s.people.supporters += roll(2, 6);
        addLog(s, "「あなたも何かやってみない？」— 応援してくれていた人が、自分の企画を持つ仲間になった。縦の連鎖で場が増えていく。");
      } else {
        s.people.supporters += roll(1, 4);
        addLog(s, "反応をくれた人に、次の主役の椅子を差し出した。すぐ座らなくても、この声かけが連鎖の種になる。");
      }
    },
  },
  {
    id: "aiAllIn",
    title: "AIに全部書かせる",
    icon: "楽",
    phase: "seed",
    text: "告知文もゆるぼも、ぜんぶAI任せ。ラクだし速いし、それっぽい。……それっぽい、だけかも。",
    apply: (s) => {
      addStat(s, "ai", 8);
      addStat(s, "concept", 2);
      addStat(s, "relation", -3);
      addStat(s, "trust", -5);
      s.multipliers.aiFlat = (s.multipliers.aiFlat || 0) + 1;
      addLog(s, "AIに全部書かせた。それっぽい文章が量産されたが、どれにも体温がない。平均化した言葉は、誰の心にも刺さらない。");
    },
  },
  {
    id: "aiOneTen",
    title: "自分の一行をAIで10に",
    icon: "10",
    phase: "seed",
    text: "熱量が乗る一行（得意フレーズ）はまず自分で書く。AIには広げる・削る・チェックだけさせる。AIは0→1じゃなく1→10。",
    apply: (s) => {
      addStat(s, "ai", 7);
      addStat(s, "concept", 9);
      addStat(s, "prep", 2);
      s.multipliers.nextPost += 4;
      if (s.multipliers.aiFlat) s.multipliers.aiFlat = 0;
      addLog(s, "まず自分の言葉で一行書き、AIに切り口20個へ広げさせた。熱はそのまま、届く形だけが増えた。");
    },
  },
];

// 各カードのコスト。time=毎週の持ち時間消費 / money=資金消費。
// 応援・相談・感謝などの「人間的な行動」は money:0（無料）。AI・LP・広告・会場はお金がかかる。
// 時間: 接点・会話系=3 / 制作・AI系=4 / 重い行動=5。timeMax=11なので重い行動は週1枚まで。
const cardCost = {
  react: { time: 3, money: 0 },
  comment: { time: 3, money: 0 },
  drink: { time: 5, money: 6 },
  spotlight: { time: 3, money: 0 },
  preConsult: { time: 3, money: 0 },
  twentyGo: { time: 3, money: 0 },
  seedpost: { time: 3, money: 0 },
  oneonone: { time: 3, money: 0 },
  catchcopy: { time: 4, money: 0 },
  aiConcept: { time: 4, money: 3 },
  lpDraft: { time: 5, money: 8 },
  interest: { time: 3, money: 0 },
  openConsult: { time: 5, money: 4 },
  roles: { time: 3, money: 0 },
  ifRole: { time: 3, money: 0 },
  rewardMenu: { time: 3, money: 0 },
  crewTalk: { time: 3, money: 0 },
  wom: { time: 5, money: 0 },
  monitor: { time: 5, money: 2 },
  aiRoles: { time: 4, money: 3 },
  lpImprove: { time: 5, money: 5 },
  xday: { time: 3, money: 0 },
  report: { time: 3, money: 0 },
  thanksBoost: { time: 3, money: 0 },
  announce: { time: 3, money: 5 },
  referral: { time: 3, money: 0 },
  live: { time: 5, money: 3 },
  aiImprove: { time: 4, money: 3 },
  lastCall: { time: 4, money: 6 },
  prepare: { time: 4, money: 2 },
  proxyYurubo: { time: 3, money: 0 },
  nextHero: { time: 3, money: 0 },
  aiAllIn: { time: 2, money: 3 },
  aiOneTen: { time: 4, money: 3 },
};

// カードが主に効く指標（カード上に表示してバーを見に行かなくて済むように）。
const cardEffect = {
  react: ["関係+", "信頼+"],
  comment: ["関係+", "信頼+"],
  drink: ["関係++", "企画+"],
  spotlight: ["関係+", "応援+"],
  preConsult: ["関係+", "企画+"],
  twentyGo: ["企画+", "興味+"],
  seedpost: ["興味+"],
  oneonone: ["企画+", "準備+", "仲間の芽"],
  catchcopy: ["企画++", "準備+"],
  aiConcept: ["AI+", "企画+", "準備+"],
  lpDraft: ["企画++", "準備+", "信頼-"],
  interest: ["興味+", "応援+"],
  openConsult: ["応援++", "興味+", "準備+"],
  roles: ["関わりしろ+"],
  ifRole: ["関わりしろ+", "本気+"],
  rewardMenu: ["関わりしろ+"],
  crewTalk: ["本気+", "運営化"],
  wom: ["口コミ+"],
  monitor: ["企画++", "信頼+", "準備+"],
  aiRoles: ["AI+", "関わりしろ+"],
  lpImprove: ["企画+"],
  xday: ["本気+", "信頼-"],
  report: ["本気+", "信頼+"],
  thanksBoost: ["関係+", "信頼+"],
  announce: ["集客", "信頼--"],
  referral: ["集客", "口コミ次第"],
  live: ["興味+", "拡散+"],
  aiImprove: ["AI+"],
  lastCall: ["集客", "信頼--"],
  prepare: ["準備", "仲間で加速", "企画+"],
  proxyYurubo: ["連鎖++", "集客", "口コミ次第"],
  nextHero: ["連鎖+", "運営化", "信頼+"],
  aiAllIn: ["AI+", "信頼-", "言葉の温度↓"],
  aiOneTen: ["企画++", "AI+", "次の投稿+"],
};

const FEE_PER_HEAD = 1;

// 難易度スケーリング: 毎週の「参加者・応援者の増加分」を圧縮する。
// 数字が青天井に伸びるのを抑え、A/Bを主役に、Sを滅多に出ない達成にする。
const ATT_SCALE = 0.25;
const SUP_SCALE = 0.45;

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

const SAVE_KEY = "booster-sim-save-v5";
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
  pickedSlots: document.querySelector("#pickedSlots"),
  selectedCount: document.querySelector("#selectedCount"),
  timeNow: document.querySelector("#timeNow"),
  timeMax: document.querySelector("#timeMax"),
  money: document.querySelector("#money"),
  runButton: document.querySelector("#runButton"),
  resetButton: document.querySelector("#resetButton"),
  phaseText: document.querySelector("#phaseText"),
  learning: document.querySelector("#learning"),
  log: document.querySelector("#log"),
  weekChanges: document.querySelector("#weekChanges"),
  countdown: document.querySelector("#countdown"),
  portGauge: document.querySelector("#portGauge"),
  portFill: document.querySelector("#portFill"),
  portRemain: document.querySelector("#portRemain"),
  party: document.querySelector("#party"),
  ship: document.querySelector("#ship"),
  rankPreview: document.querySelector("#rankPreview"),
  dialog: document.querySelector("#resultDialog"),
  resultRank: document.querySelector("#resultRank"),
  resultType: document.querySelector("#resultType"),
  resultPhase: document.querySelector("#resultPhase"),
  resultMessage: document.querySelector("#resultMessage"),
  resultAdvice: document.querySelector("#resultAdvice"),
  finalAttendees: document.querySelector("#finalAttendees"),
  finalSupporters: document.querySelector("#finalSupporters"),
  finalCrew: document.querySelector("#finalCrew"),
  finalCore: document.querySelector("#finalCore"),
  copyResult: document.querySelector("#copyResult"),
  copyStatus: document.querySelector("#copyStatus"),
  closeResult: document.querySelector("#closeResult"),
  resultNextHint: document.querySelector("#resultNextHint"),
  nextStep: document.querySelector("#nextStep"),
  ctaButton: document.querySelector("#ctaButton"),
  shareX: document.querySelector("#shareX"),
  shareImage: document.querySelector("#shareImage"),
  sharePreviewWrap: document.querySelector("#sharePreviewWrap"),
  sharePreview: document.querySelector("#sharePreview"),
  shareDownload: document.querySelector("#shareDownload"),
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

// 各フェーズの全カードプール（毎週ここからランダムに手札を配る）。
const cardPool = {
  seed: ["react", "comment", "drink", "spotlight", "preConsult", "oneonone", "twentyGo", "seedpost", "interest", "xday", "catchcopy", "aiConcept", "aiOneTen", "aiAllIn", "lpDraft", "prepare", "announce"],
  bond: ["interest", "openConsult", "monitor", "roles", "ifRole", "rewardMenu", "crewTalk", "wom", "nextHero", "drink", "xday", "aiRoles", "aiOneTen", "aiAllIn", "lpImprove", "prepare", "comment", "announce"],
  launch: ["xday", "report", "thanksBoost", "referral", "proxyYurubo", "nextHero", "wom", "prepare", "live", "aiImprove", "aiAllIn", "lastCall", "announce"],
};

const HAND_SIZE = 6;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 毎週の手札を引く。告知を必ず入れ、詰み防止に軽いカードを2枚保証する。
function drawHand() {
  const pool = cardPool[getPhase()].slice();
  const size = Math.min(HAND_SIZE, pool.length);
  const must = [];

  if (pool.includes("announce")) must.push("announce");
  // 集客フェーズでは「準備」も毎週必ず手札に入れ、集客と準備を毎週選べるようにする
  if (getPhase() === "launch" && pool.includes("prepare")) must.push("prepare");

  // 詰み防止＆選択肢確保: 軽いカード（時間≤3・無料）を2枚保証
  const light = shuffle(
    pool.filter((id) => {
      const c = cards.find((card) => card.id === id);
      return (c.time || 0) <= 3 && (c.money || 0) === 0 && !must.includes(id);
    }),
  );
  let lightAdded = 0;
  for (let i = 0; i < light.length && lightAdded < 2 && must.length < size; i++) {
    must.push(light[i]);
    lightAdded += 1;
  }

  const rest = shuffle(pool.filter((id) => !must.includes(id)));
  const hand = must.concat(rest).slice(0, size);
  state.hand = shuffle(hand);
}

function getAvailableCards() {
  if (!state.hand || !state.hand.length) drawHand();
  return state.hand.map((id) => cards.find((card) => card.id === id));
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
  const before = snapshot();
  const attBefore = state.people.attendees;
  const supBefore = state.people.supporters;
  state.currentWeekLog = [];
  chosen.forEach((card) => card.apply(state));
  applyPassiveEvents(state, chosen);
  scaleGain("attendees", attBefore, ATT_SCALE);
  scaleGain("supporters", supBefore, SUP_SCALE);
  applyChainDynamics(state, chosen);
  normalizePeople(state);
  const income = Math.max(0, state.people.attendees - attBefore) * FEE_PER_HEAD;
  state.resources.money = clamp(state.resources.money - moneyCost + income, 0, 999);
  state.weekResult = buildWeekResult(before, snapshot(), chosen);
  state.learning = getLearning(state, chosen);
  state.lastLearning = state.learning;
  state.selected = [];

  if (state.week >= 12) {
    state.ended = true;
    render();
    showResult();
    return;
  }

  const oldPhase = getPhase(state.week);
  state.week += 1;
  const newPhase = getPhase(state.week);
  state.phaseAnnounce = newPhase !== oldPhase ? newPhase : null;
  drawHand();
  render();
  // 実行後は「今週の変化」まで自動スクロール（結果を見逃さない）。
  // レイアウト確定後に呼ばないとスクロールが空振りするため少し遅らせる。
  if (els.weekChanges && typeof els.weekChanges.scrollIntoView === "function") {
    setTimeout(() => {
      els.weekChanges.scrollIntoView({ block: "start" });
    }, 80);
  }
}

const phaseIntro = {
  bond: { label: "仲間化フェーズ", desc: "興味を持ってくれた人を、関わってくれる仲間に変えていく時期。" },
  launch: { label: "集客フェーズ", desc: "いよいよ本番。仲間と応援者の力で参加者を集めていく時期。" },
};

function scaleGain(key, beforeVal, factor) {
  const delta = state.people[key] - beforeVal;
  if (delta > 0) state.people[key] = beforeVal + Math.round(delta * factor);
}

// 連鎖のダイナミクス。R > 1 なら参加者が「勝手に」増え続ける。
// 逆に、反応をもらいっぱなしで連鎖の手を打たないと連鎖力は週ごとに減衰する。
const CHAIN_GROWTH = 0.6;
function applyChainDynamics(s, chosen) {
  const ids = chosen.map((c) => c.id);
  const usedChainCard = ids.includes("proxyYurubo") || ids.includes("nextHero");
  if (!usedChainCard && s.stats.chain > 0) {
    addStat(s, "chain", -5);
    if (s.stats.chain < 25 && chance(0.3)) {
      addLog(s, "反応をもらいっぱなしになっている。反応で終わらせず、くれた人を次の主役にすると連鎖が続く。");
    }
  }
  const R = getChainR(s);
  if (R > 1 && s.people.attendees >= 5) {
    const growth = Math.round(s.people.attendees * (R - 1) * CHAIN_GROWTH);
    if (growth > 0) {
      s.people.attendees += growth;
      s.people.supporters += Math.ceil(growth / 2);
      addLog(s, `連鎖係数R=${R}。あなたが動かなくても、仲間のゆるぼ経由で${growth}人が申し込んだ。連鎖が回っている！`);
    }
  }
}

function snapshot() {
  return {
    attendees: state.people.attendees,
    supporters: state.people.supporters,
    crew: state.people.crew,
    core: state.people.core,
    relation: getPillarValue("relation"),
    concept: getPillarValue("concept"),
    ai: getPillarValue("ai"),
    wom: state.stats.wom,
    chain: state.stats.chain,
    trust: state.stats.trust,
  };
}

// 実行直後の「今週の変化」と一言講評を作る。
function buildWeekResult(before, after, chosen) {
  const labels = {
    attendees: "参加者",
    supporters: "応援者",
    crew: "運営",
    core: "コア",
    relation: "関係性",
    concept: "企画の魅力",
    ai: "AI",
    wom: "口コミ力",
    chain: "連鎖力",
    trust: "信頼",
  };
  const changes = [];
  for (const key of Object.keys(labels)) {
    const d = after[key] - before[key];
    if (d !== 0) changes.push({ label: labels[key], delta: d });
  }
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const ids = chosen.map((c) => c.id);
  const trustDrop = before.trust - after.trust;
  const attGain = after.attendees - before.attendees;
  let verdict = "";
  let tone = "neutral";
  if (ids.includes("announce") && getPhase(state.week) === "seed" && before.relation < 35) {
    verdict = "関係性が薄いまま告知 → 反応が鈍い。反応は言葉×信頼残高。先に応援貯金を。";
    tone = "bad";
  } else if (ids.includes("aiAllIn")) {
    verdict = "AI任せの言葉は温度が乗らず、次の反応が鈍る。得意フレーズは自分で書こう（AIは1→10）。";
    tone = "warn";
  } else if (after.chain - before.chain >= 10) {
    verdict = "反応者を次の主役にした。連鎖係数Rが上がると、集客が勝手に回り始める。";
    tone = "good";
  } else if (ids.includes("referral") && before.wom < 25) {
    verdict = "口コミ未設計のまま紹介依頼 → ほとんど広がらず。先に口コミを設計しよう。";
    tone = "bad";
  } else if (trustDrop >= 12) {
    verdict = "信頼を大きく使った週。応援・感謝・進捗共有で残高を戻そう。";
    tone = "warn";
  } else if (attGain >= 8) {
    verdict = "ここまでの関係性と企画が、集客に変わり始めた。いい流れ。";
    tone = "good";
  } else if (ids.includes("monitor")) {
    verdict = "体験者の声が、企画の魅力と信頼を押し上げた。";
    tone = "good";
  } else if (ids.includes("drink")) {
    verdict = "本音で語り合い、関係性がぐっと深まった（1回飲めばマブダチ）。";
    tone = "good";
  } else if (ids.includes("wom")) {
    verdict = "紹介が広がる準備が整った。次は紹介依頼が効く。";
    tone = "good";
  }
  return { changes, verdict, tone };
}

function normalizePeople(s) {
  s.people.interested = clamp(s.people.interested, 0, 80);
  s.people.attendees = clamp(s.people.attendees, 0, 120);
  s.people.supporters = clamp(s.people.supporters, 0, 120);
  s.people.crew = clamp(s.people.crew, 0, 12);
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
      "これが『応援貯金』。反応は 言葉の力 × 信頼残高 で決まるので、先に応援した人からゆるぼへの反応が返ってきます。",
    );
  }
  if (ids.includes("proxyYurubo")) {
    candidates.push(
      "横の連鎖＝同じ企画を、反応してくれた人の言葉と影響圏で広げてもらう。固有名詞を外した『渡せる言葉』が鍵です。",
      "自分の告知が届く範囲には限界があります。仲間の『私も行きたいんだけど』の一言は、あなたの言葉より遠くへ届きます。",
    );
  }
  if (ids.includes("nextHero")) {
    candidates.push(
      "縦の連鎖＝反応してくれた人を次の主役にする。『あなたも？』の一言で、応援者が発信者に変わります。",
      "連鎖係数Rが1を超えると、集客は勝手に広がり続けます。反応で終わらせないことがR>1の条件です。",
    );
  }
  if (ids.includes("aiAllIn")) {
    candidates.push(
      "AIに0→1をさせると言葉が平均化して死にます。熱量が乗る一行（得意フレーズ）は、人間にしか書けません。",
      "AIで量産した言葉は、それっぽいのに刺さらない。まず自分で1行書いてから、AIに広げさせましょう。",
    );
  }
  if (ids.includes("aiOneTen")) {
    candidates.push(
      "AIは0→1ではなく1→10。整理・切り口の量産・推敲・チェックに使うと、熱を保ったまま届く形が増えます。",
    );
  }
  if (ids.includes("drink")) {
    candidates.push(
      "『1回飲めばマブダチ』。一度ちゃんと飲んで本音で話すと、オンラインの何十回のやり取りより一気に距離が縮まります。",
      "飲みの席は最高の企画会議です。本音の雑談から、企画の魅力をもう一段引き上げるアイディアが生まれます。",
      "飲み代はコストではなく投資です。建前が外れた関係は、いざというとき本気で動いてくれる仲間に変わります。",
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
  if (ids.includes("wom")) {
    candidates.push(
      "『紹介して』だけでは人は動けません。何を・誰に・どう伝えるかを設計して初めて、口コミは広がります。",
      "口コミは運ではなく設計です。伝えてほしい一言と体験談を用意すると、仲間が紹介しやすくなります。",
    );
  }
  if (ids.includes("monitor")) {
    candidates.push(
      "企画の魅力は自分で言うより、試した人の声が証明します。小さくモニターしてもらい、喜びの声を集めましょう。",
      "1回目から完璧を目指さなくていい。お試しで体験してもらった声があるほど、企画は信頼され、本番の集客が変わります。",
    );
  }
  if (ids.includes("prepare")) {
    candidates.push(
      "人を集めることと、当日満足してもらうことは別の準備です。進行・台本・おもてなしを整えるほど、満足度が上がります。",
      "準備は一人では進みません。運営・コアメンバーがいるほど当日の段取りは一気に整い、企画も磨かれます。まず仲間を作るのが近道です。",
      "集客がゴールではありません。来てくれた人が『来てよかった』と思える準備こそ、次回の応援につながります。",
    );
  }
  if (ids.includes("referral") && s.stats.wom < 25) {
    candidates.push(
      "紹介をお願いする前に、口コミを設計しましょう。伝える言葉が無いと、仲間も何を広めればいいか分かりません。",
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

// 当日満足度 ＝ 本番準備メーター。準備カードに加え、企画を作り込むカードでも少しずつ上がる。
function getSatisfaction() {
  return clamp(state.stats.prep, 0, 100);
}

function getRank() {
  const p = state.people;
  const t = state.stats.trust;
  const sat = getSatisfaction();
  if (t < 18) {
    return ["Dランク", "信頼残高が尽きかけています。告知やお願いを重ねる前に、応援、相談、感謝で酒場の温度を戻しましょう。"];
  }
  if (p.attendees >= 38 && p.supporters >= 60 && p.crew >= 4 && p.core >= 4 && t >= 50 && sat >= 60) {
    return ["Sランク", "30人集客を、仲間と応援者の力で大きく超えて達成。さらに本番の準備も行き届き、当日の満足度も最高。これは応援共創のムーブメントです。滅多に届かない景色です。"];
  }
  if (p.attendees >= 30 && p.crew >= 2 && p.core >= 1 && sat >= 42) {
    return ["Aランク", "集客・仲間化・本番準備のすべてが噛み合った。一人の集客ではなく、仲間と作り上げたイベント。次は応援者とコアメンバーを厚くすると、Sの景色が見えてきます。"];
  }
  if (p.attendees >= 30 && (p.crew >= 1 || p.core >= 1)) {
    if (sat < 42) {
      return ["Bランク", "30人は集まったのに、本番の準備が足りず当日の満足度が伸び悩んだ。集客と同じくらい『来た人にどう過ごしてもらうか』の準備が大事です。"];
    }
    return ["Bランク", "30人は集まったが、一緒に動く仲間（運営・コアメンバー）がまだ薄い。仲間化を厚くすると、あなた一人の企画から『みんなの企画』に変わり、Aが見えてきます。"];
  }
  if (p.attendees >= 15 && (p.crew >= 1 || p.supporters >= 35)) {
    return ["Bランク", "まだ満席ではないが、応援される土台は育っている。次回は募集前の関係性づくりと仲間化をさらに厚くしましょう。"];
  }
  if (p.attendees >= 8) {
    return ["Cランク", "集客は少し進んだが、ほぼ一人で頑張った状態です。30人集めることより、30人をみんなで集められる状態を作ることが大事です。"];
  }
  return ["Dランク", "募集しても反応が薄かった。まずはリアクション、応援コメント、壁打ちから始めて、関係性の土台を作りましょう。"];
}

function render() {
  document.body.dataset.phase = getPhase();
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
  const need = 3 - state.selected.length;
  els.runButton.disabled = state.selected.length !== 3 || state.ended;
  els.runButton.classList.toggle("ready", state.selected.length === 3 && !state.ended);
  if (!state.ended) {
    els.runButton.textContent = need > 0 ? `カードをあと${need}枚選ぶ` : "今週を実行 ▶";
  }
  els.learning.textContent = getConciergeLine();
  els.phaseText.textContent = `${phaseNames[getPhase()]}: ${getPhaseDescription()}`;

  const progress = clamp((state.people.attendees / 30) * 72 + (state.people.core / 3) * 18 + (state.people.crew / 3) * 10, 0, 92);
  els.ship.style.setProperty("--ship-x", `${8 + progress * 0.72}%`);

  const [rank] = getRank();
  els.rankPreview.textContent = state.ended ? rank : "航海中";

  if (els.countdown) {
    if (getPhase() === "launch" && !state.ended) {
      const left = 12 - state.week + 1;
      els.countdown.hidden = false;
      els.countdown.classList.toggle("final", state.week >= 12);
      els.countdown.textContent = state.week >= 12 ? "🔥 最終週！本番は目前" : `⏰ 本番まで あと ${left} 週`;
    } else {
      els.countdown.hidden = true;
    }
  }

  if (els.portFill) els.portFill.style.width = `${clamp((state.people.attendees / 30) * 100, 0, 100)}%`;
  if (els.portRemain) {
    const remain = Math.max(0, 30 - state.people.attendees);
    if (state.people.attendees === 0 && getPhase() !== "launch") {
      els.portRemain.textContent = "いまは仲間と土台を育てる時期";
    } else {
      els.portRemain.textContent = remain === 0 ? "出港ライン到達！" : `出港まで あと ${remain} 人`;
    }
  }

  renderStats();
  renderCards();
  renderPickedSlots();
  renderLog();
  renderWeekChanges();
  renderParty();
  saveState();
}

// 選択中の3枠を実行ボタンの上に常時表示。スクロールで戻らなくても確認・解除できる。
function renderPickedSlots() {
  if (!els.pickedSlots) return;
  if (state.ended) {
    els.pickedSlots.innerHTML = "";
    return;
  }
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const id = state.selected[i];
    if (id) {
      const card = cards.find((c) => c.id === id);
      slots.push(`<button class="slot filled" data-slot-card="${id}" type="button" title="タップで選択解除">${card.icon}｜${card.title} ✕</button>`);
    } else {
      slots.push(`<span class="slot empty">${i + 1}枚目</span>`);
    }
  }
  els.pickedSlots.innerHTML = slots.join("");
  els.pickedSlots.querySelectorAll("[data-slot-card]").forEach((button) => {
    button.addEventListener("click", () => selectCard(button.dataset.slotCard));
  });
}

function renderWeekChanges() {
  if (!els.weekChanges) return;
  const r = state.weekResult;
  const pa = state.phaseAnnounce;
  const hasChanges = r && (r.changes.length || r.verdict);
  if (!pa && !hasChanges) {
    els.weekChanges.innerHTML = "";
    els.weekChanges.classList.add("empty");
    return;
  }
  els.weekChanges.classList.remove("empty");
  let html = "";
  if (pa && phaseIntro[pa]) {
    html += `<div class="phase-banner ${pa}"><strong>🚩 ${phaseIntro[pa].label}に入りました</strong><span>${phaseIntro[pa].desc}</span></div>`;
  }
  if (hasChanges) {
    const chips = r.changes
      .slice(0, 6)
      .map((c) => {
        const cls = c.delta > 0 ? "up" : "down";
        const sign = c.delta > 0 ? "+" : "";
        return `<span class="change-chip ${cls}">${c.label} ${sign}${c.delta}</span>`;
      })
      .join("");
    const verdict = r.verdict ? `<p class="week-verdict ${r.tone}">${r.verdict}</p>` : "";
    html += `<div class="change-chips">${chips}</div>${verdict}`;
  }
  els.weekChanges.innerHTML = html;
}

function getPillarValue(key) {
  if (key === "trust") return state.stats.trust;
  if (key === "wom") return state.stats.wom;
  if (key === "prep") return state.stats.prep;
  if (key === "chain") return state.stats.chain || 0;
  if (key === "relation") return Math.round((state.stats.relation * 0.7) + (state.stats.reach * 0.3));
  if (key === "concept") return Math.round((state.stats.concept * 0.72) + (state.stats.roles * 0.28));
  return Math.round((state.stats.ai * 0.72) + (state.stats.reach * 0.28));
}

// 酒場の看板娘ナビのセリフ。答えは言わず「次どうする？」と問いかけ、状況を整理して寄り添う。
function getConciergeLine() {
  const p = state.people;
  const ph = getPhase();
  const t = state.stats.trust;
  const r = state.weekResult;
  if (state.ended) return "おつかれさま！今回の航海、どうだった？";
  if (t < 25) return "最近お願いが続いてるみたい…酒場の空気、ちょっと心配かも。応援や感謝は足りてる？";
  if (r && r.tone === "bad") return "うーん、今の手はちょっと早かったかも。何が足りなかったと思う？";
  if (ph === "seed") {
    if (state.week === 1) return "ようこそBOOSTER酒場へ！まずは仲間と仲良くなるところから。今週はどう動く？";
    return "いい感じに土台ができてきたね。焦って告知したくなるけど…次はどこに力を入れる？";
  }
  if (ph === "bond") {
    if (p.crew >= 1) return `運営仲間が${p.crew}人になったね！この人たちと、本番に向けて何ができそう？`;
    return "興味を持ってくれた人が出てきたね。どうやって『仲間』になってもらおうか？";
  }
  if (state.stats.prep < 20 && p.attendees >= 8) return "人は集まってきたね！…でも当日、みんな満足してくれそう？準備のほうはどう？";
  if (state.week >= 12) return "いよいよ本番直前！やれること、ぜんぶやった？";
  return "本番が近いよ。集めることと、当日の準備…両方、進んでる？";
}

function getPhaseDescription() {
  if (getPhase() === "seed") return "まずは応援貯金。反応は「言葉の力×信頼残高」で決まる。";
  if (getPhase() === "bond") return "興味を、関わり方へのYESに変える。";
  return "仲間と連鎖の力で30人へ。反応をくれた人を次の主役に。";
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
      let lockReason = "";
      if (overMoney) lockReason = "💰 資金が足りません";
      else if (overTime) lockReason = "⏳ 今週の時間が足りません";
      const costLabel = `⏳${card.time || 0}${card.money ? ` 💰${card.money}` : ""}`;
      const tags = (cardEffect[card.id] || [])
        .map((t) => `<span class="tag ${t.includes("-") ? "tag-down" : "tag-up"}">${t}</span>`)
        .join("");
      return `
        <button class="card-button ${selected ? "selected" : ""}" ${disabled ? "disabled" : ""} data-card="${card.id}">
          <div class="card-top"><span class="card-icon">${card.icon}</span><span class="card-name">${card.title}</span><span class="card-cost">${costLabel}</span></div>
          <p class="card-text">${card.text}</p>
          ${lockReason ? `<p class="card-lock">${lockReason}</p>` : ""}
          <div class="card-tags">${tags}</div>
        </button>
      `;
    })
    .join("");

  els.cards.querySelectorAll("[data-card]").forEach((button) => {
    button.addEventListener("click", () => selectCard(button.dataset.card));
  });
}

function logTone(message) {
  if (/(薄|鈍|広がらな|反応はなかった|失敗|静かに|伸びは小さ|まだ|足りな|少なかった|尽き)/.test(message)) return "bad";
  if (/(つながった|変わり始め|広がって|深まった|生まれた|本気|証明|育|伸び|動き出す|押し出され|温まった)/.test(message)) return "good";
  return "";
}

function renderLog() {
  const visibleLog = state.currentWeekLog.length ? state.currentWeekLog : state.log.slice(-1);
  els.log.innerHTML = visibleLog
    .slice(0, 3)
    .map((message) => `<li class="${logTone(message)}">${message}</li>`)
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

  if (p.attendees >= 30 && getSatisfaction() < 40) {
    return {
      type: "集客先行・準備不足型",
      advice: "人は集まりましたが、本番の準備が薄く当日の満足度が伸びませんでした。次回は集客と並行して、進行・台本・おもてなしの準備（本番の準備カード）を進めましょう。",
    };
  }

  if (p.attendees >= 30 && state.stats.chain >= 40) {
    return {
      type: "連鎖点火型",
      advice: "反応者を次の主役にできています。連鎖係数Rが1を超えると集客は勝手に回り続けます。次は連鎖で来た人が『自分の企画』を持てるように応援すると、場そのものが増殖します。",
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

  if (state.stats.chain >= 40 && p.attendees >= 15) {
    return {
      type: "連鎖点火型",
      advice: "反応者を次の主役にする動きができています。連鎖係数Rが1を超えると集客は勝手に回り続けます。次は連鎖に火がつく前の土台（応援貯金・口コミ設計）を早めに仕込むと、30人の壁を連鎖が越えてくれます。",
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

// CTA設定。urlを入れると結果画面にボタンが出る（空なら非表示）。
// RSMフロントセミナー or BOOSTER導線のURLが決まったらここに1行入れるだけで開通する。
const CTA = {
  url: "",
  label: "この感覚、リアルの集客でやってみる →",
};
const NEXT_STEP_KEY = "booster-sim-nextstep-v1";

// 診断タイプ → RSM成長5フェーズ（出せる→磨ける→繋がる→連鎖する→育てる）のマッピング。
const rsmPhaseMap = {
  "土台づくり型": [1, "出せる"],
  "信頼残高ぎりぎり型": [1, "出せる"],
  "企画先行・関係性不足型": [2, "磨ける"],
  "関係性先行・企画磨き待ち型": [2, "磨ける"],
  "AI加速・人肌不足型": [2, "磨ける"],
  "集客先行・準備不足型": [2, "磨ける"],
  "一人で集めきり型": [3, "繋がる"],
  "運営候補育成型": [3, "繋がる"],
  "連鎖点火型": [4, "連鎖する"],
  "応援共創型": [5, "育てる"],
};

function getRsmPhaseLine(type) {
  const [num, name] = rsmPhaseMap[type] || [1, "出せる"];
  const ladder = ["出せる", "磨ける", "繋がる", "連鎖する", "育てる"]
    .map((n, i) => (i + 1 === num ? `【${n}】` : n))
    .join(" → ");
  return `RSM成長マップ: いまのあなたはフェーズ${num}「${name}」（${ladder}）／最終 連鎖係数R=${getChainR(state)}`;
}

function showResult() {
  const [rank, message] = getRank();
  const diagnosis = getDiagnosis();
  els.resultRank.textContent = rank;
  els.resultType.textContent = diagnosis.type;
  els.resultMessage.textContent = message;
  els.resultAdvice.textContent = diagnosis.advice;
  if (els.resultPhase) els.resultPhase.textContent = getRsmPhaseLine(diagnosis.type);
  els.finalAttendees.textContent = state.people.attendees;
  els.finalSupporters.textContent = state.people.supporters;
  els.finalCrew.textContent = state.people.crew;
  els.finalCore.textContent = state.people.core;
  if (els.resultNextHint) {
    els.resultNextHint.textContent = `あなたは「${diagnosis.type}」。これをゲームで終わらせないために —`;
  }
  if (els.nextStep) {
    try {
      els.nextStep.value = localStorage.getItem(NEXT_STEP_KEY) || "";
    } catch {}
  }
  if (els.ctaButton) {
    if (CTA.url) {
      els.ctaButton.href = CTA.url;
      els.ctaButton.textContent = CTA.label;
      els.ctaButton.hidden = false;
    } else {
      els.ctaButton.hidden = true;
    }
  }
  els.dialog.showModal();
}

async function copyResult() {
  const [rank, message] = getRank();
  const diagnosis = getDiagnosis();
  const myNext = els.nextStep ? els.nextStep.value.trim() : "";
  const text = [
    "応援共創シミュレーターをやってみました",
    `結果: ${rank}`,
    `タイプ: ${diagnosis.type}`,
    getRsmPhaseLine(diagnosis.type),
    `参加者: ${state.people.attendees}/30`,
    `応援者: ${state.people.supporters}/100`,
    `運営: ${state.people.crew}/3`,
    `コアメンバー: ${state.people.core}/3`,
    `コメント: ${message}`,
    `次のアドバイス: ${diagnosis.advice}`,
    myNext ? `\n私が今週やる一歩: ${myNext}` : "",
    "",
    "フィードバック観点:",
    "1. 面白かったところ",
    "2. わかりにくかったところ",
    "3. BOOSTERらしい/らしくないと感じたところ",
    "4. もう一度やりたいと思うか",
  ].filter((line) => line !== "").join("\n");

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

const SHARE_URL = "https://ooentakada.github.io/booster-simulator/";

const typeHook = {
  "応援共創型": "告知から始めちゃう人こそ遊んでほしい",
  "連鎖点火型": "自分が動かなくても人が集まる感覚、クセになる",
  "一人で集めきり型": "集客はできた。でも“みんなで”集める難しさを痛感",
  "信頼残高ぎりぎり型": "お願いばかりで信頼が枯れた…耳が痛い",
  "企画先行・関係性不足型": "企画が良くても人は動かない、を体感",
  "関係性先行・企画磨き待ち型": "応援される土台はある。あとは企画の言葉だ",
  "AI加速・人肌不足型": "AIで量産しても温度が足りない、を実感",
  "運営候補育成型": "一緒に動く仲間が生まれ始めた手応え",
  "土台づくり型": "まずは関係性の土台から。ここがスタート",
};

// シェア文言そのものを「ゆるぼ」の型にする。シェアが横連鎖の練習になる。
function buildShareText() {
  const [rank] = getRank();
  const d = getDiagnosis();
  const hook = typeHook[d.type] || "集客の考え方が5分で変わる";
  return `イベント集客ゲームで遊んだら【${rank}・${d.type}】だった🚢\n${hook}。\nこれリアルの集客でやったらけっこう怖いやつ…。誰か一緒に挑戦してみない？（ゆるぼ）`;
}

function shareToX() {
  const text = `${buildShareText()}\n#応援共創シミュレーター\n`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SHARE_URL)}`;
  window.open(intent, "_blank", "noopener");
}

const rankColor = {
  "Sランク": "#f3b546",
  "Aランク": "#4f8d5d",
  "Bランク": "#2f9aa0",
  "Cランク": "#cc6f2b",
  "Dランク": "#d95043",
};

// 診断タイプ別の"称号キャラ"
const typeBadge = {
  "応援共創型": { title: "みんなで航海するキャプテン", color: "#4f8d5d" },
  "連鎖点火型": { title: "連鎖を起こす仕掛け人", color: "#b0486e" },
  "一人で集めきり型": { title: "孤高のソロ船長", color: "#cc6f2b" },
  "信頼残高ぎりぎり型": { title: "飛ばしすぎた開拓者", color: "#d95043" },
  "企画先行・関係性不足型": { title: "アイデア先行の発明家", color: "#7b5fc6" },
  "関係性先行・企画磨き待ち型": { title: "人望あつめの世話役", color: "#2f9aa0" },
  "AI加速・人肌不足型": { title: "AI全開のテクノロジスト", color: "#2f9aa0" },
  "運営候補育成型": { title: "仲間を育てる兄貴肌・姉御肌", color: "#4f8d5d" },
  "土台づくり型": { title: "これから伸びる新米船長", color: "#8f563b" },
};

// ドット絵の仲間を1体描く。crown=コアメンバー(王冠)。
function drawSprite(ctx, x, y, s, shirt, crown) {
  const hair = "#3f2d2a";
  const skin = "#f0b783";
  ctx.fillStyle = hair;
  ctx.fillRect(x, y, 18 * s, 7 * s);
  ctx.fillStyle = skin;
  ctx.fillRect(x + 2 * s, y + 5 * s, 14 * s, 8 * s);
  ctx.fillStyle = shirt;
  ctx.fillRect(x, y + 13 * s, 18 * s, 11 * s);
  ctx.fillStyle = "#2e3f4f";
  ctx.fillRect(x + 3 * s, y + 24 * s, 4 * s, 5 * s);
  ctx.fillRect(x + 11 * s, y + 24 * s, 4 * s, 5 * s);
  if (crown) {
    ctx.fillStyle = "#f3b546";
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y + 1 * s);
    ctx.lineTo(x + 4 * s, y - 5 * s);
    ctx.lineTo(x + 9 * s, y + 1 * s);
    ctx.lineTo(x + 14 * s, y - 5 * s);
    ctx.lineTo(x + 17 * s, y + 1 * s);
    ctx.closePath();
    ctx.fill();
  }
}

// QRコードを描画（ライブラリが読めていれば）。成否を返す。
function drawQR(ctx, url, x, y, size) {
  try {
    if (typeof qrcode !== "function") return false;
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const n = qr.getModuleCount();
    const cell = size / n;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 10, y - 10, size + 20, size + 20);
    ctx.fillStyle = "#1d1d1f";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(x + c * cell, y + r * cell, cell + 0.6, cell + 0.6);
      }
    }
    return true;
  } catch {
    return false;
  }
}

function generateShareCard() {
  const [rank] = getRank();
  const d = getDiagnosis();
  const badge = typeBadge[d.type] || { title: d.type, color: "#4f8d5d" };
  const rColor = rankColor[rank] || "#4f8d5d";
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const font = '"Hiragino Sans", "Yu Gothic", system-ui, sans-serif';
  ctx.textBaseline = "middle";

  // 背景: 空→海
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#8fd0e0");
  sky.addColorStop(0.45, "#77bfd2");
  sky.addColorStop(0.46, "#e7c27a");
  sky.addColorStop(0.52, "#2f9aa0");
  sky.addColorStop(1, "#166a76");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 外枠
  ctx.strokeStyle = "#4f2f28";
  ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // 上部バー
  ctx.fillStyle = "#8f563b";
  ctx.fillRect(16, 16, W - 32, 76);
  ctx.fillStyle = "#fff2cf";
  ctx.font = `800 30px ${font}`;
  ctx.textAlign = "left";
  ctx.fillText("BOOSTER ｜ 応援共創シミュレーター", 44, 56);

  // 称号バナー
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff2cf";
  ctx.font = `800 30px ${font}`;
  ctx.fillText(`あなたは「${d.type}」`, W / 2, 150);
  ctx.fillStyle = badge.color;
  ctx.font = `900 56px ${font}`;
  ctx.fillText(badge.title, W / 2, 205);

  // ランク勲章（左上の円メダル）
  const mx = 165;
  const my = 320;
  const mr = 92;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fillStyle = rColor;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#fff2cf";
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `900 78px ${font}`;
  ctx.fillText(rank.replace("ランク", ""), mx, my + 4);
  ctx.font = `800 24px ${font}`;
  ctx.fillText("RANK", mx, my + 58);

  // 海に浮かぶ船＋甲板の仲間
  const deckY = 560;
  // 船体
  ctx.fillStyle = "#8f563b";
  ctx.strokeStyle = "#4f2f28";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(250, deckY);
  ctx.lineTo(830, deckY);
  ctx.lineTo(760, deckY + 110);
  ctx.lineTo(320, deckY + 110);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // マスト＋帆（帆は高めにして甲板の仲間を隠さない）
  ctx.fillStyle = "#4f2f28";
  ctx.fillRect(536, deckY - 230, 10, 230);
  ctx.fillStyle = "#fff4dc";
  ctx.strokeStyle = "#4f2f28";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(548, deckY - 225);
  ctx.lineTo(672, deckY - 180);
  ctx.lineTo(548, deckY - 110);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 甲板に仲間スプライトを並べる（コア=王冠/運営/応援者の代表）
  const shirts = ["#d95043", "#2f9aa0", "#4f8d5d", "#f3b546", "#7b5fc6", "#cc6f2b"];
  const crew = state.people.crew;
  const core = state.people.core;
  const supDisplay = Math.min(10, Math.ceil(state.people.supporters / 12));
  const people = [];
  for (let i = 0; i < Math.min(core, 4); i++) people.push({ crown: true, big: true });
  for (let i = 0; i < Math.min(crew, 7); i++) people.push({ crown: false, big: true });
  for (let i = 0; i < supDisplay; i++) people.push({ crown: false, big: false });
  // 後列（応援者・小）
  let sx = 300;
  people.filter((p) => !p.big).forEach((p, i) => {
    drawSprite(ctx, sx + i * 50, deckY - 78, 1.9, shirts[(i + 2) % shirts.length], false);
  });
  // 前列（コア・運営・大）
  const bigs = people.filter((p) => p.big);
  const startX = W / 2 - (bigs.length * 64) / 2;
  bigs.forEach((p, i) => {
    drawSprite(ctx, startX + i * 64, deckY - 18, 2.7, p.crown ? "#f3b546" : shirts[i % shirts.length], p.crown);
  });

  // 数字パネル（4指標）
  const stats = [
    ["参加者", `${state.people.attendees}`],
    ["応援者", `${state.people.supporters}`],
    ["運営", `${state.people.crew}`],
    ["コア", `${state.people.core}`],
  ];
  const boxW = 232;
  const gap = 20;
  const totalW = boxW * 4 + gap * 3;
  let bx = (W - totalW) / 2;
  const by = 752;
  stats.forEach(([label, val]) => {
    ctx.fillStyle = "#fff8df";
    ctx.fillRect(bx, by, boxW, 116);
    ctx.strokeStyle = "rgba(79,47,40,0.45)";
    ctx.lineWidth = 5;
    ctx.strokeRect(bx, by, boxW, 116);
    ctx.fillStyle = "#6f4f2f";
    ctx.font = `800 28px ${font}`;
    ctx.fillText(label, bx + boxW / 2, by + 34);
    ctx.fillStyle = "#2b2118";
    ctx.font = `900 54px ${font}`;
    ctx.fillText(val, bx + boxW / 2, by + 80);
    bx += boxW + gap;
  });

  // 一言フック
  ctx.fillStyle = "#2b2118";
  ctx.font = `800 32px ${font}`;
  const hook = typeHook[d.type] || "集客の考え方が5分で変わる";
  ctx.fillText(hook, W / 2 - 70, 928);

  // 煽り＋URL（左下）
  ctx.textAlign = "left";
  ctx.fillStyle = "#2b2118";
  ctx.font = `900 34px ${font}`;
  ctx.fillText("あなたは何人、仲間と集められる？", 60, 990);
  ctx.fillStyle = "#3a3027";
  ctx.font = `700 26px ${font}`;
  ctx.fillText("ooentakada.github.io/booster-simulator", 60, 1030);

  // QRコード（右下）
  drawQR(ctx, SHARE_URL, W - 190, H - 200, 150);

  return canvas;
}

function shareImage() {
  const canvas = generateShareCard();
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], "booster-result.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: buildShareText() });
        return;
      } catch {}
    }
    const url = URL.createObjectURL(blob);
    if (els.sharePreview) els.sharePreview.src = url;
    if (els.shareDownload) els.shareDownload.href = url;
    if (els.sharePreviewWrap) els.sharePreviewWrap.hidden = false;
  }, "image/png");
}

function resetGame() {
  clearSave();
  state = structuredClone(initialState);
  drawHand();
  els.copyStatus.textContent = "";
  if (els.sharePreviewWrap) els.sharePreviewWrap.hidden = true;
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
if (els.shareX) els.shareX.addEventListener("click", shareToX);
if (els.shareImage) els.shareImage.addEventListener("click", shareImage);
if (els.nextStep) {
  els.nextStep.addEventListener("input", () => {
    try {
      localStorage.setItem(NEXT_STEP_KEY, els.nextStep.value);
    } catch {}
  });
}

render();
maybeShowIntroOnLoad();
if (state.ended) showResult();
