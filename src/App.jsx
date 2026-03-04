import { useState, useCallback, useRef, useEffect } from 'react'
import './App.css'

// ═══════════════════════════════════════════════════════════
//  市场等级配置
// ═══════════════════════════════════════════════════════════
const MARKET_LEVELS = [
  { level:1, name:'路边摊',     icon:'🛖', color:'#94a3b8', accentColor:'#475569', upgradeCost:0,        slotCount:3, refreshCost:10000,  allowedQualities:['common'],                              desc:'只有普通场口的碎料',          unlockTip:'初始档位' },
  { level:2, name:'小型毛料行', icon:'🏚️', color:'#4ade80', accentColor:'#166534', upgradeCost:200000,  slotCount:4, refreshCost:15000,  allowedQualities:['common','uncommon'],                   desc:'进货渠道改善，良品料偶尔现身', unlockTip:'解锁良品原石' },
  { level:3, name:'翡翠批发市场',icon:'🏪', color:'#60a5fa', accentColor:'#1e3a8a', upgradeCost:750000,  slotCount:5, refreshCost:25000,  allowedQualities:['common','uncommon','rare'],            desc:'与缅甸矿主建立合作，精品料入场',unlockTip:'解锁精品原石' },
  { level:4, name:'公盘竞拍行', icon:'🏛️', color:'#c084fc', accentColor:'#581c87', upgradeCost:2500000, slotCount:6, refreshCost:50000,  allowedQualities:['common','uncommon','rare','epic'],     desc:'参与缅甸国家公盘',             unlockTip:'解锁极品原石' },
  { level:5, name:'秘境矿脉',   icon:'👑', color:'#fbbf24', accentColor:'#78350f', upgradeCost:7500000,  slotCount:7, refreshCost:100000, allowedQualities:['common','uncommon','rare','epic','legendary'], desc:'掌握传说级矿脉', unlockTip:'解锁传说原石' },
]

// ═══════════════════════════════════════════════════════════
//  剧本模式配置（Roguelike 风格）
// ═══════════════════════════════════════════════════════════
// 每个模式定义：名称、最大天数（null=无尽）、债务时间表
// 债务表：每到指定 day，需要支付 amount，否则 Game Over
const SAVE_KEY = 'jadetycoon_save'

const SCRIPT_MODES = {
  sprint100: {
    key: 'sprint100',
    name: '绝命狂飙（100天）',
    desc: '100 天高压还债模式，每 10 天需还款 ¥100,000，固定压力。',
    maxDay: 100,
    debts: [
      { day:10,  amount: 100000 },
      { day:20,  amount: 100000 },
      { day:30,  amount: 100000 },
      { day:40,  amount: 100000 },
      { day:50,  amount: 100000 },
      { day:60,  amount: 100000 },
      { day:70,  amount: 100000 },
      { day:80,  amount: 100000 },
      { day:90,  amount: 100000 },
      { day:100, amount: 100000 },
    ],
  },
  tycoon300: {
    key: 'tycoon300',
    name: '大亨崛起（300天）',
    desc: '300 天长线经营，每 30 天一轮大额结算，考验滚雪球能力。',
    maxDay: 300,
    debts: [
      { day:30,  amount:  400000 },
      { day:60,  amount: 1000000 },
      { day:90,  amount: 2000000 },
      { day:120, amount: 3500000 },
      { day:150, amount: 5500000 },
      { day:180, amount: 8000000 },
      { day:210, amount: 11000000 },
      { day:240, amount: 14500000 },
      { day:270, amount: 18500000 },
      { day:300, amount: 23000000 },
    ],
  },
  sandbox: {
    key: 'sandbox',
    name: '无尽沙盒',
    desc: '没有债务与天数限制，自由体验买卖与收藏。',
    maxDay: null,
    debts: [],
  },
}

// ═══════════════════════════════════════════════════════════
//  每日随机事件池（Roguelike）
//  modifiers: marketPrice(原石价倍率), npcOffer(NPC出价倍率), cutQuality(冰/玻璃/帝王概率加成), brickDetect(砖头察觉倍率)
//  immediateEffect: 确认时立刻触发，如 cashSteal(偷走金额)
// ═══════════════════════════════════════════════════════════
const EVENT_TRIGGER_CHANCE = 0.15

const EVENT_POOL_POSITIVE = [
  { id:'half_price',    name:'全场半价',         type:'positive', icon:'💰', desc:'市场原石全部半价！',  modifiers:{ marketPrice:0.5 }, duration:[1,2] },
  { id:'npc_boost_30',  name:'NPC收购热潮',      type:'positive', icon:'🤝', desc:'所有NPC出价+30%',     modifiers:{ npcOffer:1.3 }, duration:[2,3] },
  { id:'npc_boost_50',  name:'翡翠抢手',         type:'positive', icon:'📈', desc:'所有NPC出价+50%',     modifiers:{ npcOffer:1.5 }, duration:[1,2] },
  { id:'strong_light',  name:'强光手电加持',     type:'positive', icon:'🔦', desc:'冰种/玻璃/帝王绿概率显著提升', modifiers:{ cutQuality:0.08 }, duration:[2,3] },
  { id:'jade_vision',   name:'翡翠慧眼',         type:'positive', icon:'👁', desc:'切割高品质概率+10%', modifiers:{ cutQuality:0.10 }, duration:[1,2] },
  { id:'lucky_day',     name:'黄道吉日',         type:'positive', icon:'🍀', desc:'切割品质+6%，NPC+15%', modifiers:{ cutQuality:0.06, npcOffer:1.15 }, duration:[1,2] },
  { id:'wholesale',     name:'批发大促',         type:'positive', icon:'🏷', desc:'原石8折',             modifiers:{ marketPrice:0.8 }, duration:[2,3] },
  { id:'boss_visit',    name:'大客户来访',       type:'positive', icon:'👔', desc:'NPC出价+25%',        modifiers:{ npcOffer:1.25 }, duration:[2,2] },
  { id:'miner_discount',name:'矿主清仓',        type:'positive', icon:'⛏', desc:'原石7折',             modifiers:{ marketPrice:0.7 }, duration:[1,1] },
  { id:'auction_fever', name:'拍卖会预热',       type:'positive', icon:'🔨', desc:'NPC出价+40%',        modifiers:{ npcOffer:1.4 }, duration:[1,2] },
  { id:'crystal_aura',  name:'晶石灵气',        type:'positive', icon:'✨', desc:'高品质切割概率+7%',  modifiers:{ cutQuality:0.07 }, duration:[2,3] },
  { id:'spring_sale',   name:'春季大促',        type:'positive', icon:'🌸', desc:'原石9折',             modifiers:{ marketPrice:0.9 }, duration:[3,3] },
  { id:'gem_rush',      name:'宝石热',          type:'positive', icon:'💎', desc:'切割+5%，NPC+20%',   modifiers:{ cutQuality:0.05, npcOffer:1.2 }, duration:[2,3] },
  { id:'night_market',  name:'夜市特惠',        type:'positive', icon:'🌙', desc:'原石6折',             modifiers:{ marketPrice:0.6 }, duration:[1,2] },
  { id:'master_hand',   name:'大师加持',        type:'positive', icon:'🙏', desc:'高品质切割+9%',      modifiers:{ cutQuality:0.09 }, duration:[1,1] },
  { id:'collector_mode',name:'藏家扫货',        type:'positive', icon:'🎩', desc:'NPC出价+35%',        modifiers:{ npcOffer:1.35 }, duration:[2,2] },
  { id:'jade_rain',    name:'翡翠雨',           type:'positive', icon:'🌧', desc:'原石85折，切割+4%',  modifiers:{ marketPrice:0.85, cutQuality:0.04 }, duration:[2,3] },
  { id:'fortune_777',   name:'七喜临门',        type:'positive', icon:'7️⃣', desc:'全效果微增：原石95折、切割+3%、NPC+10%', modifiers:{ marketPrice:0.95, cutQuality:0.03, npcOffer:1.1 }, duration:[2,3] },
  { id:'dragon_breath', name:'龙息加持',        type:'positive', icon:'🐉', desc:'帝王绿概率+12%',     modifiers:{ cutQuality:0.12 }, duration:[1,2] },
  { id:'phoenix_rise',  name:'凤凰涅槃',        type:'positive', icon:'🦅', desc:'冰种以上概率+11%，NPC+18%', modifiers:{ cutQuality:0.11, npcOffer:1.18 }, duration:[2,2] },
]

const EVENT_POOL_NEGATIVE = [
  { id:'market_inspect', name:'市场查假',        type:'negative', icon:'👮', desc:'卖砖头料给NPC时，被识破概率翻倍', modifiers:{ brickDetect:2 }, duration:[2,3] },
  { id:'thief',         name:'小偷偷钱',        type:'negative', icon:'🧹', desc:'小偷光顾！损失当前资金的15%', immediateEffect:{ cashStealPct:0.15 }, duration:[1,1] },
  { id:'brick_paranoia',name:'砖头恐慌',        type:'negative', icon:'😰', desc:'砖头料察觉率+50%',   modifiers:{ brickDetect:1.5 }, duration:[1,2] },
  { id:'price_hike',    name:'原石涨价',        type:'negative', icon:'📉', desc:'市场原石涨价20%',   modifiers:{ marketPrice:1.2 }, duration:[2,3] },
  { id:'npc_cold',      name:'NPC观望',         type:'negative', icon:'😐', desc:'NPC出价-20%',       modifiers:{ npcOffer:0.8 }, duration:[1,2] },
  { id:'thief_fixed',   name:'盗贼光顾',        type:'negative', icon:'👤', desc:'被偷走¥3000',      immediateEffect:{ cashSteal:3000 }, duration:[1,1] },
  { id:'fog_vision',    name:'雾里看花',        type:'negative', icon:'🌫', desc:'切割高品质概率-5%', modifiers:{ cutQuality:-0.05 }, duration:[2,2] },
  { id:'market_slump',  name:'市场低迷',        type:'negative', icon:'📊', desc:'NPC出价-15%',       modifiers:{ npcOffer:0.85 }, duration:[1,3] },
  { id:'crack_down',    name:'严查砖头',        type:'negative', icon:'🔍', desc:'砖头料察觉率×2.5',  modifiers:{ brickDetect:2.5 }, duration:[1,1] },
  { id:'expensive_day', name:'物价飞涨',        type:'negative', icon:'💸', desc:'原石涨价15%',       modifiers:{ marketPrice:1.15 }, duration:[2,2] },
  { id:'npc_skep',     name:'NPC谨慎',          type:'negative', icon:'🤨', desc:'NPC出价-25%',       modifiers:{ npcOffer:0.75 }, duration:[1,2] },
  { id:'dim_light',     name:'光线昏暗',        type:'negative', icon:'🕯', desc:'高品质切割概率-6%', modifiers:{ cutQuality:-0.06 }, duration:[2,3] },
]

// ═══════════════════════════════════════════════════════════
//  局内遗物/道具（Relics）- 神秘黑市购买，当局生效
//  每逢以 5 结尾的天数（5,15,25...）右下角弹出黑市按钮
// ═══════════════════════════════════════════════════════════
const RELICS = {
  purple_flashlight: {
    id: 'purple_flashlight',
    name: '紫光手电',
    icon: '🔮',
    desc: '切出砖头料的概率硬性降低 10%',
    price: 125000,
    effect: 'brickReduce',
  },
  silver_tongue: {
    id: 'silver_tongue',
    name: '巧舌如簧',
    icon: '💬',
    desc: '卖砖头料被识破时，好感度下降减半',
    price: 100000,
    effect: 'detectPenaltyHalf',
  },
  gold_knife: {
    id: 'gold_knife',
    name: '镶金切刀',
    icon: '🔪',
    desc: '所有切出结果的基础估值 ×1.2',
    price: 150000,
    effect: 'cutValueBoost',
  },
}
const RELIC_IDS = Object.keys(RELICS)

// ═══════════════════════════════════════════════════════════
//  直播间配置：开启/升级，用于销售切出的翡翠
// ═══════════════════════════════════════════════════════════
const LIVE_STREAM_LEVELS = [
  { level:0, name:'未开启', cost:0, desc:'暂无直播间' },
  { level:1, name:'初级直播间', cost:150000, desc:'可开播，20名观众入场', slotCount:5 },
  { level:2, name:'中级直播间', cost:400000, desc:'观众消费意愿+10%', slotCount:8 },
  { level:3, name:'高级直播间', cost:900000, desc:'观众消费意愿+25%，可连播', slotCount:12 },
]

// ═══════════════════════════════════════════════════════════
//  专属雕刻大师（艺术家脾气与灵感博弈）
// ═══════════════════════════════════════════════════════════
const FLAW_AFFIXES = ['heavy_crack','dead_癣','rough_bark','mud_skin','foggy_inside']  // 鬼手偏好：带裂/癣
const RED_OR_FLOWER = ['flower']  // 枯木禅师不雕：花青(多色/见血)
const CHU_HATE = ['brick','waxy']  // 褚石翁极度嫌弃
const CHU_LOVE = ['glass','imperial']  // 褚石翁偏爱

const ARTIST_MASTERS = [
  { id:'chu_shi_weng', name:'褚石翁', icon:'🎎', title:'非遗宗师', personality:'高傲古板',
    hateGrades: CHU_HATE, loveGrades: CHU_LOVE, specialty:'山水大牌、传世玉玺',
    skillName:'点石成金', skillDesc:'加工极品料时概率刻出传世之作(x10)，全市NPC涨好感',
    skillChance: 0.15, skillMult: 10,
    interactCosts: { dahongpao: 25000, weiqi: 0 }, interactGains: { dahongpao: 50, weiqi: 40 },
  },
  { id:'gui_shou_a9', name:'鬼手·阿九', icon:'💀', title:'疯子天才', personality:'废土朋克',
    loveFlaw: true, specialty:'猎奇骷髅雕件、化瑕为瑜',
    skillName:'灵光乍现', skillDesc:'带裂/癣料子：40%碎料血亏，10%绝世妖孽(x30)',
    crushChance: 0.4, jackpotChance: 0.1, jackpotMult: 30,
    interactCosts: { qingba: 12000, baijiu: 0 }, interactGains: { qingba: 60, baijiu: 100 },
    sickDays: 3,
  },
  { id:'qiao_niang_jinyan', name:'巧娘·金燕', icon:'💰', title:'商业奇才', personality:'见钱眼开',
    noPreference: true, specialty:'流水线手镯、戒面、珠串',
    skillName:'极限压榨', skillDesc:'必定多掏2戒面，无风险，倍率上限2x',
    maxMult: 2, extraRings: 2,
    interactCosts: { hongbao: 50000 }, interactGains: { hongbao: 100 },
  },
  { id:'kumu_chan_shi', name:'枯木禅师', icon:'🧘', title:'佛系高僧', personality:'随缘',
    acceptGrades: ['waxy','ice','glass','imperial'], rejectGrades: RED_OR_FLOWER,
    specialty:'观音、佛公', noRed: true,
    skillName:'佛光开光', skillDesc:'需3天取货，成品带开光词缀，文化/市井NPC出价3x',
    deliveryDays: 3, kaiguangMult: 3,
    interactCosts: { xianghuo: 8000, chanzhen: 0 }, interactGains: { xianghuo: 45, chanzhen: 35 },
  },
  { id:'kuai_shou_laotie', name:'快手·老铁', icon:'⚡', title:'效率王', personality:'雷厉风行',
    noPreference: true, specialty:'快速手镯、戒面',
    skillName:'闪电出活', skillDesc:'不挑料，秒出活，倍率稳定 1.2x',
    baseMult: 1.2,
    interactCosts: { kafei: 3000 }, interactGains: { kafei: 30 },
  },
  { id:'men_sao_ajie', name:'闷骚·阿杰', icon:'😶', title:'冰料专精', personality:'内敛挑剔',
    acceptGrades: ['ice','glass','imperial'], specialty:'冰种观音、玻璃佛',
    skillName:'静水深流', skillDesc:'只雕冰种以上，成品 1.3~1.6x 看心情',
    baseMult: [1.3, 1.6],
    interactCosts: { chabei: 5000 }, interactGains: { chabei: 40 },
  },
  { id:'hua_lao_wang', name:'话痨·王大嘴', icon:'🗣', title:'全能唠嗑', personality:'热情健谈',
    noPreference: true, specialty:'什么都雕，边雕边聊',
    skillName:'随缘加成', skillDesc:'给啥雕啥，成品 0.9~1.5x 随机波动',
    baseMult: [0.9, 1.5],
    interactCosts: { laopi: 8000 }, interactGains: { laopi: 50 },
  },
  { id:'du_tu_daobai', name:'赌徒·刀疤', icon:'🎲', title:'冒险狂人', personality:'冒险激进',
    noPreference: true, specialty:'赌石雕，不成功便成仁',
    skillName:'梭哈一击', skillDesc:'30%血亏(0.5x)，20%暴击(3x)，50%正常',
    gambleChance: 0.3, gambleMult: 0.5, jackpotChance: 0.2, jackpotMult: 3,
    interactCosts: { maotai: 18000 }, interactGains: { maotai: 70 },
  },
  { id:'yang_sheng_lishu', name:'养生·李叔', icon:'☕', title:'午休大师', personality:'佛系养生',
    noPreference: true, specialty:'精品小件，每天只接一单',
    skillName:'精雕细琢', skillDesc:'每天限1单，倍率 1.4x 稳',
    baseMult: 1.4, dailyLimit: 1,
    interactCosts: { hongzao: 4000 }, interactGains: { hongzao: 35 },
  },
  { id:'wanmei_sujie', name:'完美主义·苏姐', icon:'✨', title:'吹毛求疵', personality:'挑剔完美',
    acceptGrades: ['glass','imperial'], rejectGrades: ['brick','waxy','flower'],
    specialty:'无瑕观音、极品摆件',
    skillName:'零瑕疵', skillDesc:'只接玻璃/帝王，成品必 1.5x 起',
    baseMult: [1.5, 1.8],
    interactCosts: { xiangnai: 12000 }, interactGains: { xiangnai: 55 },
  },
  { id:'xue_tu_xiaodou', name:'学徒·小豆', icon:'🌱', title:'勤奋新手', personality:'勤奋好学',
    noPreference: true, specialty:'练手料、便宜盘货',
    skillName:'成长波动', skillDesc:'工费低，成品 0.8~1.3x 波动大',
    baseMult: [0.8, 1.3], laborFeePct: 0.03,
    interactCosts: { keben: 2000 }, interactGains: { keben: 25 },
  },
  { id:'shenmi_ying', name:'神秘·影', icon:'🌑', title:'暗影雕师', personality:'神秘莫测',
    noPreference: true, specialty:'随机风格，随机结果',
    skillName:'混沌之手', skillDesc:'完全随机，0.5x~2.5x 开盲盒',
    baseMult: [0.5, 2.5],
    interactCosts: { mima: 15000 }, interactGains: { mima: 60 },
  },
]

// 兼容旧代码：CarvingModal 等仍引用 CARVING_MASTERS 时使用
const CARVING_MASTERS = ARTIST_MASTERS
function getCarvingMasterLevel(deals) { return Math.min(3, Math.floor((deals || 0) / 5)) }
function computeCarvingBoost(master, cutResultId) {
  if (master.id === 'qiao_niang_jinyan') return 2
  if (master.id === 'chu_shi_weng') {
    if (CHU_HATE.includes(cutResultId)) return 0
    return CHU_LOVE.includes(cutResultId) ? rnd(1.4, 1.8) : rnd(1.1, 1.4)
  }
  if (master.id === 'gui_shou_a9') return rnd(0.8, 1.5)  // 由灵光乍现单独处理
  if (master.id === 'kumu_chan_shi') return rnd(1.2, 1.6)
  return 1.2
}

// ═══════════════════════════════════════════════════════════
//  20 名直播间观众：好感度影响消费意愿
// ═══════════════════════════════════════════════════════════
const LIVE_VIEWERS = [
  { id:'viewer_1', name:'翠迷小王', icon:'👤', baseWillingness:0.7 },
  { id:'viewer_2', name:'玉姐', icon:'👩', baseWillingness:0.65 },
  { id:'viewer_3', name:'收藏家老林', icon:'👨', baseWillingness:0.8 },
  { id:'viewer_4', name:'小白新手', icon:'🧑', baseWillingness:0.5 },
  { id:'viewer_5', name:'土豪阿明', icon:'💰', baseWillingness:0.9 },
  { id:'viewer_6', name:'行家老陈', icon:'👴', baseWillingness:0.75 },
  { id:'viewer_7', name:'学生小美', icon:'👧', baseWillingness:0.45 },
  { id:'viewer_8', name:'珠宝店老板', icon:'🏪', baseWillingness:0.85 },
  { id:'viewer_9', name:'路人甲', icon:'🙂', baseWillingness:0.55 },
  { id:'viewer_10', name:'网红主播', icon:'📱', baseWillingness:0.7 },
  { id:'viewer_11', name:'赌石狂人', icon:'🎲', baseWillingness:0.95 },
  { id:'viewer_12', name:'低调富豪', icon:'🕴️', baseWillingness:0.6 },
  { id:'viewer_13', name:'翡翠发烧友', icon:'💎', baseWillingness:0.88 },
  { id:'viewer_14', name:'萌新观望', icon:'👀', baseWillingness:0.4 },
  { id:'viewer_15', name:'老主顾阿强', icon:'🤝', baseWillingness:0.82 },
  { id:'viewer_16', name:'宝妈翠翠', icon:'👩', baseWillingness:0.58 },
  { id:'viewer_17', name:'企业家老李', icon:'👔', baseWillingness:0.78 },
  { id:'viewer_18', name:'好奇宝宝', icon:'👶', baseWillingness:0.35 },
  { id:'viewer_19', name:'专业买手', icon:'📋', baseWillingness:0.9 },
  { id:'viewer_20', name:'佛系观众', icon:'😌', baseWillingness:0.5 },
]

// ═══════════════════════════════════════════════════════════
//  手机私信：对话树 { id, npcId, type, msg, options: [{ text, affinityDelta, nextId? }] }
// ═══════════════════════════════════════════════════════════
const PHONE_MSG_CHANCE = 0.25
const PHONE_MSG_STARTERS = ['borrow_1','gossip_1','order_1','gossip_2']
const PHONE_MSG_POOL = [
  { id:'borrow_1', npcId:'lao_wang', type:'borrow', msg:'兄弟，手头紧，能借我5000周转一下吗？三天后还你。', options:[
    { text:'没问题，拿去用', affinityDelta:2, nextId:'borrow_1_ok', reply:'小事一桩！' },
    { text:'不好意思，最近也紧张', affinityDelta:-1, nextId:null, reply:'理解理解...' },
  ]},
  { id:'borrow_1_ok', npcId:'lao_wang', type:'borrow', msg:'太感谢了！三天后一定还！', options:[{ text:'[结束]', affinityDelta:0, nextId:null, reply:'' }]},
  { id:'gossip_1', npcId:'xiao_mei', type:'gossip', msg:'听说最近缅甸那边矿难，好料要涨价了！你囤货了吗？', options:[
    { text:'早囤了，谢啦', affinityDelta:1, nextId:null, reply:'哈哈行家！' },
    { text:'没呢，马上去看看', affinityDelta:0, nextId:null, reply:'快去快去~' },
  ]},
  { id:'order_1', npcId:'master_chen', type:'order', msg:'有一单冰种观音，客户指定要，你那边有货吗？有的话我溢价15%收。', options:[
    { text:'有，明天带来', affinityDelta:3, nextId:null, reply:'好，等你' },
    { text:'暂时没有', affinityDelta:0, nextId:null, reply:'有了联系我' },
  ]},
  { id:'gossip_2', npcId:'influencer', type:'gossip', msg:'最近直播数据下滑，想搞个切石专场，你这边能赞助几块公斤料不？', options:[
    { text:'可以，送你两块', affinityDelta:2, nextId:null, reply:'够意思！' },
    { text:'下次吧', affinityDelta:-1, nextId:null, reply:'行吧...' },
  ]},
]

// ═══════════════════════════════════════════════════════════
//  雕刻老陈：常驻员工，明料→高溢价成品
// ═══════════════════════════════════════════════════════════
const LAO_CHEN = {
  energyMax: 100,
  inspirationMax: 100,
  energyPerDay: 20,
  inspirationDecay: 5,
  nightSnackCost: 8000,
  nightSnackEnergy: 40,
  clubCost: 35000,
  clubInspiration: 100,
  masterpieceInspirationMin: 80,
  masterpieceChance: 0.4,
  masterpieceSuccessRate: 0.5,
  masterpieceMultiplier: 2.5,
}

// ═══════════════════════════════════════════════════════════
//  直播切石
// ═══════════════════════════════════════════════════════════
const LIVESTREAM_CUT = {
  hypeMax: 100,
  hypeCutSuccessAdd: 25,
  hypeCutFailSub: 20,
  hypeGiftAdd: 50,
  hypeFullDaysForBangYige: 3,
  hypeFullDaysForBoss: 3,
  tipPerHypeCutSuccess: 800,
  tipPerHypeCutFail: 100,
}
const BARRAGE_CUT_SUCCESS = ['牛逼！','涨了涨了！','主播666','打赏走起','值了值了','这料绝了']
const BARRAGE_CUT_FAIL = ['退钱！','主播又在坑人','就这？','翻车了','血亏','取关取关']
const WORKBENCH_MAX_VISIBLE = 8  // 工作台最多显示 2 排（每排约 4 块），超出移入 LOG

function computeModifiers(activeEffects) {
  const m = { marketPrice:1, npcOffer:1, cutQuality:0, brickDetect:1 }
  ;(activeEffects || []).forEach(e => {
    if (e.modifiers?.marketPrice) m.marketPrice *= e.modifiers.marketPrice
    if (e.modifiers?.npcOffer) m.npcOffer *= e.modifiers.npcOffer
    if (e.modifiers?.cutQuality) m.cutQuality += e.modifiers.cutQuality
    if (e.modifiers?.brickDetect) m.brickDetect *= e.modifiers.brickDetect
  })
  return m
}

// ═══════════════════════════════════════════════════════════
//  NPC 等级配置（通用）
// ═══════════════════════════════════════════════════════════
// expNeeded[i] = 升到第 i+1 级所需的累计交易次数
const NPC_EXP_TABLE = [0, 3, 8, 18, 35]  // Lv1→Lv2需3次，Lv2→Lv3需8次...

const NPC_LEVEL_NAMES = ['陌生人','熟客','老朋友','挚友','灵魂伙伴']
const NPC_LEVEL_COLORS= ['#64748b','#4ade80','#60a5fa','#c084fc','#fbbf24']
const NPC_LEVEL_ICONS = ['🤝','😊','😄','🤗','💎']

// 默认技能树（出价加成，多数NPC使用）
const DEFAULT_OFFER_SKILL_TREE = [
  { lv: 1, type: 'offer', value: 0.05, desc: '出价提升 5%' },
  { lv: 2, type: 'offer', value: 0.12, desc: '出价提升 12%，解锁专属对话' },
  { lv: 3, type: 'offer', value: 0.20, desc: '出价提升 20%，偶尔主动找你回购' },
  { lv: 4, type: 'offer', value: 0.30, desc: '出价提升 30%，解锁独家内幕料' },
]
// 从 NPC 技能树获取出价倍率（仅 type:'offer' 的 value 累乘为 offerMultiplier，无 level perks）
function getNpcOfferModifiers(npc, lv) {
  const tree = npc.skillTree || DEFAULT_OFFER_SKILL_TREE
  const offerSkills = tree.filter(s => s.type === 'offer' && s.lv <= lv)
  const offerMultiplier = offerSkills.length
    ? offerSkills.reduce((acc, s) => acc * (1 + (s.value ?? 0)), 1)
    : 1
  const last = offerSkills.length ? offerSkills.reduce((a, b) => (b.lv > a.lv ? b : a), offerSkills[0]) : null
  return { offerMultiplier, perk: last?.desc ?? null }
}
// 按技能类型与等级取数值（取满足 lv<=npcLv 的最高等级技能 value）
function getNpcSkillValue(npc, skillType, npcLv) {
  const tree = npc?.skillTree
  if (!tree) return undefined
  const matches = tree.filter(s => s.type === skillType && s.lv <= npcLv)
  if (!matches.length) return undefined
  const top = matches.reduce((a, b) => (b.lv > a.lv ? b : a), matches[0])
  return top.value
}
// 获取NPC指定等级的 perk 描述（用于 UI，多个技能用空格连接）
function getNpcPerkDesc(npc, lv) {
  const tree = npc.skillTree || DEFAULT_OFFER_SKILL_TREE
  const skills = tree.filter(x => x.lv === lv)
  if (!skills.length) return null
  return skills.map(s => s.desc).join('　')
}

// ═══════════════════════════════════════════════════════════
//  NPC 数据库（24 位）
//  detectChance: 卖砖头料时被察觉的概率（0~1）
//  detectPenalty: 被察觉后扣除的好感度点数（会触发降级）
//  砖头料(brick)所有NPC都能收，但各有察觉风险
// ═══════════════════════════════════════════════════════════
const NPC_LIST = [
  /* ──────── 普通买家 ──────── */
  {
    id: 'lao_wang', name: '老王', fullName: '王建国',
    role: '珠宝批发商', icon: '👔', color: '#fbbf24',
    personality: ['稳重', '务实', '守信'],
    affinity: '偏好糯种·花青', affinityGrades: ['waxy','flower'], affinityBonus: 0.15,
    desc: '从业三十年老行家，出价不高不低，但从不爽约',
    bonusRange: [0.90, 1.20], minGrade: 'brick',
    detectChance: 0.35, detectPenalty: 3,
    dialogs: [
      ['行情就是这样，这个价成不成？', '你的料我看了，普普通通，按市价来。'],
      ['你又来了，上次那批料不错！', '老主顾嘛，价格好商量，走个实惠。'],
      ['哎老朋友，给你加一成！', '老朋友带来的，价格给你放开。'],
      ['就等你这批！上次那块冰种大家都夸。', '老搭档，品质才是关键，你懂的。'],
      ['你就是我的御用供货商！', '灵魂伙伴了！最好的资源都留给你！'],
    ],
    detectDialogs: ['这…这是砖头料吧？我从业三十年，骗不了我！','什么东西！你拿垃圾糊弄我？','哼，下次别来了！'],
    levelUpLines: ['合作次数多了，彼此了解更深了。','你是个可靠的人，以后多合作。','朋友之间不用客气。','你是我最信任的供货商！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '买低级原石一律 9 折' },
      { lv: 2, type: 'lowTierDiscount', value: 0.9, desc: '每 5 天送你一块随机低级原石' },
      { lv: 3, type: 'brickComfortMoney', value: 1, desc: '卖砖头料给他不仅不掉好感，还会给安慰金' },
    ],
  },
  {
    id: 'xiao_mei', name: '小美', fullName: '陈美玲',
    role: '直播带货主播', icon: '📱', color: '#e879f9',
    personality: ['热情', '冲动', '爱颜值'],
    affinity: '偏好花青·冰种', affinityGrades: ['flower','ice'], affinityBonus: 0.20,
    desc: '粉丝三百万的翡翠主播，专挑颜色漂亮的，价格随心情',
    bonusRange: [0.80, 1.80], minGrade: 'brick',
    detectChance: 0.25, detectPenalty: 4,
    dialogs: [
      ['哇颜色绝了！粉丝肯定爱！多少钱？', '就这块了，镜头效果好就行。'],
      ['宝子们看过来！老朋友又带好货来了！', '上次直播反应超好，今天要多几块！'],
      ['每次你来直播数据都爆！', '我帮你宣传，你给我优惠，互利共赢！'],
      ['挚友！我直播时专门给你打广告！', '粉丝都认识你了！你就是我们专属供货商！'],
      ['灵魂伙伴！我的直播间就是你的橱窗！', '我的粉丝就是你的粉丝，一起做大！'],
    ],
    detectDialogs: ['啊？这颜色！粉丝要骂死我的！','你拿砖头料蒙我？差评直接播出去！','我的名誉比什么都重要！'],
    levelUpLines: ['宝子们，我交到新朋友啦！','这位供货商越来越懂我审美了！','哈哈，你摸清楚我口味了呢！','从今天起你就是我直播间御用供货商！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '购买冰种手镯溢价 15%' },
      { lv: 2, type: 'offer', value: 0.12, desc: '切出带紫色的砖头料也能高价做首饰卖她' },
      { lv: 3, type: 'offer', value: 0.20, desc: '每天引荐 1 个随机新 NPC 访客' },
    ],
  },
  {
    id: 'master_chen', name: '陈师傅', fullName: '陈志远',
    role: '国家级玉雕大师', icon: '🗿', color: '#34d399',
    personality: ['严谨', '挑剔', '匠心'],
    affinity: '偏好冰种·玻璃种', affinityGrades: ['ice','glass'], affinityBonus: 0.25,
    desc: '国家级玉雕大师，眼光极高，只收冰种以上，但出价豪爽',
    bonusRange: [1.10, 2.20], minGrade: 'ice',
    detectChance: 0.90, detectPenalty: 6,
    dialogs: [
      ['种水够不够？不行的别拿来浪费时间。', '这料还算入眼，但裂纹多，打个折。'],
      ['上次那块冰种做成了观音，客户很满意。', '种水不错，我在构思一件新作。'],
      ['好友了，给你个内行价！', '老朋友带来的就是不一样！'],
      ['你送来的每一块都是精品！', '只要是你送来的，直接按最高档收！'],
      ['灵魂伙伴！我给你刻一件专属作品！', '这辈子能遇到这样的合伙人，三生有幸！'],
    ],
    detectDialogs: ['砖头料？！你当我是傻子吗！','我三十年雕刻生涯，一眼看穿！别再来了！','把东西拿走，以后别进我工坊！'],
    levelUpLines: ['你选的料越来越符合我的标准了。','有眼光！以后多合作。','朋友，你是难得的行家！','你就是我这辈子最好的原料供应商！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '每日提供 1 次免费擦窗机会' },
      { lv: 2, type: 'skinGreenBonus', value: 0.3, desc: '擦出靠皮绿的半明料卖给他价格加成 30%' },
      { lv: 3, type: 'crackAvoid', value: 0.3, desc: '切割满裂原石时 30% 概率避裂，保底提升一档' },
    ],
  },
  {
    id: 'zhang_zong', name: '张总', fullName: '张立明',
    role: '私人藏家', icon: '🎩', color: '#a78bfa',
    personality: ['博学', '低调', '极品控'],
    affinity: '偏好玻璃种·帝王绿', affinityGrades: ['glass','imperial'], affinityBonus: 0.30,
    desc: '神秘低调的资深藏家，专收顶级珍品，出手极为阔绰',
    bonusRange: [1.30, 3.00], minGrade: 'ice',
    detectChance: 0.85, detectPenalty: 7,
    dialogs: [
      ['稀缺性决定价值，平庸之物不在我考虑范围。', '这件东西…勉强能入眼，价格我来定。'],
      ['上次那件已经两倍价格转手了。这次有什么好东西？', '熟了，直接说实价。'],
      ['好东西要惜缘，咱们直接谈价。', '老友了，告诉你个秘密：下月有场私人拍卖。'],
      ['挚友！我圈子里有大买家找顶级翡翠，第一时间联系你。', '每一件我都当传家宝对待。'],
      ['灵魂伙伴，默契无人能及。你有货不用开口，我看了就知道。', '我们的合作会名留青史！'],
    ],
    detectDialogs: ['我的眼光不会错！这是砖头料！','你以为我看不出来？以后别在我面前提翡翠！','我对人的判断从来不会出错，你让我很失望。'],
    levelUpLines: ['不错，有点眼光。','行情精准，值得深交。','老朋友了，好东西第一时间告诉我。','你是我最值得信任的供货人。'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '解锁大额订单，定期高价求购特定品质' },
      { lv: 2, type: 'offer', value: 0.12, desc: '切割出极品时额外赞助开门红奖金' },
      { lv: 3, type: 'debtAbsorbOnce', value: 1, desc: '帮你承担一次即将逾期的债务(全局限1次)' },
    ],
  },
  {
    id: 'fat_uncle', name: '肥叔', fullName: '胡大富',
    role: '土豪商人', icon: '🧳', color: '#fb923c',
    personality: ['豪爽', '随性', '不差钱'],
    affinity: '什么都爱', affinityGrades: ['brick','waxy','flower','ice','glass','imperial'], affinityBonus: 0.10,
    desc: '从不讲价的土豪，出价完全随感觉，偶尔惊喜偶尔坑',
    bonusRange: [0.60, 2.50], minGrade: 'brick',
    detectChance: 0.10, detectPenalty: 2,
    dialogs: [
      ['好看！多少钱！买买买！', '这颜色我老婆喜欢，随便定个价。'],
      ['你又来了，上次那块媳妇超喜欢，再来几块！', '朋友嘛，你看着给个价，我信你！'],
      ['老朋友了，我不还价！你说多少是多少！', '你来了！最近手头宽裕，大方点买！'],
      ['挚友！我最近开了新公司，需要送礼，你来包办！', '价格我不管，每次你带来的都是好东西！'],
      ['灵魂伙伴！我有个圈子，都不差钱，直接从你这里走货！', '你就是我的翡翠顾问，我只认你！'],
    ],
    detectDialogs: ['哎这不对啊，我老婆说买回去的是砖头？','什么情况，感觉上当了…','哎算了算了，下次给我好的就行。'],
    levelUpLines: ['哈哈，不错不错，还会来找我！','老哥，咱关系越来越铁了！','朋友，我手下有帮人可以介绍给你！','好兄弟！以后你的货我包了！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '每天送顿猪脚饭，打灯次数上限 +1' },
      { lv: 2, type: 'offer', value: 0.15, desc: '极度喜欢带绿的料子，出价额外 +15%' },
      { lv: 3, type: 'waxyPawn', value: 1, desc: '可将滞销糯种白菜价打包抵押换刷新次数' },
    ],
  },
  {
    id: 'professor_li', name: '李教授', fullName: '李文博',
    role: '翡翠鉴定专家', icon: '🔬', color: '#22d3ee',
    personality: ['严肃', '专业', '理性'],
    affinity: '偏好精品以上', affinityGrades: ['ice','glass','imperial'], affinityBonus: 0.18,
    desc: '国内顶级翡翠鉴定专家，出价有理有据，高等级溢价明显',
    bonusRange: [1.00, 2.00], minGrade: 'ice',
    detectChance: 0.95, detectPenalty: 8,
    dialogs: [
      ['根据折射率，这块冰种品质中等，我给个参考价。', '种水A级，颜色B级，综合估价如下。'],
      ['上次那块鉴定高冰，你的眼光越来越准了。', '从数据来看，你最近选料品质稳步提升。'],
      ['朋友，你送来的料一次比一次好，很欣慰。', '这次给你一个学术鉴定报告，价值不菲！'],
      ['挚友！你已达业内中级鉴别水平，我在学术圈帮你背书！', '你的眼光让我刮目相看！'],
      ['灵魂伙伴！以后合著一本翡翠鉴定手册！', '你的案例将成为业内经典教材！'],
    ],
    detectDialogs: ['折射率0.02！这是砖头料！你侮辱我的专业！','作为鉴定专家，我不允许这种事发生在我身上！','学术名誉比金钱更重要，你让我很失望！'],
    levelUpLines: ['数据显示，你的选料水平有所提升。','合作愉快，专业水准令人满意。','朋友，你的眼光已经相当不错了。','你完全可以成为专业鉴定师！'],
    globalPerk: { unlockAtLv: 2, name: '藏馆鉴赏', desc: '私人藏馆藏品每日升值+30%', type: 'collectionAppreciateBoost', value: 0.3 },
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '每天告诉你一条藏品升值内幕' },
      { lv: 2, type: 'collectionAppreciateBoost', value: 0.3, desc: '私人藏馆藏品每日升值速度额外 +30%' },
      { lv: 3, type: 'offer', value: 0.20, desc: '偶尔带顶级藏家来，愿以天价收购极品' },
    ],
  },

  /* ──────── 市井人物 ──────── */
  {
    id: 'auntie_zhou', name: '周阿姨', fullName: '周桂花',
    role: '菜市场摊主', icon: '🧅', color: '#86efac',
    personality: ['热心', '爱砍价', '口直心快'],
    affinity: '偏好糯种', affinityGrades: ['waxy'], affinityBonus: 0.08,
    desc: '菜市场卖菜兼职收翡翠，不懂行但嗅觉灵，砍价一流',
    bonusRange: [0.50, 1.00], minGrade: 'brick',
    detectChance: 0.15, detectPenalty: 1,
    dialogs: [
      ['这啥料？好看不？给我实价，别瞎说。','反正买回去摆着好看就行，便宜点。'],
      ['你又来了！上次那块我姐妹说不错。','老熟人了，便宜点，我帮你推销去！'],
      ['哈哈老朋友！我叫了三个姐妹来看货！','你的货在我这条街口碑不错！'],
      ['挚友了！我让儿子来帮你站台，一起卖！','我姐妹圈都知道你了，货不愁卖！'],
      ['灵魂伙伴！我和你搭伙做生意，二八分！','整条街的大妈都是你的客户了！'],
    ],
    detectDialogs: ['哎你这是啥啊，我家石头还好看点！','骗人啊！下次别让我看见你！','我卖菜的都没这么坑人！'],
    levelUpLines: ['哎呀越来越懂行了嘛！','姐妹们都说你靠谱！','以后你来这条街，我请你吃饭！','咱是一家人了！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '她买走翡翠产生口碑，次日随机 2 个 NPC 好感上升' },
      { lv: 2, type: 'offer', value: 0.20, desc: '偏爱巨料，购买巨料成品溢价 20%' },
      { lv: 3, type: 'groupBuy', value: 1, desc: '召集群友团购，一次性按市价清空所有低端库存' },
    ],
  },
  {
    id: 'old_driver', name: '司机刘哥', fullName: '刘大柱',
    role: '货运司机', icon: '🚛', color: '#fcd34d',
    personality: ['豪爽', '直率', '爱占便宜'],
    affinity: '偏好糯种·花青', affinityGrades: ['waxy','flower'], affinityBonus: 0.12,
    desc: '跑了二十年缅甸路线，路上见过不少好料，懂一点但不精',
    bonusRange: [0.70, 1.30], minGrade: 'brick',
    detectChance: 0.30, detectPenalty: 2,
    dialogs: [
      ['我跑缅甸路上见过这种，给你个路边价。','这料…中等？行吧，搭我车顺便带走。'],
      ['老哥来了！上次那块我媳妇说还不错。','老朋友了，搞个实惠价，咱不废话。'],
      ['兄弟！我认识几个缅甸矿主，要不要介绍？','朋友，价钱我放宽，下次有好料先给我看。'],
      ['挚友！我帮你运货不收费！','你是老铁！我跑缅甸路上帮你盯着好料。'],
      ['灵魂伙伴！以后咱们合开一条翡翠运输线！','兄弟，缅甸那边我全包了，你这边全交给我！'],
    ],
    detectDialogs: ['我跑了二十年缅甸线，这砖头料我认识！','你当我是新手？滚！','行吧，我眼光准，你别想糊弄我。'],
    levelUpLines: ['老哥的眼光越来越准了！','兄弟，你是个实在人！','咱越来越默契了！','好兄弟，以后就是一家人！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '市场刷新后有概率连送一次免费刷新' },
      { lv: 2, type: 'smuggleStone', value: 1, desc: '每天为你拉来一块不属于当前市场等级的走私石' },
      { lv: 3, type: 'emergencyLiquidity', value: 1.2, desc: '破产边缘可帮你把剩余石头 1.2 倍估值连夜变现' },
    ],
  },
  {
    id: 'pawn_boss', name: '典当行老板', fullName: '钱守财',
    role: '典当行老板', icon: '🏦', color: '#f87171',
    personality: ['精明', '冷酷', '唯利是图'],
    affinity: '偏好冰种以上', affinityGrades: ['ice','glass','imperial'], affinityBonus: 0.10,
    desc: '一口价，不还价，但量大可谈，每笔都要赚',
    bonusRange: [0.60, 1.50], minGrade: 'brick',
    detectChance: 0.55, detectPenalty: 4,
    dialogs: [
      ['这个价，爱卖卖，不卖拉倒。','一口价，不还价。'],
      ['又来了，我的价是最实在的，别废话。','老主顾？好，九折。'],
      ['朋友，我这里量大从优。','老朋友，我把底价给你看。'],
      ['挚友！我给你内部通道，急用钱找我！','你的货我全收，价格绝对公道。'],
      ['灵魂伙伴！以后你的货我优先！','咱之间不谈价，都是最高档。'],
    ],
    detectDialogs: ['砖头料？你当我开慈善的？','想在我这里浑水摸鱼？做梦！','我吃这行饭三十年，你别想骗我！'],
    levelUpLines: ['还不错，合作愉快。','你是个靠谱的人。','朋友，以后多合作。','最信任的合作伙伴就是你了！'],
    skillTree: [
      { lv: 1, type: 'pawnCollectible', value: 0.8, desc: '允许抵押藏品获取 80% 现金，3 天内可原价赎回' },
      { lv: 2, type: 'offer', value: 0.10, desc: '售出成品的基础估值下限提高 10%' },
      { lv: 3, type: 'semiBonus', value: 0.25, desc: '无视品质，所有半明料收购价提升 25%' },
    ],
  },
  {
    id: 'newbie_buyer', name: '小李', fullName: '李明亮',
    role: '翡翠新手买家', icon: '🐣', color: '#a3e635',
    personality: ['天真', '好学', '容易被骗'],
    affinity: '什么都爱', affinityGrades: ['brick','waxy','flower','ice','glass','imperial'], affinityBonus: 0.05,
    desc: '刚入行的小白，什么都不懂，是欺负新人的最佳对象',
    bonusRange: [0.80, 1.60], minGrade: 'brick',
    detectChance: 0.05, detectPenalty: 1,
    dialogs: [
      ['请问这个多少钱？我刚学翡翠。','好漂亮哦，是好东西吗？'],
      ['上次买了以后朋友说还不错！','我研究了一下，你这个种水不错？'],
      ['老朋友了，我越来越懂了！','我买了好几块了，感觉进步很大！'],
      ['我已经是行家了！这块我要！','挚友！我把你推荐给所有同学了！'],
      ['灵魂伙伴！你带我入行，我跟你一起干！','我现在也能鉴定了，但还是相信你最多！'],
    ],
    detectDialogs: ['哎这个好像不太对呢…','朋友说这是砖头料，你是不是弄错了？','原来如此，我以后要好好学习了！'],
    levelUpLines: ['哇，你真的懂行！','和你学了很多！','越来越懂你的品位了！','你就是我的翡翠老师！'],
    skillTree: DEFAULT_OFFER_SKILL_TREE,
  },

  /* ──────── 商界人士 ──────── */
  {
    id: 'hotel_boss', name: '酒店老板娘', fullName: '苏雅琴',
    role: '五星酒店老板娘', icon: '🏨', color: '#f9a8d4',
    personality: ['优雅', '挑剔', '品味高'],
    affinity: '偏好冰种以上', affinityGrades: ['ice','glass','imperial'], affinityBonus: 0.20,
    desc: '经营连锁酒店，喜欢用翡翠装饰大堂，出手大方',
    bonusRange: [1.00, 2.20], minGrade: 'waxy',
    detectChance: 0.60, detectPenalty: 5,
    dialogs: [
      ['这块适合放大堂吗？颜色要配我的装修风格。','品质还可以，价格能优惠吗？'],
      ['你又来了，上次那块摆大堂被客人问了好几次。','老关系了，给我个优惠，我帮你推广。'],
      ['朋友，你的眼光和我很搭！给你加价！','老朋友，我把贵宾厅留给你做展示。'],
      ['挚友！我让大堂经理专门介绍你的翡翠给客人！','你的翡翠已经成为酒店招牌了！'],
      ['灵魂伙伴！我直接开辟翡翠展览厅给你！','以后酒店大堂只用你的翡翠！'],
    ],
    detectDialogs: ['这放大堂？客人要笑话我的！','品质这么差，不符合我酒店的调性。','我的酒店只接受最好的东西！'],
    levelUpLines: ['品味越来越好了！','我的大堂因你更美了。','朋友，你就是我的翡翠顾问！','你是我最信任的供货人！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.20, desc: '购买大蛋面溢价 20%' },
      { lv: 2, type: 'freeWindowDaily', value: 1, desc: '每天提供 1 次额外擦窗次数' },
      { lv: 3, type: 'lowMoneyGrant', value: 50000, desc: '资金低于 1 万时无偿资助 5 万' },
    ],
  },
  {
    id: 'stock_guy', name: '炒股大叔', fullName: '许发财',
    role: '专业股民', icon: '📊', color: '#fb923c',
    personality: ['赌徒心态', '高风险偏好', '豪气'],
    affinity: '偏好高波动', affinityGrades: ['brick','imperial'], affinityBonus: 0.15,
    desc: '股市失意后转战翡翠，喜欢搏一把，出价忽高忽低',
    bonusRange: [0.40, 3.00], minGrade: 'brick',
    detectChance: 0.20, detectPenalty: 3,
    dialogs: [
      ['这个能涨多少？翡翠也要看K线的吧？','赌一把！能不能翻五倍？'],
      ['老朋友！上次那块我转手赚了不少！','你的货波动大，我喜欢！'],
      ['朋友，我最近研究了翡翠K线，你这块有潜力！','老朋友，这次我重仓！'],
      ['挚友！你就是我的翡翠分析师！我要加仓！','你出的货我都满仓！'],
      ['灵魂伙伴！咱们合开一个翡翠基金！','你选，我买，稳赚不赔！'],
    ],
    detectDialogs: ['这叫砖头料，跌停了！止损！','什么破料，比跌停还惨！','好吧，这次亏了，下次再来搏回来。'],
    levelUpLines: ['眼光不错，继续涨！','合作愉快，超额收益！','朋友，你是我最好的标的！','灵魂伙伴，以后翡翠市场靠我们！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '收购价随股市波动(0.8～1.4倍)' },
      { lv: 2, type: 'offer', value: 0.12, desc: '高价购买半明料自己去赌' },
      { lv: 3, type: 'debtLeverage', value: 1, desc: '债务逾期时帮你用杠杆延期 3 天(利息翻倍)' },
    ],
  },
  {
    id: 'feng_shui', name: '风水先生', fullName: '玄明道',
    role: '风水大师', icon: '🧿', color: '#818cf8',
    personality: ['神秘', '口才好', '爱玄学'],
    affinity: '偏好绿色系', affinityGrades: ['waxy','flower','ice','glass','imperial'], affinityBonus: 0.12,
    desc: '自称能感受翡翠气场，出价看"缘分"，难以捉摸',
    bonusRange: [0.70, 2.00], minGrade: 'brick',
    detectChance: 0.40, detectPenalty: 3,
    dialogs: [
      ['此石气场…一般，但有缘，给你个缘分价。','命中注定之物，价格随缘。'],
      ['你来了，天意！上次那块帮我客户旺财了！','气场感应到了，今天有大运！'],
      ['朋友，你身上有翡翠财气，我多给一成。','老朋友，今日黄道吉日，大成交！'],
      ['挚友！你的气场和我高度契合！','你送来的翡翠都是有灵气的！'],
      ['灵魂伙伴！前世有缘！以后我所有客户都从你这里进货！','你就是翡翠界的财神爷！'],
    ],
    detectDialogs: ['气场不对！此石阴气太重！','风水有问题！你这块石头冲煞！','我感应到了不祥之兆，退货！'],
    levelUpLines: ['气场渐佳，缘分加深。','你的翡翠越来越有灵性了！','朋友，你是翡翠界的有缘人！','灵魂伙伴，前世有约！'],
    skillTree: [
      { lv: 1, type: 'luckyOrigin', value: 1, desc: '每天预测吉利产地(该产地切涨率微升)' },
      { lv: 2, type: 'guanyinDouble', value: 1, desc: '藏馆中观音/佛公题材成品升值速度翻倍' },
      { lv: 3, type: 'blockNegativeEvent', value: 1, desc: '抵挡一次随机触发的负面事件' },
    ],
  },
  {
    id: 'wedding_planner', name: '婚庆策划', fullName: '罗浪漫',
    role: '婚庆公司老板', icon: '💒', color: '#f472b6',
    personality: ['浪漫', '感性', '重仪式感'],
    affinity: '偏好花青·冰种', affinityGrades: ['flower','ice'], affinityBonus: 0.22,
    desc: '专为豪门婚礼选配翡翠饰品，出价大方，但要求颜值高',
    bonusRange: [0.90, 2.00], minGrade: 'waxy',
    detectChance: 0.50, detectPenalty: 4,
    dialogs: [
      ['这块适合婚礼用吗？颜色要喜庆！','品质要配得上我们客户的身份。'],
      ['你又来了！上次那块新娘很喜欢！','老关系了，这次婚礼要用几块。'],
      ['朋友！这块颜色太美了，就它了！','老朋友，我帮你打广告给豪门圈子。'],
      ['挚友！你就是我们婚庆专属翡翠供货商！','这次婚礼全用你的翡翠！'],
      ['灵魂伙伴！以后所有婚礼都订你的货！','你的翡翠成了我们公司招牌！'],
    ],
    detectDialogs: ['这怎么能用在婚礼上！不吉利！','新娘会哭的！你卖我什么东西！','婚庆最重要的是喜气，这块太差了！'],
    levelUpLines: ['越来越有婚庆品位了！','你懂浪漫！','朋友，你是我最爱的供货商！','灵魂伙伴，我们一起创造浪漫！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '定期发布结婚对戒悬赏，完成获高额赏金' },
      { lv: 2, type: 'offer', value: 0.25, desc: '购买冰种以上成对成品出价 +25%' },
      { lv: 3, type: 'offer', value: 0.20, desc: '每天保底高价收购 1 件任意品质成品' },
    ],
  },

  /* ──────── 文化圈 ──────── */
  {
    id: 'museum_curator', name: '博物馆长', fullName: '文化林',
    role: '博物馆馆长', icon: '🏛️', color: '#93c5fd',
    personality: ['严肃', '历史控', '眼光极高'],
    affinity: '偏好极品珍稀', affinityGrades: ['glass','imperial'], affinityBonus: 0.35,
    desc: '只收博物馆级别的珍品，出手及其阔绰但极为挑剔',
    bonusRange: [1.50, 4.00], minGrade: 'ice',
    detectChance: 0.88, detectPenalty: 8,
    dialogs: [
      ['历史价值？艺术价值？说服我。','品质勉强，但博物馆要求极高。'],
      ['上次那件已经编号入库了。这次有同等级别的吗？','从文献来看，你的眼光有所提升。'],
      ['朋友！这件够格进特展！','老朋友，博物馆为你留了一个专区。'],
      ['挚友！这件将成为镇馆之宝！','你的眼光已经达到文物级别了！'],
      ['灵魂伙伴！你就是活着的翡翠历史！','博物馆将以你命名一个展厅！'],
    ],
    detectDialogs: ['这玩意进博物馆？笑话！','你侮辱了历史！','文化价值为零，拒绝入库！'],
    levelUpLines: ['历史眼光愈发精准。','你的品味接近文物级了。','朋友，你是活着的翡翠历史！','灵魂伙伴，你的名字将载入翡翠史册！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '免费鉴定藏馆物品的真实年化收益率' },
      { lv: 2, type: 'donateDebt', value: 1, desc: '捐赠一件冰种成品可免除一期债务(全局限1次)' },
      { lv: 3, type: 'collectionValueBoost', value: 0.15, desc: '颁发牌匾，所有藏品基础估值永久 +15%' },
    ],
  },
  {
    id: 'influencer', name: '网红博主', fullName: '林晓潮',
    role: '时尚博主', icon: '📸', color: '#e879f9',
    personality: ['潮流', '多变', '看流量'],
    affinity: '偏好颜值系', affinityGrades: ['flower','ice','glass'], affinityBonus: 0.18,
    desc: '只要流量高的翡翠，出价看心情，但粉丝效应带来高溢价',
    bonusRange: [0.70, 2.50], minGrade: 'flower',
    detectChance: 0.30, detectPenalty: 3,
    dialogs: [
      ['这块好出片吗？镜头感很重要。','就看颜值了，价格我说了算。'],
      ['你来了！上次那块帮我涨了一万粉！','老朋友，今天帮我选几块出片的！'],
      ['朋友，你的货质感超棒！都要了！','老朋友，我给你专门拍一个系列！'],
      ['挚友！我把你的翡翠打造成爆款！','你就是我的御用翡翠供应商！'],
      ['灵魂伙伴！咱们共同打造翡翠IP！','你的翡翠就是我的流量密码！'],
    ],
    detectDialogs: ['这怎么出片！粉丝会取关的！','我的形象比什么都重要，这块不行！','流量全没了，都怪你！'],
    levelUpLines: ['你越来越懂拍照了！','你的货帮我涨粉好多！','朋友，你是我最好的素材！','灵魂伙伴，咱们一起火！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.05, desc: '每次大涨(冰种及以上)额外获得流量变现奖励' },
      { lv: 2, type: 'offer', value: 0.12, desc: '每天随机将一件普通成品以 1.5 倍价格直播带货卖出' },
      { lv: 3, type: 'refreshDiscount', value: 0.3, desc: '市场刷新费用永久减免 30%' },
    ],
  },
  {
    id: 'old_monk', name: '老和尚', fullName: '圆空大师',
    role: '寺庙主持', icon: '🙏', color: '#fde68a',
    personality: ['淡泊', '慈悲', '看缘分'],
    affinity: '偏好绿色系', affinityGrades: ['waxy','flower','ice'], affinityBonus: 0.15,
    desc: '寺庙主持，以缘分定价，出价不高但心诚，遇好货豁然开朗',
    bonusRange: [0.80, 1.60], minGrade: 'brick',
    detectChance: 0.35, detectPenalty: 2,
    dialogs: [
      ['阿弥陀佛，此石与我有缘，给个随缘价。','众生皆苦，能减一份是一份。'],
      ['施主又来了，上次那块安放在佛前，有灵气。','缘分再续，随缘随喜。'],
      ['朋友，善缘深厚，加持此石。','老朋友，佛祖保佑你生意兴隆！'],
      ['挚友，你的善念感动了佛陀，特价！','此石将镇守山门，庇佑一方！'],
      ['灵魂伙伴，你我前世有缘！此石无价！','你将成为寺庙的翡翠护法！'],
    ],
    detectDialogs: ['阿弥陀佛，此石戾气太重，放生吧。','善哉善哉，但此石非善物。','缘分未到，此石与我无缘。'],
    levelUpLines: ['善哉，缘分渐深。','功德无量，继续精进。','朋友，你的心意佛陀知道了。','你将是寺庙的翡翠护法！'],
    skillTree: [
      { lv: 1, type: 'brickNoPenaltyGain', value: 1, desc: '卖他砖头料视同放生，不掉好感反加好感' },
      { lv: 2, type: 'cleanWrongFlashlight', value: 1, desc: '每天净化 1 次打灯看走眼状态' },
      { lv: 3, type: 'buddhaBless', value: 1, desc: '连续切垮 5 次后，下一刀必定出冰种或以上' },
    ],
  },

  /* ──────── 各地买家 ──────── */
  {
    id: 'hk_trader', name: '港商阿明', fullName: '梁志明',
    role: '香港珠宝商', icon: '🌃', color: '#38bdf8',
    personality: ['精明', '国际视野', '追求极品'],
    affinity: '偏好玻璃种·帝王绿', affinityGrades: ['glass','imperial'], affinityBonus: 0.28,
    desc: '香港老字号珠宝行，国际行情了如指掌，溢价高但要求极严',
    bonusRange: [1.20, 2.80], minGrade: 'ice',
    detectChance: 0.80, detectPenalty: 6,
    dialogs: [
      ['国际行情你知道吗？这个价公平。','香港公盘见过，这个算中等。'],
      ['你又来了，上次那件在国际拍卖行卖了好价！','老朋友，我给你行货价。'],
      ['朋友！这件够国际水准！','老友，我帮你推到国际市场。'],
      ['挚友！这件交给我，进国际拍卖行！','你的货我全要，绕道香港出口。'],
      ['灵魂伙伴！你就是我的内地翡翠合伙人！','以后内地货全从你这里走！'],
    ],
    detectDialogs: ['砖头料？在香港不值分文！','国际买家会笑话的！','以后别拿这种东西丢人现眼！'],
    levelUpLines: ['眼光国际化了！','值得进国际市场了！','朋友，你够格登国际舞台！','灵魂伙伴，咱们征战国际！'],
    skillTree: [
      { lv: 1, type: 'buyRebate', value: 0.05, desc: '单次购买价格超 10 万的原石，返现 5%' },
      { lv: 2, type: 'offer', value: 0.50, desc: '帝王绿成品的出价是别人的 1.5 倍' },
      { lv: 3, type: 'skipRepayDay', value: 1, desc: '跨海走私：可跳过还款日 1 天(消耗巨额好感)' },
    ],
  },
  {
    id: 'taiwan_lady', name: '台湾阿姨', fullName: '陈玉华',
    role: '台湾富商太太', icon: '🌺', color: '#fb7185',
    personality: ['感性', '豪爽', '重感情'],
    affinity: '偏好花青·冰种', affinityGrades: ['flower','ice'], affinityBonus: 0.20,
    desc: '台湾富商太太，感情用事，遇到喜欢的出价极高',
    bonusRange: [0.85, 2.40], minGrade: 'waxy',
    detectChance: 0.35, detectPenalty: 3,
    dialogs: [
      ['哇这颜色！我婆婆最爱这款，多少钱？','有没有更漂亮的？我要送给女儿。'],
      ['你又来了！上次那块我天天戴。','老朋友了，给我个实在价。'],
      ['哎哟，朋友，这块太美了，我全要！','老朋友，我带了好几个闺蜜来！'],
      ['挚友！这块必须是我的！我不还价！','你就是我最爱的翡翠供货商！'],
      ['灵魂伙伴！以后台湾那边全靠你了！','我把你推荐给所有台湾朋友！'],
    ],
    detectDialogs: ['哎这不对吧？我老公说我买了块石头！','欺负感情用事的人！','哼，以后要带鉴定师来！'],
    levelUpLines: ['感情越来越深了！','你懂我的审美！','朋友，你是我在大陆的翡翠闺蜜！','灵魂伙伴，两岸情深！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.30, desc: '对多色翡翠(春带彩等)出价极高 +30%' },
      { lv: 2, type: 'blessNextDay', value: 1, desc: '每次交易后为你祈福，次日好事件触发率提升' },
      { lv: 3, type: 'debtShare', value: 0.10, desc: '出资入股，每天为你分担 10% 阶段性债务' },
    ],
  },
  {
    id: 'myanmar_agent', name: '缅甸中间商', fullName: '阿波',
    role: '缅甸翡翠掮客', icon: '🌴', color: '#4ade80',
    personality: ['神秘', '信息灵通', '见多识广'],
    affinity: '偏好精品原石', affinityGrades: ['ice','glass','imperial'], affinityBonus: 0.22,
    desc: '直接对接缅甸矿区，能识别真假，出价公道但难以捉摸',
    bonusRange: [0.95, 2.10], minGrade: 'brick',
    detectChance: 0.70, detectPenalty: 5,
    dialogs: [
      ['我从矿区来，你这料的成色我知道。','公道价，不高不低。'],
      ['老朋友，你的货比上次好多了。','我给你矿区最新行情参考。'],
      ['朋友！这件货我直接帮你推到矿主那边！','老朋友，我帮你拿到公盘入场资格！'],
      ['挚友！以后公盘我帮你内部通道！','你的货，我帮你直通缅甸顶级买家！'],
      ['灵魂伙伴！你就是我在中国最信任的伙伴！','整个缅甸矿区都是你的资源！'],
    ],
    detectDialogs: ['砖头料！你以为我没见过矿区原石吗？','在缅甸，这种料连擦脚都不配！','下次带货前去矿区进修一下！'],
    levelUpLines: ['眼光接近矿区水准了。','不错，矿主级别！','朋友，你够格进公盘了！','灵魂伙伴，缅甸矿区的门给你开着！'],
    skillTree: [
      { lv: 1, type: 'tomorrowMaxGrade', value: 1, desc: '提前告诉你明天市场的原石最高品质' },
      { lv: 2, type: 'secretMineDiscount', value: 0.15, desc: '秘境矿脉入场费及原石价格降低 15%' },
      { lv: 3, type: 'blindOrder', value: 1, desc: '每 10 天可找他盲定一块绝对无裂的高级原石' },
    ],
  },

  /* ──────── 特殊人物 ──────── */
  {
    id: 'kid_rich', name: '富二代小赵', fullName: '赵翰',
    role: '富二代', icon: '🏎️', color: '#fbbf24',
    personality: ['任性', '冲动', '不差钱'],
    affinity: '什么都爱', affinityGrades: ['brick','waxy','flower','ice','glass','imperial'], affinityBonus: 0.08,
    desc: '拿父母的钱买翡翠，完全不懂行，但有时候出价惊人',
    bonusRange: [0.50, 3.50], minGrade: 'brick',
    detectChance: 0.08, detectPenalty: 1,
    dialogs: [
      ['帅不帅？好看就买！价格无所谓！','我爸的钱，随便花！'],
      ['你来了，上次那块我发朋友圈被点赞了！','老朋友，给我最贵的！'],
      ['朋友，这块我全要！帮我包起来！','老朋友，我带了银行卡来！'],
      ['挚友！你专门给我留最贵的！','以后你进货先给我看！'],
      ['灵魂伙伴！咱们一起开翡翠店！','爸妈的钱全投翡翠，靠你了！'],
    ],
    detectDialogs: ['哎好像被骗了…等我问问我爸。','朋友说不对？算了算了，我不在乎。','大不了扔了！反正我不差钱！'],
    levelUpLines: ['哈哈又来了！','你很懂我！','朋友！以后我的钱都在你这里花！','灵魂伙伴！老弟，今后我的钱归你管！'],
    skillTree: [
      { lv: 1, type: 'interestFreeLoan', value: 100000, desc: '资金不足时可向他无息借款 10 万(单局 1 次)' },
      { lv: 2, type: 'highStoneRate', value: 1, desc: '市场高级原石刷新概率提升' },
      { lv: 3, type: 'offer', value: 0.20, desc: '冰种以上翡翠溢价 20% 收购' },
    ],
  },
  {
    id: 'retired_cop', name: '退休警察', fullName: '曹铁柱',
    role: '退休刑警', icon: '🔐', color: '#94a3b8',
    personality: ['老辣', '多疑', '眼光精准'],
    affinity: '偏好冰种以上', affinityGrades: ['ice','glass','imperial'], affinityBonus: 0.15,
    desc: '当过刑警，见过太多骗局，对砖头料极度敏感',
    bonusRange: [0.90, 1.80], minGrade: 'brick',
    detectChance: 0.85, detectPenalty: 6,
    dialogs: [
      ['我看人看料都准，你别糊弄我。','有没有问题我一眼看出来。'],
      ['你又来了，上次的料确实没问题。','老朋友了，但我还是要检查。'],
      ['朋友，这次确定没问题？我信你。','老朋友，我的眼光你是知道的。'],
      ['挚友！这次我不检查了，完全信任！','你的货一直让我放心！'],
      ['灵魂伙伴！我的眼光帮你排除了多少风险！','以后我帮你把关，坏货绝对拦截！'],
    ],
    detectDialogs: ['砖头料！你以为我当了二十年刑警是白当的？','我见过的骗局数不清，你这是哪一种？','以后你来我直接翻证件！'],
    levelUpLines: ['审查通过，合格。','每次都没问题，你是个老实人。','朋友，我对你放下警惕了。','灵魂伙伴，你就是我最信任的人！'],
    skillTree: [
      { lv: 1, type: 'noThief', value: 1, desc: '他在场时，小偷事件绝对不触发' },
      { lv: 2, type: 'fuzzyHintReduce', value: 0.15, desc: '打灯出现模糊提示的概率降低 15%' },
      { lv: 3, type: 'removeFakeStones', value: 1, desc: '识破市场造假，直接将劣质原石从列表中剔除' },
    ],
  },
  {
    id: 'hospital_dean', name: '院长夫人', fullName: '柳文芳',
    role: '医院院长太太', icon: '💐', color: '#c084fc',
    personality: ['高贵', '讲究', '爱攀比'],
    affinity: '偏好冰种·玻璃种', affinityGrades: ['ice','glass'], affinityBonus: 0.25,
    desc: '医院院长太太，购物标准就是"比谁的贵"，出价豪气',
    bonusRange: [1.10, 2.50], minGrade: 'waxy',
    detectChance: 0.55, detectPenalty: 4,
    dialogs: [
      ['比王院长太太那块贵不贵？要最贵的！','格调要高，配我的身份。'],
      ['你来了！上次那块比刘院长太太的贵！','老朋友，给我最好最贵的！'],
      ['朋友！你要给我压她们一头！','老朋友，这次我要绝对独一无二！'],
      ['挚友！你就是我的专属高端翡翠顾问！','院长圈子里都知道我的翡翠好看！'],
      ['灵魂伙伴！我把院长圈所有太太都带来！','你的翡翠已经是院长圈的标配了！'],
    ],
    detectDialogs: ['这种档次？我们圈子里要笑话我！','王太太看到了要嘲笑的！','我的脸面比什么都重要！'],
    levelUpLines: ['品味越来越高了！','比圈子里所有人都强！','朋友，你就是高端翡翠界的代表！','灵魂伙伴，咱们统领院长太太圈！'],
    skillTree: [
      { lv: 1, type: 'offer', value: 0.25, desc: '最爱紫罗兰，带紫色的料子卖她溢价 25%' },
      { lv: 2, type: 'unlockHighNpc', value: 1, desc: '交易后有概率帮你解锁高级 NPC' },
      { lv: 3, type: 'clearNegativeBuff', value: 1, desc: '能帮你摆平严打造假等负面事件(直接取消当前负面 Buff)' },
    ],
  },
  {
    id: 'old_gambler', name: '老赌客', fullName: '赌神强',
    role: '澳门老赌客', icon: '🎲', color: '#f59e0b',
    personality: ['嗜赌', '迷信', '图个彩头'],
    affinity: '偏好帝王绿', affinityGrades: ['imperial','glass'], affinityBonus: 0.25,
    desc: '澳门老赌客，相信翡翠带来好运，出价随运气，忽高忽低',
    bonusRange: [0.30, 4.00], minGrade: 'brick',
    detectChance: 0.15, detectPenalty: 2,
    dialogs: [
      ['今天运气好不好？这块能带财吗？','赌一把！说不定是幸运石！'],
      ['你来了！上次那块我赢了二十万！','老朋友，再来一块幸运石！'],
      ['朋友！今天手气旺，大买！','老朋友，我这次要赌最大的！'],
      ['挚友！你就是我的幸运星！','你的翡翠是我的护身符！'],
      ['灵魂伙伴！你的翡翠让我百战百胜！','我的赌场专属翡翠全从你这里拿！'],
    ],
    detectDialogs: ['阿呸！霉气！今晚输了都怪你！','这块邪！带衰！','赌场里不能带这种晦气东西！'],
    levelUpLines: ['手气好！再来！','你的翡翠真的带财！','朋友，你就是我的幸运符！','灵魂伙伴，我把赌神称号分你一半！'],
    skillTree: [
      { lv: 1, type: 'wrongHintReduce', value: 0.05, desc: '打灯看走眼概率降低 5%' },
      { lv: 2, type: 'comebackFund', value: 1, desc: '连续切垮 3 次时资助一笔翻本基金' },
      { lv: 3, type: 'offer', value: 0, desc: '出价极不稳定(0.5～3倍估值)，适合豪赌' },
    ],
  },
  {
    id: 'antique_dealer', name: '古玩商', fullName: '金古斋',
    role: '古玩行商人', icon: '🏺', color: '#d97706',
    personality: ['老练', '见多识广', '难以蒙骗'],
    affinity: '偏好老料·精品', affinityGrades: ['glass','imperial'], affinityBonus: 0.28,
    desc: '古玩行跨界翡翠，经验丰富，出价保守但稳，对砖头料极敏感',
    bonusRange: [0.95, 2.20], minGrade: 'brick',
    detectChance: 0.75, detectPenalty: 5,
    dialogs: [
      ['古玩行跨界，我见过的好东西多了，给你个实价。','东西不差，给你老行家价。'],
      ['你来了，上次那件颇有古意，这次有没有？','老主顾了，给个优惠。'],
      ['朋友！这块颇有古典气韵！','老朋友，我带了几个藏家朋友来！'],
      ['挚友！这件配得上我的古玩馆！','你的东西每次都让我惊喜！'],
      ['灵魂伙伴！你就是我古玩馆的翡翠专家！','以后古玩馆翡翠专区全靠你了！'],
    ],
    detectDialogs: ['古玩行见过太多假货，这砖头料骗不了我！','你当我是菜鸟？三十年功底！','以后带货来先过我这关！'],
    levelUpLines: ['眼光有古玩行水准了！','不错，入门了！','朋友，你有古玩商的潜质！','灵魂伙伴，咱们是古今翡翠界的双杰！'],
    skillTree: [
      { lv: 1, type: 'marketLeak', value: 1, desc: '市场偶尔刷出他预留的漏(便宜原石)' },
      { lv: 2, type: 'brickNoPenaltyChance', value: 0.5, desc: '卖砖头料被他发现时，不掉好感概率提升 50%' },
      { lv: 3, type: 'brickPawn', value: 1, desc: '销赃：每天可将 1 块砖头料以成本价强行抵押给他' },
    ],
  },
]

// NPC 适合的切割档位
const GRADE_ORDER = ['brick','waxy','flower','ice','glass','imperial']

// 计算NPC当前等级（0-indexed，即0=Lv1）
function getNpcLevel(deals) {
  let lv = 0
  for (let i = 0; i < NPC_EXP_TABLE.length; i++) {
    if (deals >= NPC_EXP_TABLE[i]) lv = i
    else break
  }
  return Math.min(lv, 4)
}

// 计算升级进度 [current, needed]
function getNpcProgress(deals) {
  const lv = getNpcLevel(deals)
  if (lv >= 4) return [NPC_EXP_TABLE[4], NPC_EXP_TABLE[4]]
  const prev = NPC_EXP_TABLE[lv]
  const next = NPC_EXP_TABLE[lv + 1]
  return [deals - prev, next - prev]
}

// ═══════════════════════════════════════════════════════════
//  精品成品表（冰种以上才可能出现）
// ═══════════════════════════════════════════════════════════
const COLLECTIBLES = [
  // 冰种可出
  { id:'egg_face',   name:'大蛋面戒面',   emoji:'💍', grade:'ice',      baseValue:128000,  appreciatePerDay:0.04, desc:'冰种蛋面，温润如玉' },
  { id:'bangle_ice', name:'冰种手镯',     emoji:'⭕', grade:'ice',      baseValue:240000, appreciatePerDay:0.05, desc:'冰种圆条，佩戴吉祥' },
  { id:'guanyin',    name:'冰种观音牌',   emoji:'🙏', grade:'ice',      baseValue:192000, appreciatePerDay:0.045,desc:'冰种观音，保佑平安' },
  // 玻璃种可出
  { id:'glass_face', name:'玻璃种蛋面',   emoji:'💠', grade:'glass',    baseValue:560000, appreciatePerDay:0.06, desc:'玻璃种蛋面，极致通透' },
  { id:'glass_bangle',name:'玻璃种手镯',  emoji:'🔮', grade:'glass',    baseValue:960000, appreciatePerDay:0.07, desc:'玻璃种手镯，旷世珍品' },
  { id:'dragon',     name:'玻璃种龙牌',   emoji:'🐉', grade:'glass',    baseValue:800000, appreciatePerDay:0.065,desc:'玻璃种龙牌，镇宅之宝' },
  // 帝王绿可出
  { id:'imperial_ring',  name:'帝王绿戒面', emoji:'👑', grade:'imperial', baseValue:1920000,appreciatePerDay:0.08, desc:'帝王绿蛋面，无价之宝' },
  { id:'imperial_bangle',name:'无暇帝王手镯',emoji:'💚',grade:'imperial', baseValue:3200000,appreciatePerDay:0.10, desc:'无瑕帝王绿手镯，传世极品' },
  { id:'fu_lu_shou', name:'福禄寿摆件',   emoji:'🏺', grade:'imperial', baseValue:2880000,appreciatePerDay:0.09, desc:'帝王绿雕刻，镇馆之宝' },
]

// 哪些切割结果可能出精品
const CUT_COLLECTIBLE_CHANCE = { ice:0.35, glass:0.65, imperial:0.90 }

// ═══════════════════════════════════════════════════════════
//  原石尺寸档位
// ═══════════════════════════════════════════════════════════
const SIZES = [
  { id:'tiny',   label:'小料',   weightRange:[0.2, 0.8],  priceMulti:0.6, bonusIce:0,    bonusImperial:0    },
  { id:'small',  label:'中小料', weightRange:[0.8, 2.5],  priceMulti:1.0, bonusIce:0,    bonusImperial:0    },
  { id:'medium', label:'中料',   weightRange:[2.5, 6.0],  priceMulti:1.5, bonusIce:0.03, bonusImperial:0.01 },
  { id:'large',  label:'大料',   weightRange:[6.0, 15.0], priceMulti:2.2, bonusIce:0.05, bonusImperial:0.02 },
  { id:'giant',  label:'巨料',   weightRange:[15.0,40.0], priceMulti:3.5, bonusIce:0.08, bonusImperial:0.03 },
]

// ═══════════════════════════════════════════════════════════
//  场口（产地）特性：影响切割概率
//  brick, waxy, flower, ice, glass, imperial 为概率修正（可正可负）
// ═══════════════════════════════════════════════════════════
const ORIGIN_CONFIG = {
  '莫西沙': { name:'莫西沙', desc:'以种水著称，冰种概率高，但裂多易垮。', detail:'缅甸帕敢地区著名老场口，以产出高冰、玻璃种著称。皮壳多为白沙皮、灰沙皮，砂粒细腻。打灯可见水头长、荧光强，行话称"种水料"。但莫西沙料裂多，切开后常因绺裂影响取件，赌性大。适合追求种水、能承受切垮风险的玩家。', brick:0.06, waxy:-0.04, flower:0, ice:0.08, glass:0.03, imperial:-0.02 },
  '木那':   { name:'木那', desc:'帝王绿概率微升，但废料率也高，赌性极大。', detail:'木那场口位于缅甸北部，以"海天一色、点点雪花"闻名。出产的翡翠常带棉，但种老色阳，偶出帝王绿、满绿高货。木那料皮壳多为白盐砂、黄盐砂，打灯多见雪花棉。行内称"木那至尊"，赌涨可一夜暴富，但废料率同样极高，属高风险高回报型场口。', brick:0.10, waxy:-0.05, flower:0, ice:0.02, glass:0.02, imperial:0.04 },
  '大马坎': { name:'大马坎', desc:'黄翡、红翡、多彩料常见，花青/多彩概率极高。', detail:'大马坎位于缅甸雾露河下游，多为水石、半山半水石，皮壳光滑。以黄翡、红翡、春带彩、多彩料著称，颜色丰富、质地细腻。行话"大马坎出黄加绿"，切出花青、多彩的概率极高。适合喜欢颜色、追求特色料的玩家，帝王绿少见但色彩系稳。', brick:-0.05, waxy:0.02, flower:0.18, ice:0.04, glass:-0.02, imperial:-0.01 },
  '后江':   { name:'后江', desc:'料子细腻，糯种保本率较高，极端情况少。', detail:'后江场口地处缅甸北部，以小件水石、色料闻名。皮薄肉细，打灯易看透，出糯种、细糯种概率高。后江料个头小但种水稳，切垮概率低，适合稳健型玩家。极少数能出高冰，帝王绿罕见，但整体保本率好，适合积累本金。', brick:-0.08, waxy:0.12, flower:0.02, ice:0.01, glass:-0.02, imperial:-0.01 },
  '会卡':   { name:'会卡', desc:'皮薄水长，冰种略多，但易有裂。', detail:'会卡场口皮壳多为蜡皮、青皮，皮薄打灯可见内部。水头好、冰种概率略高，但裂绺多，行话"会卡裂多"。切涨多为冰种、糯冰，但需注意避裂取件。适合有一定经验、能通过打灯判断裂走向的玩家。', brick:0.04, waxy:-0.03, flower:0.02, ice:0.06, glass:0.01, imperial:0 },
  '帕敢':   { name:'帕敢', desc:'老场口，品质下限有保障，砖头率略低。', detail:'帕敢是缅甸翡翠最著名的老场区，开采历史悠久。出料品质下限高，砖头率相对低，多出糯种以上。帕敢料皮壳多样，常见黑乌沙、白盐砂。行内公认的"稳场口"，适合中长线玩家。偶出玻璃种、帝王绿，整体赌性适中。', brick:-0.06, waxy:0.03, flower:0.02, ice:0.04, glass:0.02, imperial:0.02 },
  '南齐':   { name:'南齐', desc:'中小料为主，整体偏稳，糯种花青常见。', detail:'南齐场口料子多为中小件，皮壳以黄沙皮、白沙皮为主。整体偏稳，出糯种、花青种概率高，砖头率适中。南齐料适合做手镯、挂件，色系偏绿、偏花。帝王绿少见，但中档料稳定，适合稳健经营。', brick:-0.02, waxy:0.05, flower:0.06, ice:0, glass:-0.02, imperial:-0.01 },
  '龙塘':   { name:'龙塘', desc:'种老色正，玻璃种略多。', detail:'龙塘场口以种老、色正著称，皮壳多为白盐砂。打灯多见荧光强、种水好，玻璃种概率略高于平均。龙塘料个头偏大，适合做大件、摆件。赌性中等，适合追求高品质种水的玩家。', brick:-0.03, waxy:-0.02, flower:0, ice:0.04, glass:0.05, imperial:0.01 },
  '抹谷':   { name:'抹谷', desc:'以红蓝宝石闻名，翡翠偏中规中矩。', detail:'抹谷以红宝石、蓝宝石闻名于世，翡翠产量相对少。翡翠品质中规中矩，多出糯种、花青，极少极端料。适合作为补充渠道，不推荐作为主打场口。', brick:0.02, waxy:0.04, flower:0.02, ice:0, glass:0, imperial:0 },
  '其他':   { name:'其他', desc:'杂矿混采，概率接近基础值。', detail:'来自多个小场口或混采矿区的原石，品质波动大，切割概率接近全局基础值。需结合打灯、开窗等信息综合判断。', brick:0, waxy:0, flower:0, ice:0, glass:0, imperial:0 },
}

// ═══════════════════════════════════════════════════════════
//  原石隐藏属性（hiddenTag，打灯可揭示；旧字段 affix 已弃用）
//  cutQualityBonus: 高品质(冰/玻璃/帝王)概率加成; brickBonus: 砖头料概率加成（负=减）
// ═══════════════════════════════════════════════════════════
const STONE_AFFIXES = [
  { id:'tight_skin',     name:'皮壳紧实',   cutQualityBonus:0.20, brickBonus:-0.15, desc:'高品质率+20%',     type:'good' },
  { id:'heavy_crack',    name:'满身绺裂',   cutQualityBonus:-0.08, brickBonus:0.30, desc:'切垮率+30%',       type:'bad' },
  { id:'green_spots',    name:'松花点点',   cutQualityBonus:0.12, brickBonus:-0.10, desc:'高品质率+12%',     type:'good' },
  { id:'mud_skin',       name:'泥皮厚实',   cutQualityBonus:-0.05, brickBonus:0.15, desc:'砖头概率+15%',     type:'bad' },
  { id:'water_path',     name:'水路清晰',   cutQualityBonus:0.15, brickBonus:-0.12, desc:'冰种以上+15%',     type:'good' },
  { id:'foggy_inside',   name:'雾重难辨',   cutQualityBonus:-0.10, brickBonus:0.20, desc:'切垮率+20%',       type:'bad' },
  { id:'sandy_bark',     name:'砂细如面',   cutQualityBonus:0.10, brickBonus:-0.08, desc:'高品质率+10%',     type:'good' },
  { id:'rough_bark',     name:'砂粗皮松',   cutQualityBonus:-0.12, brickBonus:0.25, desc:'砖头概率+25%',     type:'bad' },
  { id:'febby_surface',  name:'癣加绿',     cutQualityBonus:0.18, brickBonus:-0.14, desc:'帝王绿概率+18%',   type:'good' },
  { id:'dead_癣',        name:'死癣吃色',   cutQualityBonus:-0.15, brickBonus:0.22, desc:'切垮率+22%',       type:'bad' },
]
const AFFIX_MAP = Object.fromEntries(STONE_AFFIXES.map(a => [a.id, a]))
const FLASHLIGHT_PROBS = { accurate: 0.55, fuzzy: 0.35, wrong: 0.10 }
const FLASHLIGHT_COST = 400   // 打灯消耗（×2）
const WINDOW_OPEN_COST = 600  // 开皮擦窗消耗（×2）
const WINDOW_OUTCOMES = [
  { hint: '擦出绿意', multiRange: [1.5, 2.5] },
  { hint: '满是黑癣', multiRange: [0.3, 0.6] },
  { hint: '靠皮绿', multiRange: [1.0, 1.3] },
]

// ═══════════════════════════════════════════════════════════
//  原石数据库 (28 种)
// ═══════════════════════════════════════════════════════════
// originId 映射到 ORIGIN_CONFIG，用于切割概率修正
const ROUGH_STONE_POOL = [
  { name:'后江普通料',   origin:'缅甸后江',     originId:'后江', emoji:'🪨', basePrice:10000,  quality:'common',    luckBonus:0    },
  { name:'莫湾基碎料',   origin:'莫湾基场口',   originId:'其他', emoji:'🟤', basePrice:12500,  quality:'common',    luckBonus:0    },
  { name:'龙塘普料',     origin:'缅甸龙塘',     originId:'龙塘', emoji:'🫙', basePrice:11250,  quality:'common',    luckBonus:0    },
  { name:'南齐场口料',   origin:'缅甸南齐',     originId:'南齐', emoji:'🟫', basePrice:9500,   quality:'common',    luckBonus:0    },
  { name:'抹谷杂料',     origin:'缅甸抹谷',     originId:'抹谷', emoji:'⬛', basePrice:12500,  quality:'common',    luckBonus:0    },
  { name:'孟拱低档料',   origin:'缅甸孟拱',     originId:'其他', emoji:'🪵', basePrice:10500,  quality:'common',    luckBonus:0    },
  { name:'大马坎原石',   origin:'大马坎场口',   originId:'大马坎', emoji:'💚', basePrice:30000,  quality:'uncommon',  luckBonus:0.02 },
  { name:'会卡场口料',   origin:'缅甸会卡',     originId:'会卡', emoji:'🟢', basePrice:37500,  quality:'uncommon',  luckBonus:0.02 },
  { name:'南奇场口料',   origin:'缅甸南奇',     originId:'南齐', emoji:'🫐', basePrice:32500,  quality:'uncommon',  luckBonus:0.02 },
  { name:'雷打场原石',   origin:'缅甸雷打',     originId:'其他', emoji:'⚡', basePrice:40000,  quality:'uncommon',  luckBonus:0.03 },
  { name:'基多场口料',   origin:'缅甸基多',     originId:'其他', emoji:'🌱', basePrice:27500,  quality:'uncommon',  luckBonus:0.02 },
  { name:'度冒中档料',   origin:'缅甸度冒',     originId:'其他', emoji:'🍃', basePrice:35000,  quality:'uncommon',  luckBonus:0.02 },
  { name:'帕敢老坑料',   origin:'帕敢老坑',     originId:'帕敢', emoji:'🌿', basePrice:55000,  quality:'rare',      luckBonus:0.05 },
  { name:'香港公盘料',   origin:'香港公盘',     originId:'其他', emoji:'💎', basePrice:70000,  quality:'rare',      luckBonus:0.05 },
  { name:'老班章原石',   origin:'云南老班章',   originId:'其他', emoji:'🫧', basePrice:62500,  quality:'rare',      luckBonus:0.04 },
  { name:'格应角老料',   origin:'缅甸格应角',   originId:'帕敢', emoji:'🔮', basePrice:80000,  quality:'rare',      luckBonus:0.06 },
  { name:'苏麻喇姑料',   origin:'苏麻喇姑矿',   originId:'其他', emoji:'🌊', basePrice:65000,  quality:'rare',      luckBonus:0.05 },
  { name:'那黑场口料',   origin:'缅甸那黑',     originId:'其他', emoji:'🫚', basePrice:60000,  quality:'rare',      luckBonus:0.04 },
  { name:'达木坎精料',   origin:'缅甸达木坎',   originId:'大马坎', emoji:'🌀', basePrice:75000,  quality:'rare',      luckBonus:0.05 },
  { name:'格底瓦特料',   origin:'格底瓦特矿',   originId:'其他', emoji:'🪬', basePrice:87500,  quality:'rare',      luckBonus:0.06 },
  { name:'木那老坑极品', origin:'木那场口',     originId:'木那', emoji:'✨', basePrice:125000, quality:'epic',      luckBonus:0.10 },
  { name:'莫西沙高冰',   origin:'莫西沙场口',   originId:'莫西沙', emoji:'❄️', basePrice:140000, quality:'epic',      luckBonus:0.11 },
  { name:'帝王绿毛料',   origin:'帕敢秘境',     originId:'帕敢', emoji:'👑', basePrice:200000, quality:'epic',      luckBonus:0.15 },
  { name:'紫罗兰极品',   origin:'缅甸公盘秘区', originId:'大马坎', emoji:'💜', basePrice:150000, quality:'epic',      luckBonus:0.12 },
  { name:'晴底极品料',   origin:'晴底老坑',     originId:'莫西沙', emoji:'🌌', basePrice:175000, quality:'epic',      luckBonus:0.13 },
  { name:'莫氏高冰料',   origin:'莫氏矿脉',     originId:'莫西沙', emoji:'❄️', basePrice:225000, quality:'epic',      luckBonus:0.14 },
  { name:'传世玻璃种',   origin:'秘境矿脉·甲',  originId:'帕敢', emoji:'🔷', basePrice:450000, quality:'legendary', luckBonus:0.25 },
  { name:'神皇翠毛料',   origin:'秘境矿脉·乙',  originId:'木那', emoji:'🌟', basePrice:625000, quality:'legendary', luckBonus:0.30 },
  { name:'亿年翠王石',   origin:'远古秘境',     originId:'帕敢', emoji:'🏆', basePrice:1000000,quality:'legendary', luckBonus:0.40 },
]

// ═══════════════════════════════════════════════════════════
//  切割结果表
// ═══════════════════════════════════════════════════════════
const CUT_RESULTS = [
  { id:'brick',    name:'砖头料',   grade:'亏损', emoji:'🧱', desc:'满是裂绺，一文不值',   multiplier:0.40,  baseProbability:0.40, gradientFrom:'#7f1d1d', gradientTo:'#991b1b', textColor:'#fca5a5', badgeBg:'#450a0a', badgeText:'#fca5a5', borderColor:'#dc2626', message:'💔 全是裂！亏大了！',        sparkle:false },
  { id:'waxy',     name:'糯种翡翠', grade:'保本', emoji:'🫛', desc:'糯种，质地细腻',       multiplier:2.0,   baseProbability:0.32, gradientFrom:'#713f12', gradientTo:'#92400e', textColor:'#fcd34d', badgeBg:'#451a03', badgeText:'#fcd34d', borderColor:'#d97706', message:'😌 糯种，刚好保本。',       sparkle:false },
  { id:'flower',   name:'花青翡翠', grade:'微赚', emoji:'🌸', desc:'花青种，颜色活泼',     multiplier:3.5,   baseProbability:0.13, gradientFrom:'#500724', gradientTo:'#831843', textColor:'#f9a8d4', badgeBg:'#4a044e', badgeText:'#f9a8d4', borderColor:'#db2777', message:'🌸 花青种！小赚一笔！',     sparkle:false },
  { id:'ice',      name:'冰种翡翠', grade:'大赚', emoji:'🧊', desc:'冰种，通透如水',       multiplier:6.0,   baseProbability:0.11, gradientFrom:'#0c4a6e', gradientTo:'#0369a1', textColor:'#7dd3fc', badgeBg:'#082f49', badgeText:'#7dd3fc', borderColor:'#0ea5e9', message:'❄️ 冰种！大赚了！',        sparkle:true  },
  { id:'glass',    name:'玻璃种',   grade:'暴赚', emoji:'💠', desc:'玻璃种，种水极佳！',   multiplier:12.0,  baseProbability:0.03, gradientFrom:'#134e4a', gradientTo:'#0f766e', textColor:'#5eead4', badgeBg:'#042f2e', badgeText:'#5eead4', borderColor:'#14b8a6', message:'💠 玻璃种！超级暴赚！',   sparkle:true  },
  { id:'imperial', name:'帝王绿',   grade:'天价', emoji:'👑', desc:'帝王绿，万里挑一！',   multiplier:24.0, baseProbability:0.01, gradientFrom:'#052e16', gradientTo:'#14532d', textColor:'#86efac', badgeBg:'#052e16', badgeText:'#bbf7d0', borderColor:'#22c55e', message:'🎉👑 帝王绿！一夜暴富！', sparkle:true  },
]
const CUT_MAP = Object.fromEntries(CUT_RESULTS.map(r => [r.id, r]))

// ═══════════════════════════════════════════════════════════
//  品质样式
// ═══════════════════════════════════════════════════════════
const QUALITY_CONFIG = {
  common:    { label:'普通', bg:'rgba(51,65,85,0.8)',   text:'#94a3b8', border:'#334155' },
  uncommon:  { label:'良品', bg:'rgba(20,83,45,0.6)',   text:'#86efac', border:'#166534' },
  rare:      { label:'精品', bg:'rgba(30,58,138,0.6)',  text:'#93c5fd', border:'#1e3a8a' },
  epic:      { label:'极品', bg:'rgba(88,28,135,0.6)',  text:'#d8b4fe', border:'#7e22ce' },
  legendary: { label:'传说', bg:'rgba(120,53,15,0.7)',  text:'#fde68a', border:'#d97706' },
}

// ═══════════════════════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════════════════════
function rnd(min, max) { return min + Math.random() * (max - min) }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

function generateSize() {
  const w = [0.22, 0.33, 0.27, 0.13, 0.05]
  const r = Math.random(); let c = 0
  for (let i = 0; i < SIZES.length; i++) { c += w[i]; if (r < c) { const s = SIZES[i]; return { ...s, weight: parseFloat(rnd(s.weightRange[0], s.weightRange[1]).toFixed(1)) } } }
  return { ...SIZES[1], weight: 1.5 }
}

// 公斤料区：价格极低，无法打灯擦窗，切出好料概率极低
function generateKgStones(level) {
  const lv = MARKET_LEVELS[level - 1]
  const pool = ROUGH_STONE_POOL.filter(s => lv.allowedQualities.includes(s.quality))
  const count = Math.min(6, lv.slotCount + 2)
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count).map((s, i) => {
    const sz = generateSize()
    const price = Math.max(300, Math.round((400 + Math.random() * 500) * sz.priceMulti / 100) * 100)
    const hiddenTag = pick(STONE_AFFIXES).id
    return { id: Date.now() + i + Math.random() + 0.1, ...s, sizeData: sz, price, hiddenTag, channel: 'kg', noWindow: true, kgBrickBoost: 0.25 }
  })
}

// 精品柜台：价格高昂，直接半明料，品质下限保障
function generatePremiumStones(level) {
  const lv = MARKET_LEVELS[level - 1]
  const pool = ROUGH_STONE_POOL.filter(s => ['rare','epic','legendary'].includes(s.quality) && lv.allowedQualities.includes(s.quality))
  const fallback = ROUGH_STONE_POOL.filter(s => lv.allowedQualities.includes(s.quality))
  const src = pool.length ? pool : fallback
  const count = Math.min(4, Math.max(2, lv.slotCount - 1))
  const chosen = [...src].sort(() => Math.random() - 0.5).slice(0, count)
  return chosen.map((s, i) => {
    const sz = generateSize()
    const price = Math.max(Math.round(s.basePrice * sz.priceMulti * (1.1 + Math.random() * 0.4) / 100) * 100, 15000)
    const hiddenTag = pick(STONE_AFFIXES).id
    const outcome = pick(WINDOW_OUTCOMES)
    const semiMultiplier = rnd(outcome.multiRange[0], outcome.multiRange[1])
    return { id: Date.now() + i + Math.random() + 0.2, ...s, sizeData: sz, price, hiddenTag, channel: 'premium', windowOpened: { hint: outcome.hint, semiMultiplier }, qualityFloor: 'waxy' }
  })
}

// 暗标公盘：每次刷新 1 块神秘高货，需竞标
function generateAuctionStone(level) {
  const lv = MARKET_LEVELS[level - 1]
  const pool = ROUGH_STONE_POOL.filter(s => ['rare','epic','legendary'].includes(s.quality) && lv.allowedQualities.includes(s.quality))
  const fallback = ROUGH_STONE_POOL.filter(s => lv.allowedQualities.includes(s.quality))
  const src = pool.length ? pool : fallback
  const s = pick(src)
  const sz = generateSize()
  const price = Math.max(Math.round(s.basePrice * sz.priceMulti * (1.2 + Math.random() * 0.5) / 100) * 100, 20000)
  const hiddenTag = pick(STONE_AFFIXES).id
  return { id: Date.now() + Math.random() + 0.3, ...s, sizeData: sz, price, hiddenTag, channel: 'auction', auctionBasePrice: price }
}

// 兼容旧逻辑：合并为单一列表（用于非三渠道模式时的简单展示）
function generateMarketStones(level) {
  const kg = generateKgStones(level)
  const prem = generatePremiumStones(level)
  const auc = generateAuctionStone(level)
  return { kgStones: kg, premiumStones: prem, auctionStone: auc }
}

function rollCutResult(stone, cutQualityBonus = 0, brickReduceBonus = 0) {
  const { luckBonus } = stone
  const tagId = stone.hiddenTag || stone.affix  // hiddenTag (Phase2), legacy affix
  const affixData = tagId ? AFFIX_MAP[tagId] : null
  const affixCut = affixData?.cutQualityBonus ?? 0
  const affixBrick = affixData?.brickBonus ?? 0
  const { bonusIce = 0, bonusImperial = 0 } = stone.sizeData || {}
  const leg = stone.quality === 'legendary'
  const isFuzzy = stone.flashlightRevealed && stone.flashlightResult === 'fuzzy'  // 打灯模糊：看不透，赌性更大
  const adj = CUT_RESULTS.map(r => {
    let p = r.baseProbability
    if (r.id === 'ice')      p += bonusIce + luckBonus * 0.3  + (leg ? 0.06 : 0) + cutQualityBonus + affixCut
    if (r.id === 'glass')    p += bonusIce * 0.5 + luckBonus * 0.4 + (leg ? 0.08 : 0) + cutQualityBonus + affixCut
    if (r.id === 'imperial') p += bonusImperial + luckBonus * 0.5 + (leg ? 0.10 : 0) + cutQualityBonus + affixCut
    if (r.id === 'flower')   p += luckBonus * 0.2 + cutQualityBonus * 0.5 + affixCut * 0.5
    if (r.id === 'brick') {
      p += affixBrick - (luckBonus * 0.5 + bonusIce * 0.3 + (leg ? 0.15 : 0) + cutQualityBonus + brickReduceBonus) + (stone.kgBrickBoost ?? 0)
      if (stone.qualityFloor === 'waxy') p -= 0.35
    }
    // 场口修正
    const oid = stone.originId || Object.keys(ORIGIN_CONFIG).find(k => stone.origin?.includes(k))
    const ocfg = oid ? ORIGIN_CONFIG[oid] : null
    if (ocfg && ocfg[r.id] != null) p += ocfg[r.id]
    // 打灯模糊：两头极端概率↑，中间压缩，赌性拉满
    if (isFuzzy) {
      if (r.id === 'brick')    p += 0.12
      if (r.id === 'waxy')     p -= 0.08
      if (r.id === 'flower')   p -= 0.05
      if (r.id === 'ice')      p += 0.06
      if (r.id === 'glass')    p += 0.03
      if (r.id === 'imperial') p += 0.02
    }
    return { ...r, p: Math.max(p, 0.001) }
  })
  const total = adj.reduce((s, r) => s + r.p, 0)
  const rand = Math.random() * total; let cum = 0
  for (const r of adj) { cum += r.p; if (rand < cum) return r }
  return adj[0]
}

// 切割后尝试生成精品成品
function tryGenerateCollectible(cutResultId, stoneCost) {
  const chance = CUT_COLLECTIBLE_CHANCE[cutResultId]
  if (!chance || Math.random() > chance) return null
  const pool = COLLECTIBLES.filter(c => {
    const idx = GRADE_ORDER.indexOf(c.grade)
    const cutIdx = GRADE_ORDER.indexOf(cutResultId)
    return idx <= cutIdx + 1 && idx >= cutIdx - 1
  })
  if (!pool.length) return null
  const template = pick(pool)
  const valueVariance = 0.8 + Math.random() * 0.4
  return {
    ...template,
    instanceId: Date.now() + Math.random(),
    baseValue: Math.round(template.baseValue * valueVariance / 100) * 100,
    stoneCost,
    acquiredDay: 0, // 将在外层填入当前天数
    daysSinceAcquired: 0,
  }
}

// NPC 报价：基础 bonusRange 随机，再乘技能树 offerMultiplier，再加相性加成
function getNpcOffer(npc, baseValue, cutResultId, npcDeals) {
  const lv = getNpcLevel(npcDeals)
  const mod = getNpcOfferModifiers(npc, lv)
  const mult = mod.offerMultiplier ?? 1
  let bonus = rnd(npc.bonusRange[0], npc.bonusRange[1]) * mult
  if (npc.affinityGrades.includes(cutResultId)) {
    bonus += npc.affinityBonus
  }
  return Math.round(baseValue * bonus / 100) * 100
}

function nowStr() {
  const d = new Date()
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`
}

// ═══════════════════════════════════════════════════════════
//  子组件：原石外形
// ═══════════════════════════════════════════════════════════
function StoneVisual({ stone, size = 'md', glowing = false }) {
  const sizeMap = { sm:40, md:60, lg:84 }
  const px = sizeMap[size] || 60
  const q = QUALITY_CONFIG[stone.quality]
  return (
    <div style={{
      width:px, height:px, fontSize:px*0.54,
      background:`radial-gradient(circle at 35% 32%, ${q.border}55, ${q.bg})`,
      border:`2px solid ${q.border}99`,
      borderRadius:'42% 58% 54% 46% / 46% 42% 58% 54%',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
      boxShadow: glowing ? `0 0 16px ${q.border}99, inset 0 1px 0 ${q.border}44` : '0 2px 8px rgba(0,0,0,0.45)',
      transition:'box-shadow 0.3s',
    }}>{stone.emoji}</div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：市场原石卡片（支持公斤料/精品/暗标）
// ═══════════════════════════════════════════════════════════
function MarketStoneCard({ stone, channel, onBuy, onBargain, onBid, onFlashlight, onShowDetail, canAfford, marketPriceMult = 1, money, isAngry }) {
  const q = QUALITY_CONFIG[stone.quality]
  const { sizeData } = stone
  const isLeg = stone.quality === 'legendary'
  const effectivePrice = Math.round(stone.price * marketPriceMult)
  const canFlashlight = !stone.flashlightRevealed && money >= FLASHLIGHT_COST && onFlashlight
  const hintTypeLabel = stone.flashlightRevealed && stone.flashlightResult === 'accurate' ? '准确' : stone.flashlightRevealed && stone.flashlightResult === 'fuzzy' ? '模糊' : stone.flashlightRevealed && stone.flashlightResult === 'wrong' ? '看走眼' : null
  const ocfg = ORIGIN_CONFIG[stone.originId] || ORIGIN_CONFIG['其他']
  const disabled = isAngry || (channel === 'premium' && isAngry)
  const buyable = !disabled && (channel === 'kg' || channel === 'premium') && canAfford
  return (
    <div className={buyable ? 'market-card-hover' : ''} style={{
      background: isLeg ? 'linear-gradient(135deg,rgba(30,15,5,.98),rgba(50,25,5,.95))' : 'linear-gradient(135deg,rgba(15,23,42,.96),rgba(28,39,56,.92))',
      border: `1px solid ${disabled ? '#1e293b' : buyable ? q.border+(isLeg?'cc':'77') : '#334155'}`,
      borderRadius:14, padding:'12px 14px',
      cursor: disabled ? 'not-allowed' : 'default', opacity: disabled ? 0.4 : 1,
      transition:'all 0.25s ease', position:'relative', overflow:'hidden',
      boxShadow: isLeg && buyable ? `0 0 20px ${q.border}44` : 'none',
    }}>
      <div style={{ position:'absolute', top:0, right:0, width:72, height:72, background:`radial-gradient(circle,${q.border}22 0%,transparent 70%)`, pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <StoneVisual stone={stone} size="md" glowing={buyable} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
            <span style={{ color:'#f1f5f9', fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stone.name}</span>
            <span style={{ background:q.bg, color:q.text, border:`1px solid ${q.border}`, fontSize:9, padding:'1px 6px', borderRadius:20, fontWeight:700, flexShrink:0 }}>{q.label}</span>
          </div>
          <button onClick={e=>{e.stopPropagation();onShowDetail?.(stone, ocfg)}} style={{ background:'none', border:'none', padding:0, cursor: onShowDetail?'pointer':'default', textAlign:'left' }}>
            <span style={{ color:'#64748b', fontSize:10, marginBottom:5, textDecoration: onShowDetail?'underline':'none' }}>📍 {stone.origin}{onShowDetail && ' · 点击详情'}</span>
          </button>
          {stone.windowOpened && (
            <p style={{ color: stone.windowOpened.semiMultiplier >= 1.2 ? '#4ade80' : stone.windowOpened.semiMultiplier <= 0.7 ? '#f87171' : '#fbbf24', fontSize:10, fontWeight:700, margin: '2px 0 4px' }}>半明料 · {stone.windowOpened.hint}</p>
          )}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            <span style={{ background:'rgba(30,41,59,.9)', color:'#64748b', fontSize:9, padding:'2px 7px', borderRadius:20 }}>{sizeData.label} · {sizeData.weight}kg</span>
            {sizeData.bonusIce > 0 && <span style={{ color:'#7dd3fc', fontSize:9 }}>冰种+{(sizeData.bonusIce*100).toFixed(0)}%</span>}
            {stone.flashlightRevealed && stone.flashlightHint && (
              <span style={{
                background: hintTypeLabel === '准确' ? 'rgba(34,197,94,.2)' : hintTypeLabel === '模糊' ? 'rgba(148,163,184,.2)' : 'rgba(239,68,68,.2)',
                color: hintTypeLabel === '准确' ? '#4ade80' : hintTypeLabel === '模糊' ? '#94a3b8' : '#f87171',
                fontSize:9, padding:'2px 7px', borderRadius:20,
                border: `1px solid ${hintTypeLabel === '准确' ? '#22c55e55' : hintTypeLabel === '模糊' ? '#64748b55' : '#ef444455'}`
              }}>🔦 {hintTypeLabel}：{stone.flashlightHint}</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10, flexWrap:'wrap', gap:6 }}>
        <div>
          <span style={{ color: isLeg?'#fde68a':'#fbbf24', fontSize:17, fontWeight:800 }}>¥{effectivePrice.toLocaleString()}</span>
          {marketPriceMult !== 1 && <span style={{ color:'#64748b', fontSize:9, marginLeft:4 }}>原¥{stone.price.toLocaleString()}</span>}
          {channel === 'kg' && <span style={{ color:'#64748b', fontSize:10, marginLeft:4 }}>公斤料</span>}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          {canFlashlight && (
            <button onClick={e=>{e.stopPropagation();onFlashlight(stone)}} style={{ background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', border:'none', borderRadius:8, padding:'5px 10px', color:'#e9d5ff', fontSize:10, fontWeight:700, cursor:'pointer' }}>🔦 打灯 -¥{FLASHLIGHT_COST}</button>
          )}
          {channel === 'auction' && (
            <button onClick={e=>{e.stopPropagation();onBid?.(stone)}} style={{ background:'linear-gradient(135deg,#b45309,#d97706)', border:'none', borderRadius:9, padding:'6px 14px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>🏷️ 竞标</button>
          )}
          {channel === 'premium' && !disabled && (
            <>
              <button onClick={e=>{e.stopPropagation();onBargain?.(stone)}} style={{ background:'linear-gradient(135deg,#4338ca,#6366f1)', border:'none', borderRadius:8, padding:'5px 10px', color:'#c7d2fe', fontSize:10, fontWeight:700, cursor:'pointer' }}>🗣️ 砍价</button>
              {canAfford && <button onClick={e=>{e.stopPropagation();onBuy(stone, 'premium')}} style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:9, padding:'6px 14px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>购买</button>}
            </>
          )}
          {channel === 'kg' && canAfford && !disabled && (
            <button onClick={e=>{e.stopPropagation();onBuy(stone, 'kg')}} style={{ background:'linear-gradient(135deg,#059669,#10b981)', border:'none', borderRadius:9, padding:'6px 14px', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>购买</button>
          )}
          {disabled && <span style={{ color:'#94a3b8', fontSize:11 }}>今日不可购</span>}
          {!canAfford && !disabled && channel !== 'auction' && <span style={{ color:'#334155', fontSize:11 }}>资金不足</span>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：工作台卡片（含三种处理按钮）
// ═══════════════════════════════════════════════════════════
function WorkbenchCard({ stone, onCut, onSell, onNpc, onCollect, onOpenWindow, onSellSemi, onCarving, onLiveSell, cutValueMult = 1, money, liveStreamLevel }) {
  const isCut = !!stone.cutResult
  const r = stone.cutResult
  const w = stone.windowOpened
  const q = QUALITY_CONFIG[stone.quality]
  const [cutting, setCutting] = useState(false)
  const canCollect = isCut && stone.collectible && !stone.sold
  const semiValue = w ? Math.round(stone.price * w.semiMultiplier) : 0
  const semiProfit = semiValue - stone.price
  const canOpenWindow = !isCut && !w && !stone.noWindow && money >= WINDOW_OPEN_COST && onOpenWindow

  const handleCut = () => {
    if (cutting) return
    setCutting(true)
    setTimeout(() => { onCut(stone.id); setCutting(false) }, 580)
  }

  const polishBoost = stone.polished?.qualityBoost ?? 1
  const saleValue = isCut ? Math.round(stone.price * r.multiplier * cutValueMult * polishBoost) : (w ? semiValue : 0)
  const profit = isCut ? (saleValue - stone.price) : (w ? semiProfit : 0)

  return (
    <div className={cutting ? 'animate-crack' : ''} style={{
      background: isCut ? `linear-gradient(145deg,${r.gradientFrom},${r.gradientTo})` : 'linear-gradient(145deg,rgba(15,23,42,.95),rgba(28,39,56,.92))',
      border:`1px solid ${isCut ? r.borderColor+'bb' : q.border+'55'}`,
      borderRadius:14, padding:13, position:'relative', overflow:'hidden',
      transition:'all 0.4s ease',
      boxShadow: isCut && r.sparkle ? `0 0 22px ${r.borderColor}55, 0 4px 16px rgba(0,0,0,.4)` : '0 2px 8px rgba(0,0,0,.3)',
      opacity: stone.sold ? 0.45 : 1,
    }}>
      {isCut && r.sparkle && <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse at 50% 0%,${r.borderColor}25 0%,transparent 55%)`, pointerEvents:'none' }} />}

      {/* 精品徽章 */}
      {stone.collectible && !stone.sold && (
        <div style={{ position:'absolute', top:7, left:7, zIndex:10 }}>
          <span style={{ background:'rgba(120,53,15,.9)', color:'#fde68a', fontSize:9, padding:'2px 7px', borderRadius:20, fontWeight:700, border:'1px solid #d9770688' }}>✦ 精品</span>
        </div>
      )}

      {isCut && (
        <div style={{ position:'absolute', top:7, right:7, zIndex:10 }}>
          <span style={{ background:r.badgeBg, color:r.badgeText, fontSize:9, padding:'2px 7px', borderRadius:20, fontWeight:700, border:`1px solid ${r.borderColor}88` }}>{r.grade}</span>
        </div>
      )}

      {/* 图标 */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:8, marginTop: isCut ? 3 : 0 }}>
        {isCut ? (
          <div style={{ fontSize:40, lineHeight:1, filter: r.sparkle ? `drop-shadow(0 0 10px ${r.borderColor})` : 'none' }}>{r.emoji}</div>
        ) : (
          <div className={cutting ? 'animate-crack' : 'animate-float'}><StoneVisual stone={stone} size="md" glowing /></div>
        )}
      </div>

      {/* 信息 */}
      <div style={{ textAlign:'center', marginBottom:7 }}>
        <p style={{ color:'#e2e8f0', fontWeight:700, fontSize:12 }}>{stone.name}</p>
        {isCut ? (
          <>
            <p style={{ color:r.textColor, fontSize:12, fontWeight:700, marginTop:2 }}>{r.name}{stone.polished && <span style={{ fontSize:10, color:'#4ade80', marginLeft:4 }}>·盘货+{((stone.polished.qualityBoost-1)*100).toFixed(0)}%</span>}</p>
            {stone.collectible && <p style={{ color:'#fde68a', fontSize:10, marginTop:1 }}>🏺 {stone.collectible.name}</p>}
          </>
        ) : w ? (
          <>
            <p style={{ color: w.semiMultiplier >= 1.2 ? '#4ade80' : w.semiMultiplier <= 0.7 ? '#f87171' : '#fbbf24', fontSize:11, fontWeight:700, marginTop:2 }}>半明料 · {w.hint || '开窗'}</p>
            <p style={{ color:'#64748b', fontSize:10 }}>估值 ¥{semiValue.toLocaleString()}</p>
          </>
        ) : (
          <p style={{ color:'#475569', fontSize:10, marginTop:2 }}>{stone.sizeData.label} · {stone.sizeData.weight}kg</p>
        )}
      </div>

      {/* 价格 */}
      <div style={{ background:'rgba(0,0,0,.28)', borderRadius:8, padding:'5px 8px', marginBottom:8, textAlign:'center' }}>
        <span style={{ color:'#fbbf24', fontSize:11 }}>成本 ¥{stone.price.toLocaleString()}</span>
        {(isCut || w) && (
          <>
            <span style={{ color:'#475569', margin:'0 5px', fontSize:10 }}>→</span>
            <span style={{ color: profit >= 0 ? '#86efac' : '#fca5a5', fontWeight:800, fontSize:12 }}>¥{saleValue.toLocaleString()}</span>
            <span style={{ display:'block', fontSize:10, marginTop:1, color: profit >= 0 ? '#4ade80' : '#f87171' }}>
              {profit >= 0 ? '+' : ''}¥{profit.toLocaleString()}
            </span>
          </>
        )}
      </div>

      {/* 操作按钮区 */}
      {stone.sold ? (
        <div style={{ textAlign:'center', fontSize:11, color:'#334155', padding:'3px 0' }}>✓ 已处置</div>
      ) : !isCut ? (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {w ? (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:5 }}>
                <button onClick={() => onSellSemi(stone.id)} style={{
                  padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#047857,#059669)', color:'#fff', fontSize:10, fontWeight:700,
                  boxShadow:'0 2px 6px rgba(5,150,105,.4)',
                }}>💰 直接卖</button>
                <button onClick={() => onNpc(stone.id)} style={{
                  padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff', fontSize:10, fontWeight:700,
                  boxShadow:'0 2px 6px rgba(37,99,235,.4)',
                }}>🤝 找NPC</button>
                <button onClick={handleCut} disabled={cutting} style={{
                  padding:'6px 0', borderRadius:8, border:'none', cursor: cutting ? 'not-allowed' : 'pointer',
                  background: cutting ? '#78350f' : 'linear-gradient(135deg,#b45309,#d97706)', color:'#fff', fontSize:10, fontWeight:700,
                  boxShadow:'0 2px 6px rgba(217,119,6,.4)',
                }}>{cutting ? '...' : '⚒️ 切开'}</button>
              </div>
            </>
          ) : (
            <>
              {canOpenWindow && (
                <button onClick={() => onOpenWindow(stone.id)} style={{
                  width:'100%', padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
                  background:'linear-gradient(135deg,#4338ca,#6366f1)', color:'#c7d2fe', fontSize:11, fontWeight:700,
                }}>🔍 开皮擦窗 -¥{WINDOW_OPEN_COST}</button>
              )}
              <button onClick={handleCut} disabled={cutting} style={{
                width:'100%', padding:'7px 0', borderRadius:9, border:'none',
                background: cutting ? 'linear-gradient(135deg,#78350f,#92400e)' : 'linear-gradient(135deg,#b45309,#d97706)',
                color:'#fff', fontSize:12, fontWeight:700, cursor: cutting ? 'not-allowed' : 'pointer',
                boxShadow:'0 2px 8px rgba(217,119,6,.4)',
              }}>{cutting ? '⚒️ 切割中...' : '⚒️ 一刀切开'}</button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
            <button onClick={() => onSell(stone.id)} style={{
              padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#065f46,#059669)', color:'#fff', fontSize:11, fontWeight:700,
              boxShadow:'0 2px 6px rgba(5,150,105,.4)',
            }}>💰 直接卖</button>
            <button onClick={() => onNpc(stone.id)} style={{
              padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#1e3a8a,#2563eb)', color:'#fff', fontSize:11, fontWeight:700,
              boxShadow:'0 2px 6px rgba(37,99,235,.4)',
            }}>🤝 找NPC</button>
          </div>
          {isCut && !stone.polished && onCarving && (
            <button onClick={() => onCarving(stone.id)} style={{
              width:'100%', padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#78350f,#92400e)', color:'#fef3c7', fontSize:10, fontWeight:700,
            }}>🔨 送雕刻大师盘货</button>
          )}
          {liveStreamLevel >= 1 && isCut && onLiveSell && (
            <button onClick={() => onLiveSell(stone.id)} style={{
              width:'100%', padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#a21caf,#c026d3)', color:'#fae8ff', fontSize:10, fontWeight:700,
            }}>📺 直播售卖</button>
          )}
          {canCollect && (
            <button onClick={() => onCollect(stone.id)} style={{
              width:'100%', padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer',
              background:'linear-gradient(135deg,#78350f,#d97706)', color:'#fff', fontSize:11, fontWeight:700,
              boxShadow:'0 2px 6px rgba(217,119,6,.4)',
            }}>🏺 收藏升值</button>
          )}
        </div>
      )}
    </div>
  )
}

// 察觉风险的颜色（0=安全, 0.5=警告, 1=极危险）
function detectRiskColor(chance) {
  if (chance <= 0.15) return '#4ade80'
  if (chance <= 0.40) return '#fbbf24'
  if (chance <= 0.65) return '#fb923c'
  return '#f87171'
}
function detectRiskLabel(chance) {
  if (chance <= 0.15) return '风险极低'
  if (chance <= 0.40) return '有点风险'
  if (chance <= 0.65) return '风险较高'
  if (chance <= 0.85) return '非常危险'
  return '必被识破'
}

// ═══════════════════════════════════════════════════════════
//  子组件：NPC 交易弹窗（网格选人 + 侧边详情）
// ═══════════════════════════════════════════════════════════
function NpcModal({ stone, npcRelations, onSellToNpc, onClose, npcOfferMult = 1, cutValueMult = 1 }) {
  const isSemi = !stone.cutResult && stone.windowOpened
  const cutResult = stone.cutResult || (isSemi ? { id: 'waxy', name: `半明料 · ${stone.windowOpened.hint || '开窗'}`, multiplier: stone.windowOpened.semiMultiplier } : null)
  if (!cutResult) return null
  const polishBoost = stone.polished?.qualityBoost ?? 1
  const baseValue = Math.round(stone.price * cutResult.multiplier * (isSemi ? 1 : cutValueMult) * (isSemi ? 1 : polishBoost))
  const isBrick   = cutResult.id === 'brick'
  const [selectedId, setSelectedId] = useState(null)

  // 随机抽 3~6 个NPC（符合品级 + 相性优先 + 稳定，只在弹窗打开时抽一次）
  const [availableNpcs] = useState(() => {
    const gradeIdx = GRADE_ORDER.indexOf(cutResult.id)
    const pool = NPC_LIST.filter(npc => {
      if (isBrick) return true
      return gradeIdx >= GRADE_ORDER.indexOf(npc.minGrade)
    })
    // 相性NPC单独提取，优先放入
    const affinity = pool.filter(n => n.affinityGrades.includes(cutResult.id))
    const rest     = pool.filter(n => !n.affinityGrades.includes(cutResult.id))
    // 打乱 rest
    const shuffled = [...rest].sort(() => Math.random() - 0.5)
    const count    = Math.min(Math.max(3, rndInt(3, 6)), pool.length)
    // 先放相性（最多2个），再从 rest 补足
    const affinityPick = affinity.sort(() => Math.random() - 0.5).slice(0, 2)
    const restPick     = shuffled.slice(0, count - affinityPick.length)
    // 再打乱整体顺序
    return [...affinityPick, ...restPick].sort(() => Math.random() - 0.5)
  })

  // 稳定报价（只计算一次）
  const [offerMap] = useState(() => {
    const m = {}
    availableNpcs.forEach(npc => {
      const deals = npcRelations[npc.id] || 0
      m[npc.id] = {
        offer:      getNpcOffer(npc, baseValue, cutResult.id, deals),
        deals,
        lv:         getNpcLevel(deals),
        isAffinity: npc.affinityGrades.includes(cutResult.id),
        dialog: (() => {
          const lv = getNpcLevel(deals)
          const g  = npc.dialogs[Math.min(lv, npc.dialogs.length - 1)]
          return Array.isArray(g) ? pick(g) : g
        })(),
      }
    })
    return m
  })

  const selected = selectedId ? availableNpcs.find(n => n.id === selectedId) : null
  const selData  = selected ? offerMap[selected.id] : null

  return (
    <div onClick={onClose} className="modal-overlay" style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.82)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
      <div onClick={e => e.stopPropagation()} className="npc-modal-box" style={{
        background:'linear-gradient(160deg,#060d1c,#0c1a30)',
        border:`1px solid ${isBrick ? 'rgba(239,68,68,.45)' : 'rgba(51,65,85,.75)'}`,
        borderRadius:22, width:'100%', maxWidth:860, height:'88vh', maxHeight:'95dvh',
        display:'flex', flexDirection:'column',
        boxShadow:`0 32px 80px ${isBrick ? 'rgba(180,30,30,.55)' : 'rgba(0,0,0,.85)'}`, overflow:'hidden',
      }}>

        {/* ── 顶栏 ── */}
        <div style={{ padding:'12px 14px', borderBottom:`1px solid ${isBrick ? 'rgba(239,68,68,.22)' : 'rgba(30,41,59,.65)'}`, background: isBrick ? 'rgba(35,6,6,.85)' : 'rgba(8,15,28,.75)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
            <span style={{ fontSize:20 }}>{isBrick ? '⚠️' : '🤝'}</span>
            <div>
              <p style={{ fontWeight:800, fontSize:15, color: isBrick ? '#fca5a5' : '#f1f5f9', margin:0 }}>
                {isBrick ? '混水摸鱼模式' : '找 NPC 交易'}
              </p>
              <p style={{ fontSize:11, color: isBrick ? '#7f1d1d' : '#475569', margin:0 }}>
                「{stone.name}」→ {cutResult.name}
                {isBrick ? '　⚠️ 各NPC察觉概率不同，被识破将扣好感度！' : `　基础估价 ¥${baseValue.toLocaleString()}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.7)', border:'1px solid rgba(51,65,85,.5)', borderRadius:8, padding:'5px 12px', color:'#64748b', fontSize:12, cursor:'pointer' }}>✕</button>
        </div>

        {/* ── 主体：左侧网格 + 右侧详情 ── */}
        <div className="npc-modal-body" style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* 左侧：NPC 网格 */}
          <div className="npc-modal-left" style={{ width: selected ? 300 : '100%', flexShrink:0, overflowY:'auto', padding:'12px', borderRight: selected ? '1px solid rgba(30,41,59,.6)' : 'none', transition:'width .25s' }}>
            {isBrick && (
              <div style={{ marginBottom:10, padding:'7px 12px', background:'rgba(127,29,29,.35)', borderRadius:10, border:'1px solid rgba(239,68,68,.25)', display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ fontSize:13, flexShrink:0 }}>🎭</span>
                <p style={{ color:'#fca5a5', fontSize:10, margin:0, lineHeight:1.6 }}>
                  砖头料可尝试出售给任意NPC，但被察觉会扣好感度。
                  <br/>点击 NPC 查看察觉风险后再决定！
                </p>
              </div>
            )}

            <div className="npc-modal-grid" style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : 'repeat(4,1fr)', gap:8 }}>
              {availableNpcs.map(npc => {
                const d = offerMap[npc.id]
                const effOffer = Math.round(d.offer * npcOfferMult)
                const lvColor = NPC_LEVEL_COLORS[d.lv]
                const riskColor = detectRiskColor(npc.detectChance)
                const profit = effOffer - stone.price
                const isSelected = selectedId === npc.id
                return (
                  <div
                    key={npc.id}
                    onClick={() => setSelectedId(isSelected ? null : npc.id)}
                    style={{
                      background: isSelected
                        ? `linear-gradient(135deg, ${npc.color}22, ${npc.color}11)`
                        : 'rgba(10,18,32,.85)',
                      border:`1.5px solid ${isSelected ? npc.color : `${npc.color}33`}`,
                      borderRadius:14, padding:'10px 8px', cursor:'pointer',
                      textAlign:'center', position:'relative',
                      boxShadow: isSelected ? `0 0 14px ${npc.color}44` : 'none',
                      transition:'all .18s',
                    }}
                  >
                    {/* 头像 */}
                    <div style={{ position:'relative', display:'inline-block', marginBottom:6 }}>
                      <div style={{
                        width:44, height:44, borderRadius:12, margin:'0 auto',
                        background:`linear-gradient(135deg,${npc.color}33,${npc.color}11)`,
                        border:`2px solid ${npc.color}${d.lv >= 2 ? '88' : '44'}`,
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22,
                        boxShadow: d.lv >= 3 ? `0 0 10px ${npc.color}55` : 'none',
                      }}>{npc.icon}</div>
                      <div style={{
                        position:'absolute', bottom:-4, right:-4,
                        background: lvColor, color:'#000',
                        fontSize:8, fontWeight:800, padding:'1px 4px',
                        borderRadius:6, border:'1.5px solid rgba(6,13,28,.9)',
                      }}>{NPC_LEVEL_ICONS[d.lv]}{d.lv+1}</div>
                    </div>

                    <p style={{ fontWeight:800, fontSize:11, color: npc.color, margin:'0 0 2px', lineHeight:1.2 }}>{npc.name}</p>
                    <p style={{ fontSize:9, color:'#475569', margin:'0 0 5px', lineHeight:1.2 }}>{npc.role}</p>

                    {/* 报价 */}
                    <p style={{ color:'#fbbf24', fontWeight:800, fontSize:13, margin:'0 0 2px' }}>¥{effOffer.toLocaleString()}</p>
                    <p style={{ fontSize:9, color: profit >= 0 ? '#4ade80' : '#f87171', margin:'0 0 4px' }}>
                      {profit >= 0 ? '+' : ''}¥{profit.toLocaleString()}
                    </p>

                    {/* 砖头料显示风险点 */}
                    {isBrick && (
                      <div style={{ width:6, height:6, borderRadius:'50%', background: riskColor, boxShadow:`0 0 5px ${riskColor}`, margin:'0 auto 2px' }} />
                    )}
                    {/* 相性标记 */}
                    {d.isAffinity && !isBrick && (
                      <div style={{ position:'absolute', top:5, right:5, width:8, height:8, borderRadius:'50%', background: npc.color, boxShadow:`0 0 4px ${npc.color}` }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 右侧：选中 NPC 详情 */}
          {selected && selData && (() => {
            const npc = selected
            const d   = selData
            const effOffer = Math.round(d.offer * npcOfferMult)
            const lvColor = NPC_LEVEL_COLORS[d.lv]
            const lvName  = NPC_LEVEL_NAMES[d.lv]
            const lvIcon  = NPC_LEVEL_ICONS[d.lv]
            const [expCur, expMax] = getNpcProgress(d.deals)
            const expPct  = d.lv >= 4 ? 100 : Math.round(expCur / expMax * 100)
            const profit  = effOffer - stone.price
            const riskColor = detectRiskColor(npc.detectChance)
            const riskLabel = detectRiskLabel(npc.detectChance)
            const riskPct   = Math.round(npc.detectChance * 100)
            return (
              <div className="npc-modal-right" style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:12, minWidth:0 }}>

                {/* 头像 + 名片 */}
                <div style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{
                      width:72, height:72, borderRadius:18,
                      background:`linear-gradient(135deg,${npc.color}44,${npc.color}18)`,
                      border:`2.5px solid ${npc.color}88`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:36,
                      boxShadow: d.lv >= 3 ? `0 0 20px ${npc.color}55` : `0 0 8px ${npc.color}22`,
                    }}>{npc.icon}</div>
                    <div style={{ position:'absolute', bottom:-5, right:-5, background: lvColor, color:'#000', fontSize:10, fontWeight:800, padding:'2px 7px', borderRadius:10, border:'2px solid rgba(6,13,28,.9)' }}>
                      {lvIcon} Lv{d.lv+1}
                    </div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:3 }}>
                      <span style={{ fontWeight:900, fontSize:20, color: npc.color }}>{npc.name}</span>
                      <span style={{ fontSize:12, color:'#475569' }}>{npc.fullName}</span>
                    </div>
                    <div style={{ fontSize:11, color:`${npc.color}cc`, marginBottom:6 }}>{npc.role}</div>
                    <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                      {npc.personality.map(p => (
                        <span key={p} style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'rgba(30,41,59,.85)', color:'#94a3b8', border:'1px solid rgba(51,65,85,.5)' }}>{p}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 描述 */}
                <p style={{ fontSize:12, color:'#64748b', lineHeight:1.7, margin:0, background:'rgba(15,23,42,.5)', padding:'8px 12px', borderRadius:10, borderLeft:`3px solid ${npc.color}55` }}>
                  {npc.desc}
                </p>

                {/* 关系等级 */}
                <div style={{ background:'rgba(10,18,32,.7)', borderRadius:12, padding:'10px 14px', border:`1px solid ${lvColor}33` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:12, color: lvColor, fontWeight:700 }}>{lvIcon} {lvName}</span>
                    <span style={{ fontSize:10, color:'#475569' }}>累计交易 {d.deals} 次</span>
                  </div>
                  <div style={{ height:6, background:'rgba(30,41,59,.9)', borderRadius:3, overflow:'hidden', marginBottom:4 }}>
                    <div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${lvColor}88,${lvColor})`, width:`${expPct}%`, transition:'width .4s' }} />
                  </div>
                  {d.lv < 4 ? (
                    <p style={{ fontSize:9, color:'#334155', margin:0 }}>
                      再交易 {expMax - expCur} 次升级 → <span style={{ color:`${NPC_LEVEL_COLORS[d.lv+1]}aa` }}>{getNpcPerkDesc(selected, d.lv+1) || '—'}</span>
                    </p>
                  ) : (
                    <p style={{ fontSize:9, color: lvColor, margin:0 }}>✦ 已达最高关系！当前加成已最大化</p>
                  )}
                </div>

                {/* 相性 */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:'#475569' }}>♡ 相性偏好</span>
                  <span style={{ fontSize:11, color: npc.color, fontWeight:700, background:`${npc.color}18`, padding:'2px 10px', borderRadius:20 }}>{npc.affinity}</span>
                  {d.isAffinity && (
                    <span style={{ fontSize:10, color: npc.color, background:`${npc.color}22`, padding:'2px 8px', borderRadius:20 }}>✦ 当前相性加成 +{(npc.affinityBonus*100).toFixed(0)}%</span>
                  )}
                </div>

                {/* 对话气泡 */}
                <div style={{ background:'rgba(15,23,42,.65)', borderRadius:12, padding:'10px 14px', borderLeft:`3px solid ${npc.color}77` }}>
                  <p style={{ fontSize:10, color:'#94a3b8', margin:0, fontStyle:'italic', lineHeight:1.7 }}>
                    「{d.dialog}」
                  </p>
                </div>

                {/* 砖头料风险 */}
                {isBrick && (
                  <div style={{ background:'rgba(20,5,5,.7)', borderRadius:12, padding:'10px 14px', border:`1px solid ${riskColor}44` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:11, color:'#64748b' }}>👁 察觉风险</span>
                      <span style={{ fontSize:12, color: riskColor, fontWeight:800 }}>{riskLabel}　{riskPct}%</span>
                    </div>
                    <div style={{ height:6, background:'rgba(30,41,59,.9)', borderRadius:3, overflow:'hidden', marginBottom:5 }}>
                      <div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${riskColor}77,${riskColor})`, width:`${riskPct}%` }} />
                    </div>
                    <p style={{ fontSize:10, color:'#7f1d1d', margin:0 }}>
                      被识破：扣 {npc.detectPenalty} 点好感度{d.lv > 0 ? '，可能降级！' : '，但现在是陌生人无法降级'}
                    </p>
                  </div>
                )}

                {/* 报价 + 成交按钮 */}
                <div style={{ background: isBrick ? 'rgba(20,5,5,.8)' : `rgba(10,18,32,.8)`, borderRadius:14, padding:'14px', border:`1px solid ${isBrick ? 'rgba(239,68,68,.3)' : `${npc.color}33`}`, marginTop:'auto' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div>
                      <p style={{ color:'#475569', fontSize:10, margin:'0 0 2px' }}>NPC 出价</p>
                      <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                        <span style={{ color:'#fbbf24', fontWeight:900, fontSize:22 }}>¥{effOffer.toLocaleString()}</span>
                        <span style={{ fontSize:12, color: profit >= 0 ? '#4ade80' : '#f87171', fontWeight:700 }}>
                          {profit >= 0 ? '+' : ''}¥{profit.toLocaleString()}
                        </span>
                        {npcOfferMult !== 1 && <span style={{ fontSize:10, color:'#64748b' }}>×{npcOfferMult.toFixed(2)}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onSellToNpc(stone.id, npc, effOffer)}
                    style={{
                      width:'100%', padding:'12px 0',
                      background: isBrick
                        ? 'linear-gradient(135deg,#7f1d1d,#dc2626)'
                        : `linear-gradient(135deg,${npc.color}cc,${npc.color})`,
                      border:'none', borderRadius:11,
                      color: isBrick ? '#fca5a5' : '#000',
                      fontSize:14, fontWeight:800, cursor:'pointer',
                      boxShadow:`0 4px 14px ${isBrick ? 'rgba(220,38,38,.45)' : `${npc.color}55`}`,
                    }}
                  >{isBrick ? `🎭 碰运气（察觉率 ${riskPct}%）` : `✓ 成交 ¥${effOffer.toLocaleString()}`}</button>
                </div>

              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：专属雕刻大师盘货
// ═══════════════════════════════════════════════════════════
const GRADE_LABELS = { brick:'砖头', waxy:'糯种', flower:'花青', ice:'冰种', glass:'玻璃种', imperial:'帝王绿' }
function hasStoneFlaw(stone) {
  return stone?.hiddenTag && FLAW_AFFIXES.includes(stone.hiddenTag)
}
function CarvingModal({ stone, money, cutValueMult, masters, relations, masterState, currentDay, usesToday, onSelect, onClose }) {
  if (!stone || !stone.cutResult || stone.polished) return null
  const cutId = stone.cutResult.id
  const baseVal = Math.round(stone.price * stone.cutResult.multiplier * cutValueMult)
  const ms = masterState || {}
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#1c1917,#0f172a)', border:'1px solid rgba(251,191,36,.4)', borderRadius:18, padding:24, maxWidth:560, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
        <h3 style={{ margin:'0 0 8px', color:'#fef3c7' }}>🔨 送专属雕刻大师</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:12 }}>「{stone.name}」→ {stone.cutResult.name}，基础估值 ¥{baseVal.toLocaleString()}</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {masters.map(m => {
            let canAccept = true, hint = '', hintColor = '#94a3b8', est = ''
            const insp = ms[m.id]?.inspiration ?? 50
            const strike = (ms[m.id]?.strikeUntilDay ?? 0) > currentDay
            const sick = (ms[m.id]?.sickUntilDay ?? 0) > currentDay
            if (strike || sick) { canAccept = false; hint = strike ? '罢工中' : '生病休养中'; hintColor = '#f87171' }
            else if (m.id === 'chu_shi_weng') {
              if (CHU_HATE.includes(cutId)) { canAccept = false; hint = '嫌弃砖头/豆种，硬塞会罢工！'; hintColor = '#f87171' }
              else { hint = CHU_LOVE.includes(cutId) ? '♥偏爱' : '○可雕'; est = `约 ¥${Math.round(baseVal * 1.5).toLocaleString()}~${Math.round(baseVal * 2).toLocaleString()}，点石成金 x10` }
            } else if (m.id === 'gui_shou_a9') {
              const flawed = hasStoneFlaw(stone) || cutId === 'brick'
              hint = flawed ? '♥带裂/癣，40%碎/10% x30暴击' : '完美料可能嫌无聊'
              est = flawed ? '高风险高回报' : '正常倍率'
            } else if (m.id === 'qiao_niang_jinyan') {
              const minMoney = m.interactCosts?.hongbao ?? 50000
              if (money < minMoney) { canAccept = false; hint = `资金不足 ¥${minMoney.toLocaleString()} 她不动手`; hintColor = '#f87171' }
              else { hint = '无风险，上限2x+2戒面'; est = `¥${Math.round(Math.min(baseVal * 2, baseVal * 2)).toLocaleString()} 稳` }
            }             else if (m.id === 'kumu_chan_shi') {
              if (m.rejectGrades?.includes(cutId)) { canAccept = false; hint = '只雕纯色，不雕花青(见血)'; hintColor = '#f87171' }
              else if (m.acceptGrades && !m.acceptGrades.includes(cutId) && cutId !== 'brick') { canAccept = false; hint = '只接受指定种水' }
              else { hint = '3天取货，开光词缀'; est = `¥${Math.round(baseVal * 2.5).toLocaleString()}，文化圈3x` }
            } else if (m.dailyLimit && (usesToday?.[m.id] || 0) >= m.dailyLimit) {
              canAccept = false
              hint = '今日已接满'
              hintColor = '#f87171'
            } else if (m.acceptGrades && !m.noPreference) {
              if (m.rejectGrades?.includes(cutId) || !m.acceptGrades.includes(cutId)) { canAccept = false; hint = `只接受${(m.acceptGrades||[]).map(g=>GRADE_LABELS[g]).join('/')}`; hintColor = '#f87171' }
              else { hint = '○可雕'; est = `约 ¥${Math.round(baseVal * (m.baseMult?.[0]||1.2)).toLocaleString()}~${Math.round(baseVal * (m.baseMult?.[1]||1.6)).toLocaleString()}` }
            } else {
              hint = m.noPreference ? '○不挑料' : '○可雕'
              const lo = Array.isArray(m.baseMult) ? m.baseMult[0] : (m.baseMult || 1.1)
              const hi = Array.isArray(m.baseMult) ? m.baseMult[1] : (m.baseMult || 1.4)
              est = `约 ¥${Math.round(baseVal * lo).toLocaleString()}~${Math.round(baseVal * hi).toLocaleString()}`
            }
            const disabled = !canAccept
            return (
              <button key={m.id} onClick={()=>canAccept && onSelect(m.id)} disabled={disabled}
                style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:4, padding:'12px 14px', background: disabled ? 'rgba(30,41,59,.8)' : 'rgba(51,65,85,.6)', border: `1px solid ${disabled ? 'rgba(71,85,105,.4)' : 'rgba(251,191,36,.3)'}`, borderRadius:10, color: disabled ? '#64748b' : '#f1f5f9', cursor: disabled ? 'not-allowed' : 'pointer', fontSize:12, textAlign:'left' }}>
                <div style={{ display:'flex', width:'100%', justifyContent:'space-between', alignItems:'center' }}>
                  <span>{m.icon} {m.name} · {m.title}</span>
                  <span style={{ fontSize:10, color: hintColor }}>{hint}</span>
                </div>
                <p style={{ margin:0, fontSize:11, color:'#94a3b8' }}>{m.skillName}：{m.skillDesc}</p>
                {est && <p style={{ margin:'4px 0 0', fontSize:11, color:'#86efac' }}>{est}</p>}
              </button>
            )
          })}
        </div>
        <button onClick={onClose} style={{ marginTop:16, width:'100%', padding:8, background:'#334155', border:'none', borderRadius:8, color:'#94a3b8', cursor:'pointer' }}>取消</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：直播售卖确认
// ═══════════════════════════════════════════════════════════
function LiveSellModal({ stone, cutValueMult, onConfirm, onClose }) {
  if (!stone || !stone.cutResult) return null
  const polishBoost = stone.polished?.qualityBoost ?? 1
  const val = Math.round(stone.price * stone.cutResult.multiplier * cutValueMult * polishBoost)
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#581c87,#0f172a)', border:'1px solid rgba(192,132,252,.5)', borderRadius:18, padding:24, maxWidth:380 }}>
        <h3 style={{ margin:'0 0 8px', color:'#e9d5ff' }}>📺 直播售卖</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:12 }}>「{stone.name}」{stone.cutResult.name}{stone.polished ? ' · 已盘货' : ''}</p>
        <p style={{ color:'#c4b5fd', fontSize:13 }}>估值约 ¥{val.toLocaleString()}，观众将竞拍，好感高的观众出价更高</p>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={onConfirm} style={{ flex:1, padding:12, background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>开播</button>
          <button onClick={onClose} style={{ flex:1, padding:12, background:'#334155', border:'none', borderRadius:10, color:'#94a3b8', cursor:'pointer' }}>取消</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：直播竞拍过程
// ═══════════════════════════════════════════════════════════
function LiveAuctionProcessModal({ data, onComplete }) {
  const [phase, setPhase] = useState('opening')
  const [visibleCount, setVisibleCount] = useState(0)
  useEffect(() => {
    if (!data) return
    const t1 = setTimeout(() => setPhase('bidding'), 800)
    return () => clearTimeout(t1)
  }, [data])
  useEffect(() => {
    if (phase !== 'bidding' || !data?.bids?.length) return
    if (visibleCount >= data.bids.length) {
      const t = setTimeout(() => setPhase('done'), 600)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setVisibleCount(c => c + 1), 500)
    return () => clearTimeout(t)
  }, [phase, visibleCount, data?.bids?.length])
  if (!data?.stone || !data?.bids?.length) return null
  const winner = data.bids[0]
  return (
    <div style={{ position:'fixed', inset:0, zIndex:410, background:'rgba(0,0,0,.88)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#581c87,#0f172a)', border:'1px solid rgba(192,132,252,.5)', borderRadius:18, padding:24, maxWidth:420, width:'100%' }}>
        <h3 style={{ margin:'0 0 12px', color:'#e9d5ff' }}>📺 直播竞拍中</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:16 }}>「{data.stone.name}」{data.stone.cutResult.name}</p>
        {phase === 'opening' && (
          <p style={{ color:'#c4b5fd', fontSize:14 }}>🎬 正在开播，观众陆续进场…</p>
        )}
        {phase === 'bidding' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <p style={{ color:'#a78bfa', fontSize:12, marginBottom:4 }}>出价记录：</p>
            {[...data.bids].reverse().slice(0, visibleCount).map((b, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'rgba(30,41,59,.6)', borderRadius:10, border:'1px solid rgba(71,85,105,.5)' }}>
                <span style={{ color:'#e9d5ff' }}>{b.viewer.icon} {b.viewer.name}</span>
                <span style={{ color:'#fbbf24', fontWeight:700 }}>¥{b.bid.toLocaleString()}</span>
              </div>
            ))}
            {visibleCount < data.bids.length && <p style={{ color:'#64748b', fontSize:11 }}>竞价中...</p>}
          </div>
        )}
        {phase === 'done' && (
          <div style={{ marginTop:8 }}>
            <div style={{ padding:16, background:'linear-gradient(135deg,rgba(34,197,94,.2),rgba(16,185,129,.15))', borderRadius:14, border:'1px solid rgba(34,197,94,.4)', textAlign:'center', marginBottom:16 }}>
              <p style={{ color:'#4ade80', fontSize:16, fontWeight:800, margin:0 }}>🎉 成交！</p>
              <p style={{ color:'#bbf7d0', fontSize:14, margin:'8px 0 0' }}>{winner.viewer.icon} {winner.viewer.name} 以 ¥{winner.bid.toLocaleString()} 拍下</p>
            </div>
            <button onClick={onComplete} style={{ width:'100%', padding:12, background:'linear-gradient(135deg,#7c3aed,#8b5cf6)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer' }}>完成</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：直播间升级
// ═══════════════════════════════════════════════════════════
function LiveStreamUpgradeModal({ level, money, levels, onUpgrade, onClose, viewerFavorability }) {
  const current = levels[level]
  const next = levels[level + 1]
  const canUpgrade = next && next.cost > 0 && money >= next.cost
  const isOpening = level === 0
  const topViewers = level >= 1 && viewerFavorability ? LIVE_VIEWERS.map(v => ({ ...v, fav: viewerFavorability[v.id] || 0 })).sort((a, b) => b.fav - a.fav).slice(0, 5) : []
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#581c87,#0f172a)', border:'1px solid rgba(192,132,252,.5)', borderRadius:18, padding:24, maxWidth:420 }}>
        <h3 style={{ margin:'0 0 8px', color:'#e9d5ff' }}>📺 直播间</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:16 }}>当前：{current?.name || '未开启'} · {current?.desc || ''}</p>
        {level >= 1 && topViewers.length > 0 && (
          <p style={{ color:'#64748b', fontSize:10, marginBottom:8 }}>观众好感 Top5：{topViewers.map(v=>`${v.name}(${v.fav})`).join('、')}</p>
        )}
        {next ? (
          <>
            <p style={{ color:'#c4b5fd', fontSize:12 }}>{isOpening ? '开启' : '下一级'}：{next.name} — {next.desc}</p>
            <p style={{ color:'#fbbf24', fontSize:13, marginTop:8 }}>{isOpening ? '开启' : '升级'}费用 ¥{next.cost.toLocaleString()}</p>
            <button onClick={()=>onUpgrade()} disabled={!canUpgrade}
              style={{ marginTop:12, width:'100%', padding:12, background: canUpgrade ? 'linear-gradient(135deg,#7c3aed,#8b5cf6)' : '#334155', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor: canUpgrade ? 'pointer' : 'not-allowed' }}>
              {canUpgrade ? (isOpening ? '开启直播间' : '升级') : '资金不足'}
            </button>
          </>
        ) : (
          <p style={{ color:'#4ade80', fontSize:12 }}>已达最高级</p>
        )}
        <button onClick={onClose} style={{ marginTop:12, width:'100%', padding:8, background:'#334155', border:'none', borderRadius:8, color:'#94a3b8', cursor:'pointer' }}>关闭</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：神秘黑市（遗物购买）
// ═══════════════════════════════════════════════════════════
function BlackMarketModal({ offers, money, equippedRelics, onBuy, onClose }) {
  const available = offers.filter(id => !equippedRelics.includes(id))
  if (available.length === 0) {
    return (
      <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:450, background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#1c1917,#0f172a)', border:'1px solid rgba(251,191,36,.4)', borderRadius:22, width:'100%', maxWidth:520, padding:28, textAlign:'center' }}>
          <p style={{ fontSize:32, marginBottom:12 }}>🏪</p>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#fbbf24', margin:'0 0 8px' }}>神秘黑市</h2>
          <p style={{ fontSize:13, color:'#94a3b8', margin:'0 0 20px' }}>本批货已售罄，下次再来看看</p>
          <button onClick={onClose} style={{ background:'linear-gradient(135deg,#92400e,#b45309)', border:'none', borderRadius:10, padding:'10px 24px', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>离开</button>
        </div>
      </div>
    )
  }
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:450, background:'rgba(0,0,0,.85)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'linear-gradient(160deg,#1c1917,#0f172a)',
        border:'1px solid rgba(251,191,36,.45)',
        borderRadius:22, width:'100%', maxWidth:640, padding:24,
        boxShadow:'0 24px 60px rgba(251,191,36,.15)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:28 }}>🏪</span>
            <div>
              <h2 style={{ fontSize:18, fontWeight:800, color:'#fbbf24', margin:0 }}>神秘黑市</h2>
              <p style={{ fontSize:11, color:'#64748b', margin:2 }}>局内遗物 · 仅本局生效</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.7)', border:'1px solid rgba(51,65,85,.5)', borderRadius:8, padding:'6px 14px', color:'#64748b', fontSize:12, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {available.slice(0, 3).map(id => {
            const r = RELICS[id]
            if (!r) return null
            const owned = equippedRelics.includes(id)
            const canAfford = money >= r.price
            return (
              <div key={id} style={{
                display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                background: owned ? 'rgba(34,197,94,.08)' : 'rgba(30,41,59,.5)',
                border: owned ? '1px solid rgba(34,197,94,.35)' : '1px solid rgba(51,65,85,.5)',
                borderRadius:14,
              }}>
                <div style={{ width:48, height:48, borderRadius:12, background:'rgba(251,191,36,.15)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{r.icon}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:800, fontSize:14, color:'#f1f5f9', margin:'0 0 4px' }}>{r.name}</p>
                  <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{r.desc}</p>
                </div>
                {owned ? (
                  <span style={{ fontSize:11, color:'#4ade80', fontWeight:700 }}>已装备</span>
                ) : (
                  <button
                    disabled={!canAfford}
                    onClick={() => onBuy(id)}
                    style={{
                      padding:'8px 16px', borderRadius:10, border:'none', fontSize:12, fontWeight:700, cursor: canAfford ? 'pointer' : 'not-allowed',
                      background: canAfford ? 'linear-gradient(135deg,#92400e,#b45309)' : 'rgba(51,65,85,.6)',
                      color: canAfford ? '#fff' : '#475569',
                    }}
                  >¥{r.price.toLocaleString()}</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：已装备道具栏
// ═══════════════════════════════════════════════════════════
function EquippedRelicsBar({ equippedRelics }) {
  if (!equippedRelics?.length) return null
  return (
    <div style={{ background:'rgba(13,20,36,.55)', border:'1px solid rgba(251,191,36,.25)', borderRadius:14, padding:'12px 14px', marginTop:10 }}>
      <p style={{ color:'#92400e', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>RELIC · 已装备道具</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {equippedRelics.map(id => {
          const r = RELICS[id]
          if (!r) return null
          return (
            <div key={id} title={r.desc} style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 10px',
              background:'rgba(251,191,36,.1)', border:'1px solid rgba(251,191,36,.35)',
              borderRadius:10, fontSize:11, color:'#fcd34d', fontWeight:600,
            }}>
              <span>{r.icon}</span>
              <span>{r.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：每日随机事件全屏弹窗
// ═══════════════════════════════════════════════════════════
function EventModal({ event, onConfirm }) {
  if (!event) return null
  const isPos = event.type === 'positive'
  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.9)', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background: isPos ? 'linear-gradient(160deg,#052e16,#0f172a)' : 'linear-gradient(160deg,#1c1917,#0f172a)',
        border: isPos ? '1px solid rgba(34,197,94,.5)' : '1px solid rgba(239,68,68,.5)',
        borderRadius:24, width:'100%', maxWidth:480, padding:32,
        boxShadow: isPos ? '0 0 60px rgba(34,197,94,.25)' : '0 0 60px rgba(239,68,68,.2)',
        textAlign:'center',
      }}>
        <div style={{ fontSize:56, marginBottom:16 }}>{event.icon}</div>
        <p style={{ fontSize:12, color: isPos ? '#4ade80' : '#f87171', margin:'0 0 8px', fontWeight:700 }}>{isPos ? '✦ 增益事件' : '⚠ 负面事件'}</p>
        <h2 style={{ fontSize:22, fontWeight:900, color:'#f1f5f9', margin:'0 0 12px' }}>{event.name}</h2>
        <p style={{ fontSize:14, color:'#94a3b8', lineHeight:1.7, margin:'0 0 20px' }}>{event.desc}</p>
        <p style={{ fontSize:11, color:'#64748b', margin:'0 0 24px' }}>持续 <strong style={{ color: isPos ? '#4ade80' : '#f87171' }}>{event.duration}</strong> 天</p>
        <button
          onClick={onConfirm}
          style={{
            width:'100%', padding:'14px 0', background: isPos ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#b91c1c,#dc2626)',
            border:'none', borderRadius:12, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer',
            boxShadow: isPos ? '0 4px 20px rgba(16,185,129,.4)' : '0 4px 20px rgba(220,38,38,.4)',
          }}
        >确认</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：顶部 Buff/Debuff 跑马灯
// ═══════════════════════════════════════════════════════════
function BuffDebuffBar({ activeEffects, currentDay }) {
  if (!activeEffects?.length) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', maxWidth:400 }}>
      {activeEffects.map(e => {
        const daysLeft = Math.max(0, e.expiresAtDay - currentDay)
        const isPos = e.event?.type === 'positive'
        return (
          <div key={e.eventId} title={`${e.event?.name} - 剩余 ${daysLeft} 天`} style={{
            display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
            background: isPos ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
            border: isPos ? '1px solid rgba(34,197,94,.4)' : '1px solid rgba(239,68,68,.4)',
            fontSize:11, color: isPos ? '#4ade80' : '#fca5a5', fontWeight:700,
          }}>
            <span>{e.event?.icon}</span>
            <span style={{ maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.event?.name}</span>
            <span style={{ opacity:.8, fontSize:10 }}>{daysLeft}d</span>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：NPC 人脉面板（左列表 + 右详情）
// ═══════════════════════════════════════════════════════════
function NpcRosterPanel({ npcRelations, onClose }) {
  const [selectedId, setSelectedId] = useState(NPC_LIST[0].id)
  const npc = NPC_LIST.find(n => n.id === selectedId) || NPC_LIST[0]
  const deals   = npcRelations[npc.id] || 0
  const lv      = getNpcLevel(deals)
  const lvColor = NPC_LEVEL_COLORS[lv]
  const lvName  = NPC_LEVEL_NAMES[lv]
  const lvIcon  = NPC_LEVEL_ICONS[lv]
  const [expCur, expMax] = getNpcProgress(deals)
  const expPct  = lv >= 4 ? 100 : Math.round(expCur / expMax * 100)
  const riskColor = detectRiskColor(npc.detectChance)
  const riskLabel = detectRiskLabel(npc.detectChance)

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.80)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:12 }}>
      <div onClick={e => e.stopPropagation()} className="npc-roster-modal" style={{
        background:'linear-gradient(160deg,#060d1c,#0c1a30)',
        border:'1px solid rgba(51,65,85,.7)',
        borderRadius:22, width:'100%', maxWidth:900, height:'88vh', maxHeight:'95dvh',
        display:'flex', flexDirection:'column',
        boxShadow:'0 32px 80px rgba(0,0,0,.85)', overflow:'hidden',
      }}>

        {/* 顶栏 */}
        <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(30,41,59,.6)', background:'rgba(8,15,28,.8)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
            <span style={{ fontSize:18 }}>👥</span>
            <div>
              <p style={{ fontWeight:800, fontSize:15, color:'#f1f5f9', margin:0 }}>人脉关系档案</p>
              <p style={{ fontSize:11, color:'#334155', margin:0 }}>与 NPC 交易越多，关系越亲密，报价越高，特权越多</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.7)', border:'1px solid rgba(51,65,85,.5)', borderRadius:8, padding:'5px 12px', color:'#64748b', fontSize:12, cursor:'pointer' }}>✕</button>
        </div>

        {/* 主体 */}
        <div className="npc-roster-body" style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>

          {/* ── 左侧：NPC 列表 ── */}
          <div className="npc-roster-left" style={{ width:200, flexShrink:0, overflowY:'auto', borderRight:'1px solid rgba(30,41,59,.6)', padding:'8px 6px' }}>
            {NPC_LIST.map(n => {
              const nd    = npcRelations[n.id] || 0
              const nlv   = getNpcLevel(nd)
              const nlvC  = NPC_LEVEL_COLORS[nlv]
              const isSel = n.id === selectedId
              return (
                <div
                  key={n.id}
                  onClick={() => setSelectedId(n.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                    borderRadius:12, cursor:'pointer', marginBottom:2,
                    background: isSel ? `linear-gradient(135deg,${n.color}22,${n.color}0a)` : 'transparent',
                    border:`1px solid ${isSel ? `${n.color}55` : 'transparent'}`,
                    transition:'all .15s',
                  }}
                >
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{
                      width:36, height:36, borderRadius:10,
                      background:`linear-gradient(135deg,${n.color}33,${n.color}11)`,
                      border:`1.5px solid ${n.color}${nlv >= 1 ? '88' : '33'}`,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                      boxShadow: nlv >= 3 ? `0 0 8px ${n.color}55` : 'none',
                    }}>{n.icon}</div>
                    <div style={{ position:'absolute', bottom:-3, right:-3, background: nlvC, color:'#000', fontSize:7, fontWeight:800, padding:'1px 3px', borderRadius:5, border:'1px solid rgba(6,13,28,.9)' }}>{nlv+1}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:12, color: isSel ? n.color : '#cbd5e1', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{n.name}</p>
                    <p style={{ fontSize:9, color: nlvC, margin:0 }}>{NPC_LEVEL_ICONS[nlv]} {NPC_LEVEL_NAMES[nlv]}</p>
                  </div>
                  {nd > 0 && (
                    <div style={{ width:4, height:4, borderRadius:'50%', background: nlvC, flexShrink:0 }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── 右侧：详情 ── */}
          <div className="npc-roster-right" style={{ flex:1, overflowY:'auto', padding:'20px 22px', display:'flex', flexDirection:'column', gap:14, minWidth:0 }}>

            {/* 头像名片区 */}
            <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{
                  width:80, height:80, borderRadius:20,
                  background:`linear-gradient(135deg,${npc.color}55,${npc.color}18)`,
                  border:`3px solid ${npc.color}88`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:40,
                  boxShadow: lv >= 3 ? `0 0 24px ${npc.color}55` : `0 0 8px ${npc.color}22`,
                }}>{npc.icon}</div>
                <div style={{ position:'absolute', bottom:-6, right:-6, background: lvColor, color:'#000', fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:12, border:'2px solid rgba(6,13,28,.9)' }}>
                  {lvIcon} Lv{lv+1}
                </div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:4 }}>
                  <span style={{ fontWeight:900, fontSize:24, color: npc.color }}>{npc.name}</span>
                  <span style={{ fontSize:13, color:'#475569' }}>{npc.fullName}</span>
                </div>
                <div style={{ fontSize:12, color:`${npc.color}cc`, marginBottom:8 }}>{npc.role}</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {npc.personality.map(p => (
                    <span key={p} style={{ fontSize:10, padding:'3px 9px', borderRadius:20, background:'rgba(30,41,59,.9)', color:'#94a3b8', border:'1px solid rgba(51,65,85,.5)' }}>{p}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* 描述 */}
            <div style={{ background:'rgba(15,23,42,.55)', borderRadius:12, padding:'10px 14px', borderLeft:`3px solid ${npc.color}66` }}>
              <p style={{ fontSize:12, color:'#64748b', lineHeight:1.8, margin:0 }}>{npc.desc}</p>
            </div>

            {/* 关系等级 */}
            <div style={{ background:'rgba(10,18,32,.7)', borderRadius:14, padding:'14px 16px', border:`1px solid ${lvColor}44` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontSize:14, color: lvColor, fontWeight:800 }}>{lvIcon} {lvName}</span>
                <span style={{ fontSize:11, color:'#475569' }}>累计成交 {deals} 次</span>
              </div>
              <div style={{ height:8, background:'rgba(30,41,59,.9)', borderRadius:4, overflow:'hidden', marginBottom:6 }}>
                <div style={{ height:'100%', borderRadius:4, background:`linear-gradient(90deg,${lvColor}66,${lvColor})`, width:`${expPct}%`, transition:'width .5s' }} />
              </div>
              {/* 五级进度节点 */}
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                {NPC_LEVEL_NAMES.map((name, i) => (
                  <div key={i} style={{ textAlign:'center', flex:1 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', margin:'0 auto 3px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, background: i <= lv ? `${NPC_LEVEL_COLORS[i]}55` : 'rgba(30,41,59,.6)', border:`2px solid ${i <= lv ? NPC_LEVEL_COLORS[i] : '#1e293b'}`, boxShadow: i === lv ? `0 0 8px ${NPC_LEVEL_COLORS[i]}77` : 'none' }}>
                      {i <= lv ? NPC_LEVEL_ICONS[i] : '·'}
                    </div>
                    <p style={{ fontSize:8, margin:0, color: i <= lv ? NPC_LEVEL_COLORS[i] : '#334155' }}>{name}</p>
                  </div>
                ))}
              </div>
              {lv < 4 ? (
                <p style={{ fontSize:10, color:'#334155', margin:0 }}>
                  距下一级「{NPC_LEVEL_NAMES[lv+1]}」还需 {expMax - expCur} 次 → 解锁：<span style={{ color:`${NPC_LEVEL_COLORS[lv+1]}bb` }}>{getNpcPerkDesc(npc, lv+1) || '—'}</span>
                </p>
              ) : (
                <p style={{ fontSize:10, color: lvColor, margin:0 }}>✦ 已达最高关系！所有特权全部解锁！</p>
              )}
            </div>

            {/* 两列：相性 + 察觉风险 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div style={{ background:'rgba(10,18,32,.6)', borderRadius:12, padding:'12px', border:`1px solid ${npc.color}33` }}>
                <p style={{ fontSize:10, color:'#475569', margin:'0 0 6px', fontWeight:700 }}>♡ 相性偏好</p>
                <p style={{ fontSize:12, color: npc.color, fontWeight:700, margin:'0 0 4px' }}>{npc.affinity}</p>
                <p style={{ fontSize:10, color:'#334155', margin:'0 0 6px' }}>相性料额外加价 +{(npc.affinityBonus*100).toFixed(0)}%</p>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {npc.affinityGrades.filter(g => g !== 'brick').map(g => {
                    const r = CUT_MAP[g]
                    return r ? (
                      <span key={g} style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:`${npc.color}18`, color: npc.color, border:`1px solid ${npc.color}33` }}>
                        {r.emoji} {r.name}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
              <div style={{ background:'rgba(10,18,32,.6)', borderRadius:12, padding:'12px', border:`1px solid ${riskColor}33` }}>
                <p style={{ fontSize:10, color:'#475569', margin:'0 0 6px', fontWeight:700 }}>👁 察觉能力</p>
                <p style={{ fontSize:12, color: riskColor, fontWeight:700, margin:'0 0 4px' }}>{riskLabel}</p>
                <div style={{ height:5, background:'rgba(30,41,59,.9)', borderRadius:3, overflow:'hidden', marginBottom:5 }}>
                  <div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${riskColor}66,${riskColor})`, width:`${Math.round(npc.detectChance*100)}%` }} />
                </div>
                <p style={{ fontSize:10, color:'#334155', margin:0 }}>砖头料察觉率 {Math.round(npc.detectChance*100)}%，被识破扣 {npc.detectPenalty} 点</p>
              </div>
            </div>

            {/* 全局特权（Lv3 老朋友解锁） */}
            {npc.globalPerk && (
              <div style={{ background: lv >= (npc.globalPerk.unlockAtLv ?? 2) ? 'rgba(34,197,94,.08)' : 'rgba(10,18,32,.6)', borderRadius:12, padding:'12px 14px', border: `1px solid ${lv >= (npc.globalPerk.unlockAtLv ?? 2) ? 'rgba(34,197,94,.4)' : 'rgba(30,41,59,.6)'}` }}>
                <p style={{ fontSize:10, color: lv >= (npc.globalPerk.unlockAtLv ?? 2) ? '#4ade80' : '#475569', margin:'0 0 6px', fontWeight:700 }}>🎯 全局特权（老朋友解锁）</p>
                <p style={{ fontSize:12, color: npc.color, fontWeight:700, margin:'0 0 4px' }}>{npc.globalPerk.name}</p>
                <p style={{ fontSize:11, color:'#64748b', margin:0 }}>{npc.globalPerk.desc}</p>
                {lv >= (npc.globalPerk.unlockAtLv ?? 2) ? <span style={{ fontSize:10, color:'#4ade80', marginTop:6, display:'block' }}>✓ 已生效</span> : <span style={{ fontSize:10, color:'#64748b', marginTop:6, display:'block' }}>距「老朋友」还需 {NPC_EXP_TABLE[2] - deals} 次</span>}
              </div>
            )}

            {/* 已解锁特权 */}
            <div style={{ background:'rgba(10,18,32,.6)', borderRadius:12, padding:'12px 14px', border:`1px solid rgba(30,41,59,.6)` }}>
              <p style={{ fontSize:10, color:'#475569', margin:'0 0 8px', fontWeight:700 }}>✦ 关系特权进度</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[1,2,3,4].map((i) => {
                  const desc = getNpcPerkDesc(npc, i)
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:16, height:16, borderRadius:'50%', flexShrink:0, background: i <= lv ? `${NPC_LEVEL_COLORS[i]}55` : 'rgba(30,41,59,.6)', border:`1.5px solid ${i <= lv ? NPC_LEVEL_COLORS[i] : '#1e293b'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9 }}>
                        {i <= lv ? '✓' : '·'}
                      </div>
                      <p style={{ fontSize:11, color: i <= lv ? '#e2e8f0' : '#334155', margin:0, flex:1 }}>
                        <span style={{ color: NPC_LEVEL_COLORS[i], fontWeight:700 }}>{NPC_LEVEL_NAMES[i]}</span>　{desc || '—'}
                      </p>
                      {i <= lv && <span style={{ fontSize:9, color: NPC_LEVEL_COLORS[i] }}>已解锁</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 报价区间 */}
            <div style={{ background:'rgba(10,18,32,.6)', borderRadius:12, padding:'12px 14px', border:'1px solid rgba(30,41,59,.6)' }}>
              <p style={{ fontSize:10, color:'#475569', margin:'0 0 8px', fontWeight:700 }}>💰 当前出价区间</p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:11, color:'#f87171' }}>
                  最低 ×{(npc.bonusRange[0] * getNpcOfferModifiers(npc, lv).offerMultiplier).toFixed(2)}
                </span>
                <div style={{ flex:1, height:4, background:'rgba(30,41,59,.8)', borderRadius:2, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', left:`${npc.bonusRange[0]*50}%`, right:`${(1-npc.bonusRange[1])*50}%`, height:'100%', background:`linear-gradient(90deg,#f87171,#fbbf24,#4ade80)` }} />
                </div>
                <span style={{ fontSize:11, color:'#4ade80' }}>
                  最高 ×{(npc.bonusRange[1] * getNpcOfferModifiers(npc, lv).offerMultiplier).toFixed(2)}
                </span>
              </div>
              <p style={{ fontSize:9, color:'#334155', margin:'5px 0 0' }}>
                接受最低品质：{CUT_MAP[npc.minGrade]?.name || '砖头料'}　出价 ×{npc.bonusRange[0]}～×{npc.bonusRange[1]}（Lv{lv+1}技能加成后）
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：收藏品面板
// ═══════════════════════════════════════════════════════════
function CollectionPanel({ collection, currentDay, onSell, onClose, collectionAppreciateBoost = 0 }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'linear-gradient(160deg,#0a1628,#0f1f38)', border:'1px solid rgba(251,191,36,.3)',
        borderRadius:22, width:'100%', maxWidth:560, maxHeight:'80vh', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 60px rgba(0,0,0,.7)', overflow:'hidden',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(30,41,59,.7)', background:'rgba(15,23,42,.6)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span style={{ fontSize:18 }}>🏛️</span>
            <div>
              <p style={{ fontWeight:800, fontSize:15, color:'#fde68a', margin:0 }}>私人藏馆</p>
              <p style={{ fontSize:11, color:'#92400e', margin:0 }}>第 {currentDay} 天 · 持有 {collection.length} 件</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(51,65,85,.6)', borderRadius:8, padding:'4px 10px', color:'#64748b', fontSize:12, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          {collection.length === 0 ? (
            <div style={{ textAlign:'center', padding:'50px 0', color:'#334155' }}>
              <p style={{ fontSize:32, marginBottom:10 }}>🏺</p>
              <p style={{ fontSize:13 }}>还没有收藏品，切出冰种以上才能收藏哦！</p>
            </div>
          ) : collection.map(item => {
            const daysHeld = currentDay - item.acquiredDay
            const effRate = item.appreciatePerDay * (1 + collectionAppreciateBoost)
            const currentValue = Math.round(item.baseValue * Math.pow(1 + effRate, daysHeld))
            const gain = currentValue - item.stoneCost
            const gainPct = ((currentValue / item.baseValue - 1) * 100).toFixed(1)
            return (
              <div key={item.instanceId} style={{
                background:'linear-gradient(135deg,rgba(120,53,15,.3),rgba(30,15,5,.6))',
                border:'1px solid rgba(251,191,36,.25)', borderRadius:14, padding:'12px 14px',
                display:'flex', alignItems:'center', gap:12,
              }}>
                <div style={{ fontSize:36, filter:'drop-shadow(0 0 8px #d9770688)', flexShrink:0 }}>{item.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'#fde68a', fontWeight:700, fontSize:13, margin:'0 0 3px' }}>{item.name}</p>
                  <p style={{ color:'#92400e', fontSize:10, margin:'0 0 6px' }}>{item.desc}</p>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, color:'#64748b' }}>持有 {daysHeld} 天</span>
                    <span style={{ fontSize:10, color:'#4ade80' }}>年化+{(effRate*100).toFixed(1)}%/天{collectionAppreciateBoost > 0 && <span style={{ color:'#22d3ee', marginLeft:4 }}>↑李教授</span>}</span>
                    <span style={{ fontSize:10, color: gain >= 0 ? '#fbbf24' : '#f87171' }}>
                      {gainPct > 0 ? '+' : ''}{gainPct}%
                    </span>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ color:'#fbbf24', fontWeight:800, fontSize:14, margin:'0 0 2px' }}>¥{currentValue.toLocaleString()}</p>
                  <p style={{ color:'#475569', fontSize:10, margin:'0 0 8px' }}>成本¥{item.stoneCost.toLocaleString()}</p>
                  <button onClick={() => onSell(item.instanceId, currentValue)} style={{
                    background:'linear-gradient(135deg,#065f46,#059669)', border:'none', borderRadius:8,
                    padding:'5px 12px', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer',
                  }}>出售</button>
                </div>
              </div>
            )
          })}
        </div>

        {collection.length > 0 && (() => {
          const totalCost = collection.reduce((s, i) => s + i.stoneCost, 0)
          const totalNow  = collection.reduce((s, i) => {
            const d = currentDay - i.acquiredDay
            const r = i.appreciatePerDay * (1 + collectionAppreciateBoost)
            return s + Math.round(i.baseValue * Math.pow(1 + r, d))
          }, 0)
          return (
            <div style={{ borderTop:'1px solid rgba(30,41,59,.7)', padding:'12px 20px', background:'rgba(10,16,26,.7)', display:'flex', gap:16, flexShrink:0 }}>
              <div style={{ textAlign:'center', flex:1 }}>
                <p style={{ color:'#334155', fontSize:9, margin:0 }}>总成本</p>
                <p style={{ color:'#f87171', fontWeight:800, fontSize:14, margin:0 }}>¥{totalCost.toLocaleString()}</p>
              </div>
              <div style={{ textAlign:'center', flex:1 }}>
                <p style={{ color:'#334155', fontSize:9, margin:0 }}>当前估值</p>
                <p style={{ color:'#fbbf24', fontWeight:800, fontSize:14, margin:0 }}>¥{totalNow.toLocaleString()}</p>
              </div>
              <div style={{ textAlign:'center', flex:1 }}>
                <p style={{ color:'#334155', fontSize:9, margin:0 }}>浮盈</p>
                <p style={{ color: totalNow-totalCost >= 0 ? '#4ade80' : '#f87171', fontWeight:800, fontSize:14, margin:0 }}>
                  {totalNow-totalCost >= 0?'+':''}¥{(totalNow-totalCost).toLocaleString()}
                </p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：破产清算 / 逃过一劫 弹窗
// ═══════════════════════════════════════════════════════════
function GameOverModal({ info, onRestartSame, onBackMenu }) {
  if (!info) return null
  return (
    <div onClick={onBackMenu} style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.86)', backdropFilter:'blur(16px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'radial-gradient(circle at top,rgba(239,68,68,.35),transparent 55%), linear-gradient(160deg,#020617,#020617 45%,#020617)',
        border:'1px solid rgba(239,68,68,.45)',
        borderRadius:26, width:'100%', maxWidth:520,
        boxShadow:'0 32px 90px rgba(0,0,0,.9)', overflow:'hidden',
      }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid rgba(30,41,59,.8)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(15,23,42,.95)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>💔</span>
            <div>
              <p style={{ margin:0, fontSize:16, fontWeight:900, color:'#fecaca' }}>破产清算 · Game Over</p>
              <p style={{ margin:0, fontSize:11, color:'#4b5563' }}>未能偿还剧本债务，资金链断裂。</p>
            </div>
          </div>
        </div>
        <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ background:'rgba(15,23,42,.8)', borderRadius:14, padding:'12px 14px', border:'1px solid rgba(30,41,59,.8)' }}>
            <p style={{ fontSize:11, color:'#64748b', margin:'0 0 6px' }}>剧本模式</p>
            <p style={{ fontSize:14, color:'#e5e7eb', margin:0, fontWeight:700 }}>{info.modeName}</p>
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:1, background:'rgba(15,23,42,.8)', borderRadius:14, padding:'10px 12px', border:'1px solid rgba(30,41,59,.8)', textAlign:'center' }}>
              <p style={{ fontSize:10, color:'#64748b', margin:0 }}>存活天数</p>
              <p style={{ fontSize:18, fontWeight:900, color:'#facc15', margin:0 }}>第 {info.day} 天</p>
            </div>
            <div style={{ flex:1, background:'rgba(15,23,42,.8)', borderRadius:14, padding:'10px 12px', border:'1px solid rgba(30,41,59,.8)', textAlign:'center' }}>
              <p style={{ fontSize:10, color:'#64748b', margin:0 }}>最终资产</p>
              <p style={{ fontSize:18, fontWeight:900, color:'#4ade80', margin:0 }}>¥{info.money.toLocaleString()}</p>
            </div>
          </div>
          <p style={{ fontSize:11, color:'#9ca3af', margin:0, lineHeight:1.7 }}>
            你未能在第 {info.debtDay} 天偿还债务 <span style={{ color:'#fecaca' }}>¥{info.debtAmount.toLocaleString()}</span>，
            资金链断裂，只能黯然退场。也许换一种剧本、换一批 NPC，下次就能翻身。
          </p>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onBackMenu} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1px solid rgba(55,65,81,.9)', background:'rgba(15,23,42,.9)', color:'#9ca3af', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              返回主菜单
            </button>
            <button onClick={onRestartSame} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#ef4444,#f97316)', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:'0 4px 14px rgba(248,113,113,.5)' }}>
              再来一局（同剧本重开）
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DebtClearModal({ info, onClose }) {
  if (!info) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:450, background:'rgba(0,0,0,.6)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'linear-gradient(160deg,#022c22,#064e3b)',
        border:'1px solid rgba(45,212,191,.6)',
        borderRadius:22, width:'100%', maxWidth:420,
        boxShadow:'0 24px 70px rgba(0,0,0,.8)', overflow:'hidden',
      }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(5,46,22,.8)', background:'rgba(6,24,20,.9)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>😮‍💨</span>
            <div>
              <p style={{ fontSize:15, fontWeight:800, color:'#bbf7d0', margin:0 }}>逃过一劫！</p>
              <p style={{ fontSize:11, color:'#16a34a', margin:0 }}>成功偿还第 {info.day} 天债务</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(15,23,42,.9)', border:'1px solid rgba(15,118,110,.7)', borderRadius:8, padding:'3px 8px', color:'#0d9488', fontSize:11, cursor:'pointer' }}>继续拼命</button>
        </div>
        <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          <p style={{ fontSize:12, color:'#a7f3d0', margin:0 }}>
            本次偿还：<span style={{ fontWeight:800 }}>¥{info.amount.toLocaleString()}</span>
          </p>
          <p style={{ fontSize:11, color:'#6ee7b7', margin:0 }}>
            扣除后余额：<span style={{ fontWeight:700 }}>¥{info.after.toLocaleString()}</span>
          </p>
          {info.nextDay ? (
            <p style={{ fontSize:11, color:'#99f6e4', margin:'4px 0 0' }}>
              下次结算日：第 {info.nextDay} 天，需要准备 <span style={{ fontWeight:700 }}>¥{info.nextAmount.toLocaleString()}</span>。
            </p>
          ) : (
            <p style={{ fontSize:11, color:'#99f6e4', margin:'4px 0 0' }}>
              该剧本所有债务已清空，你现在真正自由了！
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：市场升级弹窗
// ═══════════════════════════════════════════════════════════
function StoneDetailModal({ stone, originConfig, onClose }) {
  if (!stone || !originConfig) return null
  const detailText = originConfig.detail || originConfig.desc
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:290, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0f172a,#1e293b)', border:'1px solid rgba(51,65,85,.8)', borderRadius:16, padding:24, maxWidth:440, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
        <h3 style={{ margin:'0 0 8px', color:'#f1f5f9', fontSize:18 }}>📍 {originConfig.name}场口</h3>
        <p style={{ color:'#64748b', fontSize:11, margin:'0 0 12px' }}>{originConfig.desc}</p>
        <p style={{ color:'#94a3b8', fontSize:12, lineHeight:1.8, margin:'0 0 16px', whiteSpace:'pre-wrap' }}>{detailText}</p>
        <p style={{ color:'#475569', fontSize:10, margin:'0 0 10px', fontWeight:700 }}>切割概率修正</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
          {['brick','waxy','flower','ice','glass','imperial'].map(id => {
            const v = originConfig[id]
            if (v == null) return null
            const labels = { brick:'砖头', waxy:'糯种', flower:'花青', ice:'冰种', glass:'玻璃', imperial:'帝王' }
            return <div key={id} style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:'#64748b' }}>{labels[id]}</span><span style={{ color: v>0?'#4ade80':'#f87171' }}>{v>0?'+':''}{(v*100).toFixed(0)}%</span></div>
          })}
        </div>
        <button onClick={onClose} style={{ marginTop:20, width:'100%', padding:10, background:'#334155', border:'none', borderRadius:8, color:'#e2e8f0', cursor:'pointer' }}>关闭</button>
      </div>
    </div>
  )
}

function BargainModal({ stone, onChooseType, onClose }) {
  if (!stone) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:291, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0f172a,#1e293b)', border:'1px solid rgba(51,65,85,.8)', borderRadius:16, padding:24, maxWidth:360 }}>
        <h3 style={{ margin:'0 0 8px', color:'#f1f5f9' }}>尝试砍价</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:16 }}>「{stone.name}」标价 ¥{stone.price.toLocaleString()}</p>
        <p style={{ color:'#64748b', fontSize:11, marginBottom:12 }}>选一种方式后进入 QTE，停到绿色安全区可+20%成功率</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <button onClick={()=>{onChooseType(stone,'tentative');onClose()}} style={{ padding:12, background:'linear-gradient(135deg,#4338ca,#6366f1)', border:'none', borderRadius:10, color:'#e0e7ff', fontWeight:700, cursor:'pointer' }}>试探（砍10%）基础50% → ¥{Math.round(stone.price*0.9).toLocaleString()}</button>
          <button onClick={()=>{onChooseType(stone,'dragon');onClose()}} style={{ padding:12, background:'linear-gradient(135deg,#7c2d12,#b45309)', border:'none', borderRadius:10, color:'#fef3c7', fontWeight:700, cursor:'pointer' }}>屠龙刀（砍40%）基础10% → ¥{Math.round(stone.price*0.6).toLocaleString()}</button>
        </div>
        <button onClick={onClose} style={{ marginTop:16, width:'100%', padding:8, background:'#334155', border:'none', borderRadius:8, color:'#94a3b8', cursor:'pointer' }}>取消</button>
      </div>
    </div>
  )
}

// QTE 砍价小游戏：横条 + 游标 + 安全区
function BargainQteModal({ stone, type, onComplete, onClose }) {
  const safeZoneWidth = type === 'tentative' ? 0.30 : 0.10
  const zoneStart = 0.15 + Math.random() * (0.85 - safeZoneWidth - 0.15)
  const zoneEnd = zoneStart + safeZoneWidth
  const [state, setState] = useState({ cursor: 0.5, direction: 1, speed: (0.008 + Math.random() * 0.006) * 0.0625, safeStart: zoneStart, safeEnd: zoneEnd, running: true, done: false })
  const cursorRef = useRef(0.5)
  const rafRef = useRef(null)
  const lastTsRef = useRef(0)
  cursorRef.current = state.cursor

  useEffect(() => {
    if (!state.running || state.done) return
    const tick = (ts) => {
      if (!lastTsRef.current) lastTsRef.current = ts
      const dt = Math.min(ts - lastTsRef.current, 50) / 16
      lastTsRef.current = ts
      setState(prev => {
        if (!prev.running || prev.done) return prev
        let next = prev.cursor + prev.direction * prev.speed * 60 * dt
        if (next >= 1) { next = 1; cursorRef.current = next; return { ...prev, cursor: next, direction: -1 } }
        if (next <= 0) { next = 0; cursorRef.current = next; return { ...prev, cursor: next, direction: 1 } }
        cursorRef.current = next
        return { ...prev, cursor: next }
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [state.running, state.done])

  const handleStop = () => {
    if (state.done) return
    lastTsRef.current = 0
    setState(prev => ({ ...prev, running: false, done: true }))
    const cursor = cursorRef.current
    const inZone = cursor >= zoneStart && cursor <= zoneEnd
    setTimeout(() => onComplete(inZone), 150)
  }

  const discount = type === 'tentative' ? 0.10 : 0.40
  const label = type === 'tentative' ? '试探' : '屠龙刀'
  if (!stone) return null
  return (
    <div style={{ position:'fixed', inset:0, zIndex:292, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0f172a,#1e293b)', border:'1px solid rgba(251,191,36,.4)', borderRadius:18, padding:28, maxWidth:420, width:'100%' }}>
        <h3 style={{ margin:'0 0 6px', color:'#fef3c7' }}>🎯 QTE 砍价 · {label}</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:20 }}>「{stone.name}」目标：砍{label === '试探' ? '10%' : '40%'} → ¥{Math.round(stone.price*(1-discount)).toLocaleString()}</p>
        <div style={{ marginBottom:8, fontSize:11, color:'#64748b' }}>停到绿色安全区内 +20% 成功率！</div>
        <div style={{ position:'relative', height:36, background:'rgba(15,23,42,.9)', borderRadius:10, border:'1px solid rgba(51,65,85,.8)', overflow:'hidden' }}>
          <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${state.safeEnd*100}%`, background:'linear-gradient(90deg,transparent,transparent)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', left:`${state.safeStart*100}%`, top:2, bottom:2, width:`${(state.safeEnd-state.safeStart)*100}%`, background:'linear-gradient(90deg,#14532d,#22c55e)', borderRadius:6, boxShadow:'inset 0 0 8px rgba(34,197,94,.6)' }} />
          <div style={{ position:'absolute', left:`${state.cursor*100}%`, top:'50%', transform:'translate(-50%,-50%)', width:6, height:28, background:'#fbbf24', borderRadius:3, boxShadow:'0 0 10px #fbbf24', transition: state.running ? 'none' : 'left .1s ease' }} />
        </div>
        <button onClick={handleStop} disabled={state.done} style={{
          marginTop:20, width:'100%', padding:14, background: state.done ? '#475569' : 'linear-gradient(135deg,#b45309,#d97706)',
          border:'none', borderRadius:12, color:'#fff', fontSize:16, fontWeight:800, cursor: state.done ? 'default' : 'pointer',
          boxShadow: state.done ? 'none' : '0 4px 20px rgba(217,119,6,.5)'
        }}>{state.done ? '结算中...' : '停！'}</button>
      </div>
    </div>
  )
}

function BlindAuctionModal({ stone, money, onSubmitBid, onClose }) {
  const [bid, setBid] = useState('')
  if (!stone) return null
  const base = stone.auctionBasePrice ?? stone.price
  const minBid = Math.max(100, Math.round(base * 0.3))
  const handleSubmit = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    const n = parseInt(bid, 10)
    if (!isNaN(n) && n >= minBid && n <= money) {
      onSubmitBid(stone, n)
      onClose()
    }
  }
  return (
    <div className="modal-overlay" style={{ position:'fixed', inset:0, zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16, pointerEvents:'none' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.82)', pointerEvents:'auto' }} aria-hidden="true" />
      <div className="auction-modal-content" style={{ position:'relative', zIndex:1, background:'linear-gradient(160deg,#1a0a0a,#2d1810)', border:'1px solid rgba(217,119,6,.5)', borderRadius:16, padding:24, maxWidth:400, width:'100%', pointerEvents:'auto' }} onClick={e=>e.stopPropagation()}>
        <h3 style={{ margin:'0 0 8px', color:'#fef3c7' }}>🏷️ 暗标公盘</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:8 }}>「{stone.name}」参考底价 ¥{base.toLocaleString()}</p>
        <p style={{ color:'#64748b', fontSize:11, marginBottom:16 }}>系统将模拟2位NPC出价，你的出价需高于二者才能夺得</p>
        <input type="number" value={bid} onChange={e=>setBid(e.target.value)} placeholder={`最低 ¥${minBid.toLocaleString()}`} min={minBid} max={money}
          style={{ width:'100%', padding:12, background:'#1e293b', border:'1px solid #475569', borderRadius:8, color:'#f1f5f9', fontSize:16, marginBottom:12 }} />
        <div style={{ display:'flex', gap:10 }}>
          <button type="button" onClick={handleSubmit} style={{ flex:1, padding:14, minHeight:48, background:'linear-gradient(135deg,#b45309,#d97706)', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>提交竞标</button>
          <button type="button" onClick={onClose} style={{ padding:14, minHeight:48, background:'#334155', border:'none', borderRadius:10, color:'#94a3b8', cursor:'pointer', touchAction:'manipulation', WebkitTapHighlightColor:'transparent' }}>放弃</button>
        </div>
      </div>
    </div>
  )
}

function UpgradeModal({ marketLevel, money, onUpgrade, onClose }) {
  const current = MARKET_LEVELS[marketLevel - 1]
  const next = MARKET_LEVELS[marketLevel]
  const canAfford = next && money >= next.upgradeCost
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.72)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0f172a,#1e293b)', border:'1px solid rgba(51,65,85,.8)', borderRadius:24, width:'100%', maxWidth:520, boxShadow:'0 24px 60px rgba(0,0,0,.7)', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,rgba(5,46,22,.8),rgba(20,83,45,.6))', borderBottom:'1px solid rgba(52,211,153,.2)', padding:'18px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>🏗️</span>
            <div>
              <p style={{ fontWeight:800, fontSize:16, color:'#f1f5f9', margin:0 }}>市场升级</p>
              <p style={{ fontSize:11, color:'#4ade80', margin:0 }}>扩展进货渠道，解锁更多原石</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(51,65,85,.6)', borderRadius:8, padding:'5px 10px', color:'#64748b', fontSize:13, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'20px 24px' }}>
          {/* 进度 */}
          <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              {MARKET_LEVELS.map(lv => (
                <div key={lv.level} style={{ textAlign:'center', flex:1 }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', margin:'0 auto 4px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, background: lv.level<=marketLevel?`linear-gradient(135deg,${lv.accentColor},${lv.color}66)`:'rgba(30,41,59,.6)', border:`2px solid ${lv.level<=marketLevel?lv.color:'#1e293b'}`, boxShadow: lv.level===marketLevel?`0 0 12px ${lv.color}66`:'none' }}>{lv.level<=marketLevel?lv.icon:'🔒'}</div>
                  <p style={{ fontSize:9, margin:0, color:lv.level<=marketLevel?lv.color:'#334155', fontWeight:lv.level===marketLevel?700:400 }}>Lv{lv.level}</p>
                </div>
              ))}
            </div>
            <div style={{ position:'relative', height:4, background:'rgba(30,41,59,.8)', borderRadius:2, margin:'0 18px' }}>
              <div style={{ position:'absolute', left:0, top:0, height:'100%', borderRadius:2, background:`linear-gradient(90deg,#34d399,${MARKET_LEVELS[marketLevel-1].color})`, width:`${(marketLevel-1)/(MARKET_LEVELS.length-1)*100}%`, transition:'width .6s ease' }} />
            </div>
          </div>
          {/* 当前 */}
          <div style={{ background:'rgba(5,46,22,.3)', border:'1px solid rgba(52,211,153,.2)', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <span style={{ fontSize:18 }}>{current.icon}</span>
              <span style={{ fontWeight:700, color:current.color }}>{current.name}</span>
              <span style={{ fontSize:9, padding:'1px 7px', borderRadius:20, background:'rgba(52,211,153,.15)', color:'#34d399', border:'1px solid rgba(52,211,153,.3)' }}>当前</span>
            </div>
            <p style={{ color:'#64748b', fontSize:11, margin:'0 0 8px' }}>{current.desc}</p>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:10, color:'#94a3b8', background:'rgba(30,41,59,.8)', padding:'2px 8px', borderRadius:20 }}>展示 {current.slotCount} 块</span>
              <span style={{ fontSize:10, color:'#94a3b8', background:'rgba(30,41,59,.8)', padding:'2px 8px', borderRadius:20 }}>刷新 ¥{current.refreshCost}</span>
            </div>
          </div>
          {/* 下一级 */}
          {next ? (
            <div style={{ background: canAfford?'rgba(30,10,5,.4)':'rgba(15,23,42,.4)', border:`1px solid ${canAfford?next.color+'55':'rgba(30,41,59,.6)'}`, borderRadius:12, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:18 }}>{next.icon}</span>
                  <span style={{ fontWeight:700, color:next.color }}>{next.name}</span>
                </div>
                <span style={{ fontWeight:800, fontSize:15, color:canAfford?'#fbbf24':'#dc2626' }}>¥{next.upgradeCost.toLocaleString()}</span>
              </div>
              <p style={{ color:'#64748b', fontSize:11, margin:'0 0 10px' }}>{next.desc}</p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                <span style={{ fontSize:10, color:'#4ade80', background:'rgba(5,46,22,.5)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(74,222,128,.2)' }}>✦ 展示 {next.slotCount} 块</span>
                <span style={{ fontSize:10, color:'#a78bfa', background:'rgba(88,28,135,.3)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(167,139,250,.2)' }}>✦ {next.unlockTip}</span>
              </div>
              {canAfford ? (
                <button onClick={() => onUpgrade(next)} style={{ width:'100%', padding:'11px 0', borderRadius:11, border:'none', background:`linear-gradient(135deg,${next.accentColor},${next.color}dd)`, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', boxShadow:`0 4px 16px ${next.color}44` }}>
                  🚀 升级至「{next.name}」— ¥{next.upgradeCost.toLocaleString()}
                </button>
              ) : (
                <div style={{ width:'100%', padding:'11px 0', borderRadius:11, textAlign:'center', background:'rgba(30,41,59,.5)', color:'#475569', fontSize:13, fontWeight:600 }}>
                  💰 还需 ¥{(next.upgradeCost - money).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background:'linear-gradient(135deg,rgba(120,53,15,.4),rgba(180,83,9,.3))', border:'1px solid rgba(251,191,36,.4)', borderRadius:12, padding:14, textAlign:'center' }}>
              <p style={{ fontSize:24, marginBottom:6 }}>👑</p>
              <p style={{ color:'#fde68a', fontWeight:800, fontSize:15 }}>已达最高等级！</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：概率面板
// ═══════════════════════════════════════════════════════════
function OddsPanel() {
  return (
    <div style={{ background:'rgba(2,6,23,.7)', borderRadius:12, border:'1px solid rgba(30,41,59,.8)', padding:'12px 14px', marginTop:10 }}>
      <p style={{ color:'#334155', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>BASE ODDS · 基础概率</p>
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {CUT_RESULTS.map(r => (
          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, flexShrink:0 }}>{r.emoji}</span>
            <span style={{ color:'#94a3b8', fontSize:11, width:68 }}>{r.name}</span>
            <div style={{ flex:1, height:3, background:'rgba(30,41,59,.9)', borderRadius:3, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:3, background:`linear-gradient(90deg,${r.borderColor},${r.borderColor}66)`, width:`${Math.max(r.baseProbability*230,3)}%` }} />
            </div>
            <span style={{ color:'#475569', fontSize:10, width:24, textAlign:'right' }}>{(r.baseProbability*100).toFixed(0)}%</span>
            <span style={{ color: r.multiplier>=1?'#4ade80':'#f87171', fontSize:10, fontWeight:700, width:30, textAlign:'right' }}>×{r.multiplier}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：日志弹窗
// ═══════════════════════════════════════════════════════════
const LOG_STYLE = {
  buy:      { icon:'🛒', color:'#60a5fa', bg:'rgba(30,58,138,.25)',  border:'rgba(96,165,250,.2)' },
  cut:      { icon:'⚒️', color:'#a3e635', bg:'rgba(63,98,18,.25)',   border:'rgba(163,230,53,.2)' },
  profit:   { icon:'📈', color:'#4ade80', bg:'rgba(5,46,22,.25)',    border:'rgba(74,222,128,.2)' },
  loss:     { icon:'📉', color:'#f87171', bg:'rgba(127,29,29,.25)',  border:'rgba(248,113,113,.2)' },
  npc:      { icon:'🤝', color:'#e879f9', bg:'rgba(112,26,117,.25)', border:'rgba(232,121,249,.2)' },
  collect:  { icon:'🏺', color:'#fbbf24', bg:'rgba(120,53,15,.3)',   border:'rgba(251,191,36,.2)' },
  refresh:  { icon:'🔄', color:'#94a3b8', bg:'rgba(30,41,59,.3)',    border:'rgba(100,116,139,.2)' },
  upgrade:  { icon:'🚀', color:'#fbbf24', bg:'rgba(120,53,15,.3)',   border:'rgba(251,191,36,.2)' },
  system:   { icon:'ℹ️', color:'#64748b', bg:'rgba(15,23,42,.3)',    border:'rgba(51,65,85,.2)'   },
}

function LogModal({ logs, onClose }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0a1628,#0f1f38)', border:'1px solid rgba(51,65,85,.7)', borderRadius:20, width:'100%', maxWidth:580, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,.7)', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(30,41,59,.7)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(15,23,42,.6)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            <span style={{ fontSize:18 }}>📋</span>
            <span style={{ fontWeight:800, fontSize:15, color:'#f1f5f9' }}>交易日志</span>
            <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'rgba(30,41,59,.8)', color:'#475569' }}>共 {logs.length} 条</span>
          </div>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(51,65,85,.6)', borderRadius:8, padding:'4px 10px', color:'#64748b', fontSize:12, cursor:'pointer' }}>✕ 关闭</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'12px 16px', display:'flex', flexDirection:'column', gap:6 }}>
          {logs.length === 0 ? (
            <div style={{ textAlign:'center', padding:'50px 0', color:'#334155' }}>
              <p style={{ fontSize:32, marginBottom:10 }}>📭</p>
              <p style={{ fontSize:13 }}>暂无记录</p>
            </div>
          ) : [...logs].reverse().map(log => {
            const s = LOG_STYLE[log.type] || LOG_STYLE.system
            return (
              <div key={log.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'9px 12px', borderRadius:10, background:s.bg, border:`1px solid ${s.border}` }}>
                <span style={{ fontSize:14, flexShrink:0, marginTop:1 }}>{s.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ color:'#e2e8f0', fontSize:12, margin:0, lineHeight:1.5 }}>{log.text}</p>
                  {log.detail && <p style={{ color:'#475569', fontSize:10, margin:'3px 0 0', lineHeight:1.4 }}>{log.detail}</p>}
                </div>
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  {log.amount !== undefined && (
                    <p style={{ fontSize:13, fontWeight:800, margin:0, color: log.amount > 0 ? '#4ade80' : log.amount < 0 ? '#f87171' : '#94a3b8' }}>
                      {log.amount > 0 ? '+' : ''}{log.amount !== 0 ? `¥${Math.abs(log.amount).toLocaleString()}` : '±¥0'}
                    </p>
                  )}
                  <p style={{ color:'#334155', fontSize:9, margin:'2px 0 0' }}>{log.time}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── 底部汇总：总收入=所有正向现金流（售出金额），总支出=所有负向现金流 ── */}
        {logs.length > 0 && (() => {
          const totalIn  = logs.filter(l => l.cashIn  > 0).reduce((s, l) => s + l.cashIn,  0)
          const totalOut = logs.filter(l => l.cashOut > 0).reduce((s, l) => s + l.cashOut, 0)
          const net = totalIn - totalOut
          return (
            <div style={{ borderTop:'1px solid rgba(30,41,59,.7)', padding:'12px 20px', background:'rgba(10,16,26,.7)', display:'flex', gap:16, flexShrink:0 }}>
              <div style={{ textAlign:'center', flex:1 }}>
                <p style={{ color:'#334155', fontSize:9, margin:0 }}>总收入</p>
                <p style={{ color:'#4ade80', fontWeight:800, fontSize:14, margin:0 }}>+¥{totalIn.toLocaleString()}</p>
              </div>
              <div style={{ textAlign:'center', flex:1 }}>
                <p style={{ color:'#334155', fontSize:9, margin:0 }}>总支出</p>
                <p style={{ color:'#f87171', fontWeight:800, fontSize:14, margin:0 }}>-¥{totalOut.toLocaleString()}</p>
              </div>
              <div style={{ textAlign:'center', flex:1 }}>
                <p style={{ color:'#334155', fontSize:9, margin:0 }}>净盈亏</p>
                <p style={{ color: net>=0?'#fbbf24':'#f87171', fontWeight:800, fontSize:14, margin:0 }}>
                  {net>=0?'+':''}¥{net.toLocaleString()}
                </p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：工作台全部记录（超过 2 排时，最老的移入此处）
// ═══════════════════════════════════════════════════════════
function WorkbenchLogModal({ stones, onClose, onCut, onSell, onNpc, onCollect, onOpenWindow, onSellSemi, onCarving, onLiveSell, cutValueMult, money, liveStreamLevel }) {
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:420, background:'rgba(0,0,0,.82)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0a1628,#0f1f38)', border:'1px solid rgba(51,65,85,.7)', borderRadius:20, width:'100%', maxWidth:900, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,.7)', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(30,41,59,.7)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(15,23,42,.6)', flexShrink:0 }}>
          <span style={{ fontWeight:800, fontSize:15, color:'#f1f5f9' }}>📋 工作台全部记录</span>
          <span style={{ fontSize:11, color:'#64748b' }}>共 {stones.length} 块</span>
          <button onClick={onClose} style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(51,65,85,.6)', borderRadius:8, padding:'6px 12px', color:'#94a3b8', fontSize:12, cursor:'pointer' }}>关闭</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:16, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:10 }}>
          {stones.map(stone => (
            <WorkbenchCard key={stone.id} stone={stone}
              onCut={onCut}
              onSell={onSell}
              onNpc={onNpc}
              onCollect={onCollect}
              onOpenWindow={onOpenWindow}
              onSellSemi={onSellSemi}
              onCarving={onCarving}
              onLiveSell={onLiveSell}
              cutValueMult={cutValueMult}
              money={money}
              liveStreamLevel={liveStreamLevel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：手机私信面板（仿微信聊天气泡）
// ═══════════════════════════════════════════════════════════
function PhonePanel({ messages, npcList, onReply, onClose }) {
  const [activeChat, setActiveChat] = useState(null)
  const msgsByNpc = {}
  messages.forEach(m => {
    const key = m.npcId
    if (!msgsByNpc[key]) msgsByNpc[key] = []
    msgsByNpc[key].push(m)
  })
  const chats = Object.entries(msgsByNpc)
  const current = activeChat ? msgsByNpc[activeChat] : (chats[0] ? msgsByNpc[chats[0][0]] : null)
  const npcId = current ? current[0]?.npcId : null
  const npc = npcId ? npcList.find(n => n.id === npcId) : null
  const lastMsg = current ? current[current.length - 1] : null

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:380, maxHeight:'85vh', background:'linear-gradient(180deg,#e8eef5,#d4dce6)', borderRadius:24, boxShadow:'0 20px 60px rgba(0,0,0,.6)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ background:'linear-gradient(135deg,#07c160,#06ad56)', padding:'14px 18px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color:'#fff', fontWeight:800, fontSize:16 }}>💬 微信</span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.3)', border:'none', borderRadius:8, padding:'4px 12px', color:'#fff', fontSize:12, cursor:'pointer' }}>关闭</button>
        </div>
        {chats.length === 0 ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', fontSize:14 }}>暂无私信</div>
        ) : (
          <>
            <div style={{ padding:'10px 14px', background:'#fff', borderBottom:'1px solid #e5e7eb', display:'flex', gap:8, overflowX:'auto' }}>
              {chats.map(([nid]) => {
                const n = npcList.find(x => x.id === nid)
                const sel = (activeChat || chats[0][0]) === nid
                return (
                  <button key={nid} onClick={()=>setActiveChat(nid)} style={{
                    flexShrink:0, padding:'6px 12px', borderRadius:20, border:'none', background: sel ? '#07c160' : '#e5e7eb', color: sel ? '#fff' : '#334155', fontSize:12, fontWeight:600, cursor:'pointer'
                  }}>{n?.icon} {n?.name}</button>
                )
              })}
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12, background:'#e5e7eb' }}>
              {current?.map((m, i) => (
                <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:m.isPlayer ? 'flex-end' : 'flex-start', gap:4 }}>
                  {!m.isPlayer && (
                    <div style={{ maxWidth:'80%', padding:'10px 14px', background:'#fff', borderRadius:4, borderTopLeftRadius:0, boxShadow:'0 1px 2px rgba(0,0,0,.08)', alignSelf:'flex-start' }}>
                      <p style={{ margin:0, fontSize:14, color:'#1f2937', lineHeight:1.5 }}>{m.msg}</p>
                    </div>
                  )}
                  {m.isPlayer && m.reply && (
                    <div style={{ maxWidth:'80%', padding:'10px 14px', background:'#95ec69', borderRadius:4, borderTopRightRadius:0, boxShadow:'0 1px 2px rgba(0,0,0,.08)', alignSelf:'flex-end' }}>
                      <p style={{ margin:0, fontSize:14, color:'#1f2937', lineHeight:1.5 }}>{m.reply}</p>
                    </div>
                  )}
                </div>
              ))}
              {lastMsg && !lastMsg.isPlayer && lastMsg.options?.length > 0 && (
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                  {lastMsg.options.map((opt, j) => (
                    <button key={j} onClick={()=>onReply(lastMsg, opt)}
                      style={{ alignSelf:'flex-end', padding:'8px 16px', background:'#07c160', border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                      {opt.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：专属雕刻大师面板（艺术家脾气与灵感）
// ═══════════════════════════════════════════════════════════
function ArtistMastersPanel({ masterState, money, currentDay, onInteract, onClose }) {
  const ms = masterState || {}
  return (
    <div style={{ position:'fixed', inset:0, zIndex:450, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'linear-gradient(160deg,#0f172a,#1e1b4b)', border:'1px solid rgba(139,92,246,.4)', borderRadius:20, padding:24, maxWidth:520, width:'100%', maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ margin:'0 0 8px', color:'#e9d5ff' }}>🔨 专属雕刻大师</h3>
        <p style={{ color:'#94a3b8', fontSize:12, marginBottom:16 }}>请在工作台选择已切原石，点击「送雕刻大师盘货」选择大师</p>
        {ARTIST_MASTERS.map(m => {
          const s = ms[m.id] || {}
          const insp = s.inspiration ?? 50
          const strike = (s.strikeUntilDay ?? 0) > currentDay
          const sick = (s.sickUntilDay ?? 0) > currentDay
          return (
            <div key={m.id} style={{ marginBottom:16, padding:14, background:'rgba(30,41,59,.5)', borderRadius:14, border:'1px solid rgba(71,85,105,.5)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:24 }}>{m.icon}</span>
                <div>
                  <span style={{ fontWeight:800, color:'#f1f5f9' }}>{m.name}</span>
                  <span style={{ marginLeft:8, fontSize:11, color:'#94a3b8' }}>{m.title} · {m.personality}</span>
                </div>
                {(strike || sick) && <span style={{ fontSize:10, color:'#f87171', background:'rgba(239,68,68,.2)', padding:'2px 8px', borderRadius:8 }}>{strike ? '罢工中' : '生病休养'}</span>}
              </div>
              <p style={{ color:'#64748b', fontSize:11, marginBottom:8 }}>{m.skillName}：{m.skillDesc}</p>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:10, color:'#64748b' }}>灵感</span>
                  <div style={{ height:6, background:'#1e293b', borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', background:'linear-gradient(90deg,#7c3aed,#a78bfa)', width:`${insp}%`, borderRadius:4 }} />
                  </div>
                </div>
                <span style={{ fontSize:12, color:'#c4b5fd', fontWeight:700 }}>{insp}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {m.id === 'chu_shi_weng' && (
                  <>
                    <button onClick={()=>onInteract(m.id, 'dahongpao')} disabled={money < 25000 || insp >= 100}
                      style={{ padding:'6px 12px', background: money >= 25000 && insp < 100 ? 'rgba(127,29,29,.6)' : '#334155', border:'1px solid rgba(180,83,9,.4)', borderRadius:8, color:'#fde68a', fontSize:11, cursor: money >= 25000 && insp < 100 ? 'pointer' : 'not-allowed' }}>🍵 送极品大红袍</button>
                    <button onClick={()=>onInteract(m.id, 'weiqi')} disabled={insp >= 100}
                      style={{ padding:'6px 12px', background: insp < 100 ? 'rgba(30,58,138,.5)' : '#334155', border:'1px solid rgba(59,130,246,.4)', borderRadius:8, color:'#93c5fd', fontSize:11, cursor: insp < 100 ? 'pointer' : 'not-allowed' }}>♟ 陪下围棋</button>
                  </>
                )}
                {m.id === 'gui_shou_a9' && (
                  <>
                    <button onClick={()=>onInteract(m.id, 'qingba')} disabled={money < 12000 || sick}
                      style={{ padding:'6px 12px', background: money >= 12000 && !sick ? 'rgba(88,28,135,.5)' : '#334155', border:'1px solid rgba(192,132,252,.4)', borderRadius:8, color:'#e9d5ff', fontSize:11, cursor: money >= 12000 && !sick ? 'pointer' : 'not-allowed' }}>🍸 带去清吧</button>
                    <button onClick={()=>onInteract(m.id, 'baijiu')} disabled={sick}
                      style={{ padding:'6px 12px', background: !sick ? 'rgba(127,29,29,.6)' : '#334155', border:'1px solid rgba(239,68,68,.4)', borderRadius:8, color:'#fecaca', fontSize:11, cursor: !sick ? 'pointer' : 'not-allowed' }}>🍶 灌白酒(100%灵感，次日病3天)</button>
                  </>
                )}
                {m.id === 'qiao_niang_jinyan' && (
                  <button onClick={()=>onInteract(m.id, 'hongbao')} disabled={money < 50000}
                    style={{ padding:'6px 12px', background: money >= 50000 ? 'rgba(34,197,94,.4)' : '#334155', border:'1px solid rgba(34,197,94,.5)', borderRadius:8, color:'#86efac', fontSize:11, cursor: money >= 50000 ? 'pointer' : 'not-allowed' }}>🧧 发大红包 ¥50,000</button>
                )}
                {m.id === 'kumu_chan_shi' && (
                  <>
                    <button onClick={()=>onInteract(m.id, 'xianghuo')} disabled={money < 8000}
                      style={{ padding:'6px 12px', background: money >= 8000 ? 'rgba(120,53,15,.5)' : '#334155', border:'1px solid rgba(251,191,36,.4)', borderRadius:8, color:'#fde68a', fontSize:11, cursor: money >= 8000 ? 'pointer' : 'not-allowed' }}>🪔 捐赠香火</button>
                    <button onClick={()=>onInteract(m.id, 'chanzhen')}
                      style={{ padding:'6px 12px', background:'rgba(30,58,138,.5)', border:'1px solid rgba(59,130,246,.4)', borderRadius:8, color:'#93c5fd', fontSize:11, cursor:'pointer' }}>🧘 静坐论禅</button>
                  </>
                )}
                {m.id === 'kuai_shou_laotie' && (
                  <button onClick={()=>onInteract(m.id, 'kafei')} disabled={money < 3000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 3000 && insp < 100 ? 'rgba(120,53,15,.5)' : '#334155', border:'1px solid rgba(180,83,9,.4)', borderRadius:8, color:'#fde68a', fontSize:11, cursor: money >= 3000 && insp < 100 ? 'pointer' : 'not-allowed' }}>☕ 请喝咖啡 ¥3,000</button>
                )}
                {m.id === 'men_sao_ajie' && (
                  <button onClick={()=>onInteract(m.id, 'chabei')} disabled={money < 5000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 5000 && insp < 100 ? 'rgba(34,197,94,.4)' : '#334155', border:'1px solid rgba(34,197,94,.5)', borderRadius:8, color:'#86efac', fontSize:11, cursor: money >= 5000 && insp < 100 ? 'pointer' : 'not-allowed' }}>🫖 送茶具 ¥5,000</button>
                )}
                {m.id === 'hua_lao_wang' && (
                  <button onClick={()=>onInteract(m.id, 'laopi')} disabled={money < 8000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 8000 && insp < 100 ? 'rgba(180,83,9,.5)' : '#334155', border:'1px solid rgba(251,191,36,.4)', borderRadius:8, color:'#fde68a', fontSize:11, cursor: money >= 8000 && insp < 100 ? 'pointer' : 'not-allowed' }}>🍺 请喝老啤 ¥8,000</button>
                )}
                {m.id === 'du_tu_daobai' && (
                  <button onClick={()=>onInteract(m.id, 'maotai')} disabled={money < 18000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 18000 && insp < 100 ? 'rgba(127,29,29,.6)' : '#334155', border:'1px solid rgba(239,68,68,.4)', borderRadius:8, color:'#fecaca', fontSize:11, cursor: money >= 18000 && insp < 100 ? 'pointer' : 'not-allowed' }}>🥃 送茅台 ¥18,000</button>
                )}
                {m.id === 'yang_sheng_lishu' && (
                  <button onClick={()=>onInteract(m.id, 'hongzao')} disabled={money < 4000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 4000 && insp < 100 ? 'rgba(185,28,28,.5)' : '#334155', border:'1px solid rgba(248,113,113,.4)', borderRadius:8, color:'#fecaca', fontSize:11, cursor: money >= 4000 && insp < 100 ? 'pointer' : 'not-allowed' }}>🍵 送红枣茶 ¥4,000</button>
                )}
                {m.id === 'wanmei_sujie' && (
                  <button onClick={()=>onInteract(m.id, 'xiangnai')} disabled={money < 12000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 12000 && insp < 100 ? 'rgba(139,92,246,.5)' : '#334155', border:'1px solid rgba(167,139,250,.4)', borderRadius:8, color:'#e9d5ff', fontSize:11, cursor: money >= 12000 && insp < 100 ? 'pointer' : 'not-allowed' }}>💄 送香奈儿 ¥12,000</button>
                )}
                {m.id === 'xue_tu_xiaodou' && (
                  <button onClick={()=>onInteract(m.id, 'keben')} disabled={money < 2000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 2000 && insp < 100 ? 'rgba(34,197,94,.4)' : '#334155', border:'1px solid rgba(34,197,94,.5)', borderRadius:8, color:'#86efac', fontSize:11, cursor: money >= 2000 && insp < 100 ? 'pointer' : 'not-allowed' }}>📚 送刻刀课本 ¥2,000</button>
                )}
                {m.id === 'shenmi_ying' && (
                  <button onClick={()=>onInteract(m.id, 'mima')} disabled={money < 15000 || insp >= 100}
                    style={{ padding:'6px 12px', background: money >= 15000 && insp < 100 ? 'rgba(30,27,75,.8)' : '#334155', border:'1px solid rgba(139,92,246,.4)', borderRadius:8, color:'#c4b5fd', fontSize:11, cursor: money >= 15000 && insp < 100 ? 'pointer' : 'not-allowed' }}>🔐 给神秘暗号 ¥15,000</button>
                )}
              </div>
            </div>
          )
        })}
        <button onClick={onClose} style={{ width:'100%', padding:10, background:'#334155', border:'none', borderRadius:10, color:'#94a3b8', cursor:'pointer', marginTop:8 }}>关闭</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：直播切石弹幕层
// ═══════════════════════════════════════════════════════════
function LiveStreamBarrageLayer({ barrages }) {
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, height:80, zIndex:200, pointerEvents:'none', overflow:'hidden' }}>
      {barrages.map((b, i) => (
        <div key={b.id} className="barrage-item" style={{
          position:'absolute',
          left:'100%',
          top: `${(i % 4) * 22 + 8}px`,
          whiteSpace:'nowrap',
          fontSize:13,
          color: b.type === 'success' ? '#4ade80' : b.type === 'fail' ? '#f87171' : '#94a3b8',
          textShadow: '0 1px 2px rgba(0,0,0,.8)',
          animation: `barrageScroll ${8 + (i % 4)}s linear forwards`,
        }}>
          {b.text}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  子组件：Toast
// ═══════════════════════════════════════════════════════════
function Toast({ messages }) {
  return (
    <div className="toast-container" style={{ position:'fixed', bottom:24, right:24, display:'flex', flexDirection:'column', gap:8, zIndex:9999, pointerEvents:'none' }}>
      {messages.map(msg => (
        <div key={msg.id} className="toast-enter" style={{ padding:'10px 16px', borderRadius:11, background:'rgba(13,20,36,.96)', backdropFilter:'blur(12px)', border:'1px solid rgba(51,65,85,.5)', color:'#e2e8f0', fontSize:13, boxShadow:'0 4px 20px rgba(0,0,0,.5)', whiteSpace:'nowrap' }}>{msg.text}</div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  主组件
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [gameMode,    setGameMode]    = useState('menu')  // 'menu' | 'sprint100' | 'tycoon300' | 'sandbox'
  const [debtIndex,   setDebtIndex]   = useState(0)       // 下一笔待偿还债务在剧本表中的下标
  const [money,       setMoney]       = useState(50000)
  const [marketLevel, setMarketLevel] = useState(1)
  const [marketData, setMarketData] = useState(() => {
    const g = generateMarketStones(1)
    return { kgStones: g.kgStones, premiumStones: g.premiumStones, auctionStone: g.auctionStone }
  })
  const [marketTab, setMarketTab] = useState('kg')
  const [premiumAngryToday, setPremiumAngryToday] = useState([])
  const [stoneDetail, setStoneDetail] = useState(null)
  const [bargainStone, setBargainStone] = useState(null)
  const [bargainQte, setBargainQte] = useState(null)
  const [auctionBidStone, setAuctionBidStone] = useState(null)
  const [inventory,   setInventory]   = useState([])
  const [collection,  setCollection]  = useState([])   // 收藏精品
  const [toasts,      setToasts]      = useState([])
  const [logs,        setLogs]        = useState([])
  const [totalProfit, setTotalProfit] = useState(0)
  const [totalDeals,  setTotalDeals]  = useState(0)
  const [opCount,     setOpCount]     = useState(0)    // 操作次数（切/卖/NPC）
  const [daySpeed,    setDaySpeed]    = useState(3)    // 每几次操作=1天，可升级
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showLog,     setShowLog]     = useState(false)
  const [showCollection, setShowCollection] = useState(false)
  const [showNpcRoster,  setShowNpcRoster]  = useState(false)
  const [npcTarget,   setNpcTarget]   = useState(null) // 正在找NPC的工作台stone.id
  // 每日随机事件（Roguelike）
  const [activeEffects, setActiveEffects] = useState([])   // [{ eventId, event, expiresAtDay }]
  const [pendingEvent,  setPendingEvent]  = useState(null) // 待确认的全屏事件
  const prevDayRef = useRef(1)
  const [equippedRelics,  setEquippedRelics]  = useState([])   // ['purple_flashlight', ...]
  const [showBlackMarket, setShowBlackMarket] = useState(false)
  const [blackMarketOffers, setBlackMarketOffers] = useState([]) // 本次黑市提供的遗物 id 列表
  const [blackMarketPurchasedDays, setBlackMarketPurchasedDays] = useState([]) // 本次黑市已购入的天数，购入1样后当日不可再进
  const [liveStreamLevel, setLiveStreamLevel] = useState(0)                    // 直播间等级 0=未开 1-3=已开
  const [viewerFavorability, setViewerFavorability] = useState(() =>
    Object.fromEntries(LIVE_VIEWERS.map(v => [v.id, 0]))
  )                                             // 20名观众好感度 { viewerId: 0~N }
  const [carvingMasterUsesToday, setCarvingMasterUsesToday] = useState({})     // 今日各大师已消耗次数（盘货消耗1-3）
  const [carvingMasterRelations, setCarvingMasterRelations] = useState(() =>
    Object.fromEntries(ARTIST_MASTERS.map(m => [m.id, 0]))
  )                                             // 与各大师合作成功次数
  const [artistMasterState, setArtistMasterState] = useState(() =>
    Object.fromEntries(ARTIST_MASTERS.map(m => [m.id, { inspiration: 50, energy: 100, strikeUntilDay: 0, sickUntilDay: 0 }]))
  )
  const [kuMuPendingOrders, setKuMuPendingOrders] = useState([])  // [{ stoneId, readyAtDay }]
  const [reputation, setReputation] = useState(10)                             // 人品值，被识破卖假时 -1
  const [carvingStone, setCarvingStone] = useState(null)                       // 待送雕刻的石头
  const [liveSellStone, setLiveSellStone] = useState(null)                     // 待直播售卖的石头
  const [liveAuctionData, setLiveAuctionData] = useState(null)                 // 直播竞拍过程 { stone, bids, winner }
  const [showLiveStreamUpgrade, setShowLiveStreamUpgrade] = useState(false)
  const [phoneMessages, setPhoneMessages] = useState([])                       // [{ npcId, msgId, msg, options, isPlayer, reply }]
  const [showPhone, setShowPhone] = useState(false)
  const [showLaoChen, setShowLaoChen] = useState(false)
  const [livestreamHype, setLivestreamHype] = useState(30)
  const [livestreamActive, setLivestreamActive] = useState(false)
  const [livestreamBarrages, setLivestreamBarrages] = useState([])
  const [livestreamHypeFullDays, setLivestreamHypeFullDays] = useState(0)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showWorkbenchLog, setShowWorkbenchLog] = useState(false)              // 工作台全部记录
  const [bangYigeMessage, setBangYigeMessage] = useState(null)                 // 榜一大哥私聊
  // NPC 关系：{ [npcId]: 累计交易次数 }
  const [npcRelations, setNpcRelations] = useState(() =>
    Object.fromEntries(NPC_LIST.map(n => [n.id, 0]))
  )
  const [isGameOver,  setIsGameOver]  = useState(false)
  const [gameOverInfo,setGameOverInfo]= useState(null)   // {modeName, day, money, debtDay, debtAmount}
  const [lastDebtInfo,setLastDebtInfo]= useState(null)   // 最近一次成功偿还的债务信息

  const toastId     = useRef(0)
  const logId       = useRef(0)
  const inventoryRef= useRef([])
  const bangYigeTriggeredRef = useRef(false)
  inventoryRef.current = inventory

  // 弹窗打开时锁定 body 滚动，防止主界面在移动端被拖动
  const hasModal = !!(stoneDetail || bargainStone || bargainQte || auctionBidStone || carvingStone || liveSellStone || liveAuctionData || showUpgrade || showLog || showWorkbenchLog || showCollection || showNpcRoster || npcTarget || showPhone || showLaoChen || showGiftModal || pendingEvent || showBlackMarket || gameOverInfo || lastDebtInfo || showLiveStreamUpgrade || bangYigeMessage)
  useEffect(() => {
    if (hasModal) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [hasModal])

  const addToast = useCallback((text) => {
    const id = ++toastId.current
    setToasts(p => [...p.slice(-5), { id, text }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])

  // cashIn: 真实收到的钱（售出金额）; cashOut: 真实花出去的钱; amount: 显示用
  const addLog = useCallback((entry) => {
    setLogs(p => [...p, { id: ++logId.current, time: nowStr(), cashIn:0, cashOut:0, ...entry }])
  }, [])

  // 当前天数（所有模式共用）
  const currentDay = Math.floor(opCount / daySpeed) + 1

  // 聚合 modifiers（来自 activeEffects）
  const modifiers = computeModifiers(activeEffects.map(e => e.event))

  // 遗物效果
  const relicBrickReduce = equippedRelics.includes('purple_flashlight')
  const relicDetectPenaltyHalf = equippedRelics.includes('silver_tongue')
  const relicCutValueMult = equippedRelics.includes('gold_knife') ? 1.2 : 1

  // 每日推进时：清理过期效果 + 15% 概率触发随机事件 + 每2日自动刷新市场
  useEffect(() => {
    if (gameMode === 'menu' || isGameOver) return
    const prev = prevDayRef.current
    if (currentDay <= prev) return
    prevDayRef.current = currentDay

    setActiveEffects(ef => ef.filter(e => e.expiresAtDay >= currentDay))
    setPremiumAngryToday([])
    setCarvingMasterUsesToday({})
    setArtistMasterState(prev => Object.fromEntries(Object.entries(prev).map(([id, s]) => {
      if (id === 'gui_shou_a9') return [id, { ...s, inspiration: Math.max(0, Math.min(100, (s.inspiration ?? 50) + rndInt(-25, 25))) }]
      if (id === 'chu_shi_weng' || id === 'kumu_chan_shi') return [id, { ...s, inspiration: Math.max(0, (s.inspiration ?? 50) - 5) }]
      return [id, s]
    })))

    if (Math.random() < PHONE_MSG_CHANCE) {
      const tid = pick(PHONE_MSG_STARTERS)
      const t = PHONE_MSG_POOL.find(x => x.id === tid) || PHONE_MSG_POOL[0]
      setPhoneMessages(ms => [...ms, { id: Date.now(), npcId: t.npcId, msg: t.msg, isPlayer: false, options: t.options, msgId: t.id }])
    }

    setLivestreamHypeFullDays(d => {
      if (livestreamHype >= LIVESTREAM_CUT.hypeMax) return d + 1
      return 0
    })

    // 榜一大哥：热度连续满值 3 天后触发私聊（仅触发一次）
    if (!bangYigeTriggeredRef.current && livestreamHype >= LIVESTREAM_CUT.hypeMax) {
      const curFull = livestreamHypeFullDays
      if (curFull + 1 >= LIVESTREAM_CUT.hypeFullDaysForBangYige) {
        bangYigeTriggeredRef.current = true
        setPhoneMessages(ms => [...ms, { id: Date.now(), npcId: 'bang_yige', msg: '老板，我是你直播间的榜一大哥，最近看中你手里一块好料，开个价，我全收。', isPlayer: false, options: [{ text:'好的，改天聊', affinityDelta:0, nextId:null, reply:'改天聊' }], isBangYige: true }])
      }
    }

    // 每 2 天自动刷新原石市场（免费补货）
    if (currentDay > 0 && currentDay % 2 === 0) {
      const g = generateMarketStones(marketLevel)
      setMarketData({ kgStones: g.kgStones, premiumStones: g.premiumStones, auctionStone: g.auctionStone })
      addToast('📅 每2日自动补货，原石市场已刷新')
    }

    if (Math.random() >= EVENT_TRIGGER_CHANCE) return
    const pool = [...EVENT_POOL_POSITIVE, ...EVENT_POOL_NEGATIVE]
    const raw = pick(pool)
    const [dMin, dMax] = raw.duration
    const duration = dMin === dMax ? dMin : rndInt(dMin, dMax)
    setPendingEvent({ ...raw, duration, expiresAtDay: currentDay + duration })
  }, [currentDay, gameMode, isGameOver, marketLevel, addToast, livestreamHype, livestreamHypeFullDays])

  // 枯木禅师：到期订单自动交付
  useEffect(() => {
    if (gameMode === 'menu' || isGameOver) return
    const toDeliver = kuMuPendingOrders.filter(o => o.readyAtDay <= currentDay)
    if (toDeliver.length === 0) return
    toDeliver.forEach(o => {
      const s = { ...o.stone, id: Date.now() + Math.random(), polished: { masterId: 'kumu_chan_shi', qualityBoost: 2.5, kaiguang: true } }
      setInventory(inv => [...inv, s])
      addToast(`🧘 枯木禅师：开光成品「${o.stone.name}」已送达`)
    })
    setKuMuPendingOrders(prev => prev.filter(o => o.readyAtDay > currentDay))
  }, [currentDay, gameMode, isGameOver, kuMuPendingOrders, addToast])

  // 每次操作推进天数（菜单 / GameOver 时不再前进）
  const tickOp = useCallback(() => {
    setOpCount(c => (gameMode === 'menu' || isGameOver) ? c : c + 1)
  }, [gameMode, isGameOver])

  // ═══════════════════════════════════════════════════════════
  //  剧本债务结算逻辑
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (gameMode === 'menu' || gameMode === 'sandbox' || isGameOver) return
    const script = SCRIPT_MODES[gameMode]
    if (!script) return
    const schedule = script.debts || []
    if (debtIndex >= schedule.length) return
    const curDebt = schedule[debtIndex]
    if (currentDay < curDebt.day) return

    // 到达或超过结算日：尝试自动还款
    if (money >= curDebt.amount) {
      // 还得起：自动扣除 + 记录 + 弹鼓励窗
      setMoney(m => m - curDebt.amount)
      const after = money - curDebt.amount
      setLastDebtInfo({
        modeKey: gameMode,
        day: curDebt.day,
        amount: curDebt.amount,
        after,
        nextDay: schedule[debtIndex + 1]?.day ?? null,
        nextAmount: schedule[debtIndex + 1]?.amount ?? null,
      })
      setDebtIndex(i => i + 1)
      addToast(`✅ 第 ${curDebt.day} 天按时还款 ¥${curDebt.amount.toLocaleString()}，继续苟活。`)
      addLog({
        type:'system',
        text:`偿还剧本债务（第 ${curDebt.day} 天）`,
        detail:`扣除 ¥${curDebt.amount.toLocaleString()}，剩余资金 ¥${after.toLocaleString()}`,
        cashIn:0,
        cashOut: curDebt.amount,
        amount: -curDebt.amount,
      })
    } else {
      // 还不起：Game Over
      setIsGameOver(true)
      setGameOverInfo({
        modeKey: gameMode,
        modeName: script.name,
        day: currentDay,
        money,
        debtDay: curDebt.day,
        debtAmount: curDebt.amount,
      })
      addLog({
        type:'system',
        text:`破产清算：未能偿还第 ${curDebt.day} 天债务 ¥${curDebt.amount.toLocaleString()}`,
        detail:`当前资金 ¥${money.toLocaleString()} < 目标 ¥${curDebt.amount.toLocaleString()}，游戏结束。`,
        cashIn:0,
        cashOut:0,
        amount:0,
      })
    }
  }, [gameMode, currentDay, debtIndex, money, isGameOver, addLog, addToast])

  // 开始/重开指定剧本
  const startScript = useCallback((modeKey) => {
    const script = SCRIPT_MODES[modeKey]
    if (!script) return
    setGameMode(modeKey)
    setDebtIndex(0)
    setIsGameOver(false)
    setGameOverInfo(null)
    setLastDebtInfo(null)
    setMoney(50000)
    setMarketLevel(1)
    setDaySpeed(3)
    const g = generateMarketStones(1)
    setMarketData({ kgStones: g.kgStones, premiumStones: g.premiumStones, auctionStone: g.auctionStone })
    setInventory([])
    setCollection([])
    setToasts([])
    setLogs([])
    setTotalProfit(0)
    setTotalDeals(0)
    setOpCount(0)
    setShowUpgrade(false)
    setShowLog(false)
    setShowCollection(false)
    setShowNpcRoster(false)
    setNpcTarget(null)
    setNpcRelations(Object.fromEntries(NPC_LIST.map(n => [n.id, 0])))
    setActiveEffects([])
    setPendingEvent(null)
    prevDayRef.current = 1
    setEquippedRelics([])
    setShowBlackMarket(false)
    setBlackMarketPurchasedDays([])
    setLiveStreamLevel(0)
    setViewerFavorability(Object.fromEntries(LIVE_VIEWERS.map(v => [v.id, 0])))
    setCarvingMasterUsesToday({})
    setCarvingStone(null)
    setLiveSellStone(null)
    setLiveAuctionData(null)
    setShowLiveStreamUpgrade(false)
    setCarvingMasterRelations(Object.fromEntries(ARTIST_MASTERS.map(m => [m.id, 0])))
    setArtistMasterState(Object.fromEntries(ARTIST_MASTERS.map(m => [m.id, { inspiration: 50, energy: 100, strikeUntilDay: 0, sickUntilDay: 0 }])))
    setKuMuPendingOrders([])
    setReputation(10)
    setPhoneMessages([])
    setShowPhone(false)
    setShowLaoChen(false)
    setLivestreamHype(30)
    setLivestreamActive(false)
    setLivestreamBarrages([])
    setLivestreamHypeFullDays(0)
    setShowGiftModal(false)
    setShowWorkbenchLog(false)
    setBangYigeMessage(null)
    bangYigeTriggeredRef.current = false
  }, [])

  const backToMenu = useCallback(() => {
    setIsGameOver(false)
    setGameOverInfo(null)
    setLastDebtInfo(null)
    setGameMode('menu')
  }, [])

  const restartSameScript = useCallback(() => {
    if (!gameOverInfo) return
    startScript(gameOverInfo.modeKey)
  }, [gameOverInfo, startScript])

  // ── 存档（保存到本地 localStorage，手机/电脑浏览器均支持）
  const handleSave = useCallback(() => {
    try {
      const payload = {
        v: 1,
        gameMode,
        debtIndex,
        money,
        marketLevel,
        marketData,
        marketTab,
        inventory,
        collection,
        totalProfit,
        totalDeals,
        opCount,
        daySpeed,
        activeEffects,
        equippedRelics,
        blackMarketPurchasedDays,
        liveStreamLevel,
        viewerFavorability,
        carvingMasterUsesToday,
        carvingMasterRelations,
        artistMasterState,
        kuMuPendingOrders,
        reputation,
        phoneMessages,
        livestreamHype,
        livestreamHypeFullDays,
        npcRelations,
        isGameOver,
        savedAt: Date.now(),
      }
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload))
      addToast('存档已保存到本地')
    } catch (e) {
      addToast('存档失败：' + (e?.message || '未知错误'))
    }
  }, [gameMode, debtIndex, money, marketLevel, marketData, marketTab, inventory, collection, totalProfit, totalDeals, opCount, daySpeed, activeEffects, equippedRelics, blackMarketPurchasedDays, liveStreamLevel, viewerFavorability, carvingMasterUsesToday, carvingMasterRelations, artistMasterState, kuMuPendingOrders, reputation, phoneMessages, livestreamHype, livestreamHypeFullDays, npcRelations, isGameOver, addToast])

  // ── 读档（从 localStorage 恢复）
  const handleLoad = useCallback(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) { addToast('没有找到存档'); return }
      const data = JSON.parse(raw)
      if (!data || !data.gameMode) { addToast('存档格式无效'); return }
      setGameMode(data.gameMode)
      setDebtIndex(data.debtIndex ?? 0)
      setMoney(data.money ?? 50000)
      setMarketLevel(data.marketLevel ?? 1)
      setMarketData(data.marketData ?? { kgStones: [], premiumStones: [], auctionStone: null })
      setMarketTab(data.marketTab ?? 'kg')
      setInventory(data.inventory ?? [])
      setCollection(data.collection ?? [])
      setTotalProfit(data.totalProfit ?? 0)
      setTotalDeals(data.totalDeals ?? 0)
      setOpCount(data.opCount ?? 0)
      setDaySpeed(data.daySpeed ?? 3)
      setActiveEffects(data.activeEffects ?? [])
      setEquippedRelics(data.equippedRelics ?? [])
      setBlackMarketPurchasedDays(data.blackMarketPurchasedDays ?? [])
      setLiveStreamLevel(data.liveStreamLevel ?? 0)
      setViewerFavorability(data.viewerFavorability ?? Object.fromEntries(LIVE_VIEWERS.map(v => [v.id, 0])))
      setCarvingMasterUsesToday(data.carvingMasterUsesToday ?? {})
      setCarvingMasterRelations(data.carvingMasterRelations ?? Object.fromEntries(ARTIST_MASTERS.map(m => [m.id, 0])))
      setArtistMasterState(data.artistMasterState ?? Object.fromEntries(ARTIST_MASTERS.map(m => [m.id, { inspiration: 50, energy: 100, strikeUntilDay: 0, sickUntilDay: 0 }])))
      setKuMuPendingOrders(data.kuMuPendingOrders ?? [])
      setReputation(data.reputation ?? 10)
      setPhoneMessages(data.phoneMessages ?? [])
      setLivestreamHype(data.livestreamHype ?? 30)
      setLivestreamHypeFullDays(data.livestreamHypeFullDays ?? 0)
      setNpcRelations(data.npcRelations ?? Object.fromEntries(NPC_LIST.map(n => [n.id, 0])))
      setIsGameOver(data.isGameOver ?? false)
      setGameOverInfo(null)
      setLastDebtInfo(null)
      prevDayRef.current = data.opCount != null && data.daySpeed != null ? Math.floor(data.opCount / data.daySpeed) + 1 : 1
      setStoneDetail(null)
      setBargainStone(null)
      setBargainQte(null)
      setAuctionBidStone(null)
      setCarvingStone(null)
      setLiveSellStone(null)
      setLiveAuctionData(null)
      addToast('读档成功')
    } catch (e) {
      addToast('读档失败：' + (e?.message || '未知错误'))
    }
  }, [addToast])

  const hasSave = typeof localStorage !== 'undefined' && !!localStorage.getItem(SAVE_KEY)

  // 确认事件弹窗：应用即时效果 + 加入 activeEffects
  const handleConfirmEvent = useCallback(() => {
    if (!pendingEvent) return
    const ev = pendingEvent
    if (ev.immediateEffect) {
      if (ev.immediateEffect.cashSteal != null) {
        const amt = Math.min(ev.immediateEffect.cashSteal, money)
        setMoney(m => Math.max(0, m - amt))
        addToast(`😱 ${ev.name}：被偷走 ¥${amt.toLocaleString()}！`)
        addLog({ type:'loss', text:`事件「${ev.name}」：损失 ¥${amt.toLocaleString()}`, detail:'现金被偷', cashIn:0, cashOut: amt, amount: -amt })
      } else if (ev.immediateEffect.cashStealPct != null) {
        const amt = Math.round(money * ev.immediateEffect.cashStealPct)
        setMoney(m => Math.max(0, m - amt))
        addToast(`😱 ${ev.name}：损失 ¥${amt.toLocaleString()}（${(ev.immediateEffect.cashStealPct*100).toFixed(0)}%）！`)
        addLog({ type:'loss', text:`事件「${ev.name}」：损失 ¥${amt.toLocaleString()}`, detail:'小偷偷走部分现金', cashIn:0, cashOut: amt, amount: -amt })
      }
    }
    setActiveEffects(ef => [...ef, { eventId: ev.id, event: ev, expiresAtDay: ev.expiresAtDay }])
    setPendingEvent(null)
  }, [pendingEvent, money, addToast, addLog])

  // ── 购买（公斤料/精品直接买，受市场价 modifier 影响）
  const handleBuy = useCallback((stone, channel, finalPrice = null) => {
    if (gameMode === 'menu' || isGameOver) return
    const effectivePrice = finalPrice ?? Math.round(stone.price * modifiers.marketPrice)
    if (money < effectivePrice) return
    const nm = money - effectivePrice
    setMoney(nm)
    const buyStone = { ...stone, id: Date.now() + Math.random(), price: effectivePrice }
    delete buyStone.channel
    delete buyStone.auctionBasePrice
    setInventory(inv => [...inv, buyStone])
    if (channel === 'kg') setMarketData(d => ({ ...d, kgStones: d.kgStones.filter(s => s.id !== stone.id) }))
    else if (channel === 'premium') setMarketData(d => ({ ...d, premiumStones: d.premiumStones.filter(s => s.id !== stone.id) }))
    setBargainStone(null)
    tickOp()
    addToast(`🛒 购入「${stone.name}」，花费 ¥${effectivePrice.toLocaleString()}`)
    addLog({ type:'buy', text:`购入「${stone.name}」(${stone.sizeData.label}·${stone.sizeData.weight}kg·${QUALITY_CONFIG[stone.quality].label})`, detail:`产地：${stone.origin} | 余额：¥${nm.toLocaleString()}`, cashOut: effectivePrice, amount: -effectivePrice })
  }, [money, gameMode, isGameOver, modifiers.marketPrice, addToast, addLog, tickOp])

  // ── 精品砍价：试探10%(基础50%)/屠龙刀40%(基础10%)，QTE 完美 +20%
  const handleBargain = useCallback((stone, type, qtePerfect = false) => {
    if (!stone || stone.channel !== 'premium') return
    const discount = type === 'tentative' ? 0.10 : 0.40
    let successRate = type === 'tentative' ? 0.50 : 0.10
    if (qtePerfect) successRate += 0.20
    const ok = Math.random() < successRate
    if (ok) {
      const finalPrice = Math.round(stone.price * (1 - discount))
      handleBuy(stone, 'premium', finalPrice)
      addToast(`💰 砍价成功！原价 ¥${stone.price.toLocaleString()} → ¥${finalPrice.toLocaleString()}`)
      addLog({ type:'buy', text:`砍价成功（${type === 'tentative' ? '试探' : '屠龙刀'}）购入「${stone.name}」`, detail:`原价 ¥${stone.price.toLocaleString()} 折后 ¥${finalPrice.toLocaleString()}`, cashOut: finalPrice, amount: -finalPrice })
    } else {
      setPremiumAngryToday(prev => [...prev, stone.id])
      setBargainStone(null)
      addToast(`😤 老板生气了！「${stone.name}」今日不再卖给你`)
    }
  }, [handleBuy, addToast, addLog])

  // ── 暗标公盘竞标
  const handleAuctionBid = useCallback((stone, bidAmount) => {
    if (gameMode === 'menu' || isGameOver || !stone || stone.channel !== 'auction') return
    if (money < bidAmount || bidAmount < 100) return
    const base = stone.auctionBasePrice ?? stone.price
    const npc1 = Math.round(base * (0.6 + Math.random() * 0.5))
    const npc2 = Math.round(base * (0.7 + Math.random() * 0.6))
    const maxNpc = Math.max(npc1, npc2)
    if (bidAmount > maxNpc) {
      setMoney(m => m - bidAmount)
      const buyStone = { ...stone, id: Date.now() + Math.random(), price: bidAmount }
      delete buyStone.channel
      delete buyStone.auctionBasePrice
      delete buyStone.windowOpened
      setInventory(inv => [...inv, buyStone])
      setMarketData(d => ({ ...d, auctionStone: null }))
      setAuctionBidStone(null)
      tickOp()
      addToast(`🏆 竞标成功！以 ¥${bidAmount.toLocaleString()} 夺得「${stone.name}」`)
      addLog({ type:'buy', text:`暗标公盘竞得「${stone.name}」`, detail:`出价 ¥${bidAmount.toLocaleString()}，NPC出价 ¥${npc1.toLocaleString()} / ¥${npc2.toLocaleString()}`, cashOut: bidAmount, amount: -bidAmount })
    } else {
      setMarketData(d => ({ ...d, auctionStone: null }))
      setAuctionBidStone(null)
      addToast(`😢 竞标失败！NPC出价更高（¥${Math.max(npc1,npc2).toLocaleString()}），失去本块原石`)
    }
  }, [money, gameMode, isGameOver, addToast, addLog, tickOp])

  // ── 切割 ──
  const handleCut = useCallback((stoneId) => {
    if (gameMode === 'menu' || isGameOver) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || stone.cutResult) return

    const result    = rollCutResult(stone, modifiers.cutQuality, relicBrickReduce ? 0.10 : 0)
    const saleValue = Math.round(stone.price * result.multiplier * relicCutValueMult)
    const profit    = saleValue - stone.price

    // 尝试生成精品成品
    const collectible = tryGenerateCollectible(result.id, stone.price)
    if (collectible) collectible.acquiredDay = currentDay

    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, cutResult: result, collectible: collectible || null } : s))

    // 直播切石：更新热度、弹幕、打赏
    if (livestreamActive) {
      const isSuccess = profit >= 0
      const hypeDelta = isSuccess ? LIVESTREAM_CUT.hypeCutSuccessAdd : -LIVESTREAM_CUT.hypeCutFailSub
      setLivestreamHype(h => Math.max(0, Math.min(LIVESTREAM_CUT.hypeMax, h + hypeDelta)))
      const barrages = (isSuccess ? BARRAGE_CUT_SUCCESS : BARRAGE_CUT_FAIL).map(t => ({ id: Date.now() + Math.random(), text: t, type: isSuccess ? 'success' : 'fail' }))
      setLivestreamBarrages(b => [...b.slice(-8), ...barrages])
      const tips = isSuccess ? LIVESTREAM_CUT.tipPerHypeCutSuccess : LIVESTREAM_CUT.tipPerHypeCutFail
      setMoney(m => m + tips)
      addToast(isSuccess ? `📺 切涨！热度+${LIVESTREAM_CUT.hypeCutSuccessAdd}，粉丝打赏 ¥${tips.toLocaleString()}` : `📺 切垮，热度-${LIVESTREAM_CUT.hypeCutFailSub}`)
    }

    addToast(collectible
      ? `${result.message} 🏺 出现精品：${collectible.name}！`
      : result.message)
    addLog({
      type: 'cut',
      text: `切割「${stone.name}」→ ${result.name}（${result.grade}）${collectible ? ' 🏺 ' + collectible.name : ''}${livestreamActive ? ' [直播]' : ''}`,
      detail: `成本 ¥${stone.price.toLocaleString()}  基础估值 ¥${saleValue.toLocaleString()}  参考盈亏 ${profit>=0?'+':''}¥${profit.toLocaleString()}`,
      cashIn:0, cashOut:0, amount:0,
    })
  }, [currentDay, gameMode, isGameOver, livestreamActive, modifiers.cutQuality, relicBrickReduce, relicCutValueMult, addToast, addLog])

  // ── 手机私信回复 ──
  const handlePhoneReply = useCallback((msg, opt) => {
    const npcId = msg.npcId
    if (npcId && opt.affinityDelta && npcRelations[npcId] !== undefined) {
      setNpcRelations(prev => ({ ...prev, [npcId]: Math.max(0, (prev[npcId] || 0) + opt.affinityDelta) }))
    }
    const cashOut = (msg.msgId === 'borrow_1' && opt.nextId === 'borrow_1_ok') ? 5000 : 0
    if (cashOut && money >= cashOut) {
      setMoney(m => m - cashOut)
      addToast(`💸 借出 ¥${cashOut.toLocaleString()} 给老王`)
    }
    setPhoneMessages(ms => {
      const next = ms.map(m => m.id === msg.id ? { ...m } : m)
      const idx = next.findIndex(m => m.id === msg.id)
      if (idx >= 0) {
        next[idx] = { ...next[idx], options: null }
        const playerEntry = { id: Date.now(), npcId, msg: opt.reply || '', isPlayer: true, reply: opt.reply }
        next.splice(idx + 1, 0, playerEntry)
        if (opt.nextId) {
          const tpl = PHONE_MSG_POOL.find(x => x.id === opt.nextId)
          if (tpl) next.push({ id: Date.now() + 1, npcId: tpl.npcId, msg: tpl.msg, isPlayer: false, options: tpl.options, msgId: tpl.id })
        }
      }
      return next
    })
  }, [npcRelations, money, addToast])

  // ── 专属雕刻大师：羁绊互动 ──
  const handleArtistInteract = useCallback((masterId, action) => {
    const master = ARTIST_MASTERS.find(m => m.id === masterId)
    if (!master) return
    const costs = master.interactCosts || {}
    const gains = master.interactGains || {}
    const cost = costs[action] ?? 0
    if (cost > 0 && money < cost) { addToast('资金不足'); return }
    if (cost > 0) setMoney(m => m - cost)
    const gain = gains[action] ?? 0
    setArtistMasterState(prev => {
      const cur = prev[masterId] || {}
      let next = { ...cur, inspiration: Math.min(100, (cur.inspiration ?? 50) + gain) }
      if (action === 'baijiu' && masterId === 'gui_shou_a9') {
        next.inspiration = 100
        next.sickUntilDay = currentDay + (master.sickDays ?? 3)
      }
      return { ...prev, [masterId]: next }
    })
    const msgs = { dahongpao: '送极品大红袍', weiqi: '陪下围棋', qingba: '带去清吧', baijiu: '灌白酒(3日后生病)', hongbao: '发大红包', xianghuo: '捐赠香火', chanzhen: '静坐论禅', kafei: '请喝咖啡', chabei: '送茶具', laopi: '请喝老啤', maotai: '送茅台', hongzao: '送红枣茶', xiangnai: '送香奈儿', keben: '送刻刀课本', mima: '给神秘暗号' }
    addToast(`${master.icon} ${master.name}：${msgs[action] || action}，灵感 +${gain}`)
  }, [money, currentDay, addToast])

  // ── 直播发福利（送低级料拉满热度）──
  const handleLivestreamGift = useCallback((stoneId) => {
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || !stone.cutResult || stone.sold || livestreamActive) return
    setInventory(inv => inv.filter(s => s.id !== stoneId))
    setLivestreamHype(h => Math.min(LIVESTREAM_CUT.hypeMax, h + LIVESTREAM_CUT.hypeGiftAdd))
    setShowGiftModal(false)
    addToast(`🎁 发福利送料，热度 +${LIVESTREAM_CUT.hypeGiftAdd}`)
  }, [livestreamActive, addToast])

  // ── 直接售出 ──
  const handleSell = useCallback((stoneId) => {
    if (gameMode === 'menu' || isGameOver) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || !stone.cutResult || stone.sold) return
    const polishBoost = stone.polished?.qualityBoost ?? 1
    const saleValue = Math.round(stone.price * stone.cutResult.multiplier * relicCutValueMult * polishBoost)
    const profit    = saleValue - stone.price
    setMoney(m => m + saleValue)
    setTotalProfit(p => p + profit)
    setTotalDeals(d => d + 1)
    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, sold:true } : s))
    // 直接卖不消耗天数（不调用 tickOp）
    addToast(`💰 售出 ¥${saleValue.toLocaleString()}，${profit>=0?'盈利':'亏损'} ¥${Math.abs(profit).toLocaleString()}`)
    addLog({ type: profit>=0?'profit':'loss', text:`直接售出「${stone.name}」→ ${stone.cutResult.name}`, detail:`成本 ¥${stone.price.toLocaleString()}  售出 ¥${saleValue.toLocaleString()}  盈亏 ${profit>=0?'+':''}¥${profit.toLocaleString()}`, cashIn: saleValue, cashOut:0, amount: profit })
  }, [gameMode, isGameOver, relicCutValueMult, addToast, addLog])

  // ── NPC 成交（含砖头料察觉检测）──
  const handleSellToNpc = useCallback((stoneId, npc, offer) => {
    if (gameMode === 'menu' || isGameOver) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || stone.sold) return
    const isBrick = stone.cutResult?.id === 'brick'
    const profit  = offer - stone.price

    // ── 砖头料察觉检测（受 brickDetect modifier 影响，被识破则此次买卖失败、人品值-1）──
    const effectiveDetect = Math.min(1, npc.detectChance * modifiers.brickDetect)
    if (isBrick && Math.random() < effectiveDetect) {
      setNpcTarget(null)
      // 古玩商技能树：老朋友( Lv2 )起 50% 概率不掉好感
      const antiqueLv = getNpcLevel(npcRelations['antique_dealer'] || 0)
      const antique = NPC_LIST.find(n => n.id === 'antique_dealer')
      const noPenaltyChance = getNpcSkillValue(antique, 'brickNoPenaltyChance', antiqueLv) ?? 0
      if (noPenaltyChance > 0 && Math.random() < noPenaltyChance) {
        setTimeout(() => addToast(`😏 古玩商人脉生效！${npc.icon} ${npc.name} 虽识破但没计较`), 300)
        addLog({ type:'npc', text:`[${npc.name}] 识破砖头料，但古玩商特权生效，买卖失败未成交`, detail:`本应扣好感 ${npc.detectPenalty} 点` })
        setReputation(r => Math.max(0, r - 1))
        return
      }
      // 被识破！买卖失败，不收款不成交，人品值-1，扣好感度
      setReputation(r => Math.max(0, r - 1))
      const penalty = relicDetectPenaltyHalf ? Math.max(1, Math.ceil(npc.detectPenalty / 2)) : npc.detectPenalty
      const detectLine = pick(npc.detectDialogs || ['你以为骗得过我？！'])
      setTimeout(() => {
        addToast(`😡 ${npc.icon} ${npc.name}识破了！「${detectLine}」`)
        addToast(`❌ 此次买卖失败，人品值 -1`)
        addToast(`💔 与「${npc.name}」好感度 -${penalty}${relicDetectPenaltyHalf ? '（巧舌如簧减半）' : ''}`)
      }, 300)
      setNpcRelations(prev => {
        const oldDeals = prev[npc.id] || 0
        const newDeals = Math.max(0, oldDeals - penalty)
        const oldLv = getNpcLevel(oldDeals)
        const newLv = getNpcLevel(newDeals)
        if (newLv < oldLv) {
          setTimeout(() => {
            addToast(`📉 ${npc.icon}「${npc.name}」关系降级！${NPC_LEVEL_ICONS[oldLv]} ${NPC_LEVEL_NAMES[oldLv]} → ${NPC_LEVEL_ICONS[newLv]} ${NPC_LEVEL_NAMES[newLv]}`)
          }, 600)
        }
        return { ...prev, [npc.id]: newDeals }
      })
      addLog({ type:'loss', text:`⚠️ [${npc.name}] 识破砖头料！买卖失败，人品值-1`, detail:`未成交  察觉率 ${Math.round(npc.detectChance*100)}%  好感度 -${penalty} 点` })
      return
    }

    // ── 正常成交（含砖头料混入成功）──
    setMoney(m => m + offer)
    setTotalProfit(p => p + profit)
    setTotalDeals(d => d + 1)
    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, sold:true } : s))
    setNpcTarget(null)
    tickOp()

    if (isBrick) {
      setTimeout(() => addToast(`😏 ${npc.icon} ${npc.name} 没发现！砖头料成功混入！¥${offer.toLocaleString()}`), 200)
    }

    // 更新关系并检测升级
    setNpcRelations(prev => {
      const oldDeals = prev[npc.id] || 0
      const newDeals = oldDeals + 1
      const oldLv = getNpcLevel(oldDeals)
      const newLv = getNpcLevel(newDeals)
      if (newLv > oldLv) {
        setTimeout(() => {
          addToast(`🎉 ${npc.icon} 与「${npc.name}」关系升级！→ ${NPC_LEVEL_ICONS[newLv]} ${NPC_LEVEL_NAMES[newLv]}`)
          addToast(`✨ 解锁新特权：${getNpcPerkDesc(npc, newLv) || '—'}`)
        }, 200)
      }
      return { ...prev, [npc.id]: newDeals }
    })

    if (!isBrick) addToast(`${npc.icon} ${npc.name} 成交 ¥${offer.toLocaleString()}，关系 +1`)
    const resultLabel = stone.cutResult?.name || (stone.windowOpened ? `半明料 · ${stone.windowOpened.hint || '开窗'}` : '未知')
    addLog({ type:'npc', text:`[${npc.name}（${npc.fullName}）] 购入「${stone.name}」→ ${resultLabel}${isBrick?' 🎭混入成功':''}`, detail:`成本 ¥${stone.price.toLocaleString()}  NPC出价 ¥${offer.toLocaleString()}  盈亏 ${profit>=0?'+':''}¥${profit.toLocaleString()}`, cashIn: offer, cashOut:0, amount: profit })
  }, [gameMode, isGameOver, tickOp, modifiers.brickDetect, relicDetectPenaltyHalf, npcRelations, addToast, addLog])

  // ── 遗物购买（来自黑市时 onAfterBuy 会在成功后调用，用于关闭黑市并记录本次已购）
  const handleBuyRelic = useCallback((relicId, onAfterBuy) => {
    const r = RELICS[relicId]
    if (!r || equippedRelics.includes(relicId) || money < r.price) return
    setMoney(m => m - r.price)
    setEquippedRelics(prev => [...prev, relicId])
    addToast(`🔮 获得遗物「${r.name}」`)
    addLog({ type:'buy', text:`购买遗物「${r.name}」`, detail: r.desc, cashOut: r.price, amount: -r.price })
    onAfterBuy?.()
  }, [money, equippedRelics, addToast, addLog])

  const handleOpenBlackMarket = useCallback(() => {
    const pool = RELIC_IDS.filter(id => !equippedRelics.includes(id))
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setBlackMarketOffers(shuffled.slice(0, 3))
    setShowBlackMarket(true)
  }, [equippedRelics])

  // ── 收藏升值 ──
  const handleCollect = useCallback((stoneId) => {
    if (gameMode === 'menu' || isGameOver) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || !stone.collectible || stone.sold) return
    const item = { ...stone.collectible, acquiredDay: currentDay, stoneCost: stone.price }
    setCollection(c => [...c, item])
    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, sold:true } : s))
    addToast(`🏺 「${item.name}」已入藏，等待升值！`)
    addLog({ type:'collect', text:`收藏「${item.name}」（来自 ${stone.name}）`, detail:`入藏估值 ¥${item.baseValue.toLocaleString()}  年化+${(item.appreciatePerDay*100).toFixed(1)}%/天`, cashIn:0, cashOut:0, amount:0 })
  }, [currentDay, gameMode, isGameOver, addToast, addLog])

  // ── 出售藏品 ──
  const handleSellCollection = useCallback((instanceId, currentValue) => {
    if (gameMode === 'menu' || isGameOver) return
    const item = collection.find(i => i.instanceId === instanceId)
    if (!item) return
    const profit = currentValue - item.stoneCost
    setMoney(m => m + currentValue)
    setTotalProfit(p => p + profit)
    setCollection(c => c.filter(i => i.instanceId !== instanceId))
    addToast(`🎉 出售「${item.name}」¥${currentValue.toLocaleString()}，盈利 ¥${profit.toLocaleString()}`)
    addLog({ type:'profit', text:`出售藏品「${item.name}」`, detail:`入藏估值 ¥${item.baseValue.toLocaleString()}  出售 ¥${currentValue.toLocaleString()}  盈亏 +¥${profit.toLocaleString()}`, cashIn: currentValue, cashOut:0, amount: profit })
  }, [collection, gameMode, isGameOver, addToast, addLog])

  // ── 开皮擦窗（半明料，WINDOW_OUTCOMES 影响显示，切割仍用真实 hiddenTag）──
  const handleOpenWindow = useCallback((stoneId) => {
    if (gameMode === 'menu' || isGameOver || money < WINDOW_OPEN_COST) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || stone.cutResult || stone.windowOpened) return
    const outcome = pick(WINDOW_OUTCOMES)
    const semiMultiplier = rnd(outcome.multiRange[0], outcome.multiRange[1])
    setMoney(m => m - WINDOW_OPEN_COST)
    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, windowOpened: { hint: outcome.hint, semiMultiplier } } : s))
    addToast(`🔍 开窗完成！初步迹象：${outcome.hint}，估值 ×${semiMultiplier.toFixed(2)}`)
    addLog({ type:'cut', text:`开皮擦窗「${stone.name}」`, detail:`半明料 · ${outcome.hint} · 估值 ¥${Math.round(stone.price * semiMultiplier).toLocaleString()}`, cashOut: WINDOW_OPEN_COST, amount: -WINDOW_OPEN_COST })
  }, [money, gameMode, isGameOver, addToast, addLog])

  // ── 出售半明料 ──
  const handleSellSemi = useCallback((stoneId) => {
    if (gameMode === 'menu' || isGameOver) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || stone.cutResult || !stone.windowOpened || stone.sold) return
    const semiValue = Math.round(stone.price * stone.windowOpened.semiMultiplier)
    const profit = semiValue - stone.price
    setMoney(m => m + semiValue)
    setTotalProfit(p => p + profit)
    setTotalDeals(d => d + 1)
    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, sold: true } : s))
    addToast(`💰 出售半明料 ¥${semiValue.toLocaleString()}，${profit >= 0 ? '盈利' : '亏损'} ¥${Math.abs(profit).toLocaleString()}`)
    addLog({ type: profit >= 0 ? 'profit' : 'loss', text: `出售半明料「${stone.name}」`, detail: `成本 ¥${stone.price.toLocaleString()}  半明估值 ¥${semiValue.toLocaleString()}  盈亏 ${profit >= 0 ? '+' : ''}¥${profit.toLocaleString()}`, cashIn: semiValue, cashOut: 0, amount: profit })
  }, [gameMode, isGameOver, addToast, addLog])

  // ── 打灯观察（揭示词缀，可能准确/模糊/看走眼）──
  const handleFlashlight = useCallback((stone) => {
    if (gameMode === 'menu' || isGameOver || money < FLASHLIGHT_COST || stone.flashlightRevealed) return
    setMoney(m => m - FLASHLIGHT_COST)
    const realAffix = stone.hiddenTag ? AFFIX_MAP[stone.hiddenTag] : null
    const r = Math.random()
    let flashlightResult, flashlightHint
    if (r < FLASHLIGHT_PROBS.accurate) {
      flashlightResult = 'accurate'
      flashlightHint = realAffix?.name || '未知'
    } else if (r < FLASHLIGHT_PROBS.accurate + FLASHLIGHT_PROBS.fuzzy) {
      flashlightResult = 'fuzzy'
      flashlightHint = '雾层很厚，看不透'
    } else {
      flashlightResult = 'wrong'
      const goodAffixes = STONE_AFFIXES.filter(a => a.type === 'good')
      const badAffixes = STONE_AFFIXES.filter(a => a.type === 'bad')
      const opposite = realAffix?.type === 'good' ? pick(badAffixes) : pick(goodAffixes)
      flashlightHint = opposite?.name || '未知'
    }
    const upd = s => s.id === stone.id ? { ...s, flashlightRevealed: true, flashlightResult, flashlightHint } : s
    setMarketData(d => ({
      ...d,
      kgStones: d.kgStones.map(upd),
      premiumStones: d.premiumStones.map(upd),
      auctionStone: d.auctionStone && d.auctionStone.id === stone.id ? { ...d.auctionStone, flashlightRevealed: true, flashlightResult, flashlightHint } : d.auctionStone
    }))
    const typeLabel = flashlightResult === 'accurate' ? '准确' : flashlightResult === 'fuzzy' ? '模糊' : '看走眼'
    addToast(`🔦 打灯${typeLabel}：「${flashlightHint}」`)
    addLog({ type:'refresh', text:`打灯观察「${stone.name}」`, detail: `结果：${typeLabel} · ${flashlightHint}`, cashOut: FLASHLIGHT_COST, amount: -FLASHLIGHT_COST })
  }, [money, gameMode, isGameOver, addToast, addLog])

  // ── 刷新市场 ──（网红博主挚友：刷新费减免 30%）
  const handleRefresh = useCallback(() => {
    if (gameMode === 'menu' || isGameOver) { addToast('当前为主菜单或已破产，无法刷新市场。'); return }
    let cost = MARKET_LEVELS[marketLevel-1].refreshCost
    const influencerLv = getNpcLevel(npcRelations['influencer'] || 0)
    const influencer = NPC_LIST.find(n => n.id === 'influencer')
    const refreshDiscount = getNpcSkillValue(influencer, 'refreshDiscount', influencerLv)
    if (typeof refreshDiscount === 'number' && refreshDiscount > 0) {
      cost = Math.round(cost * (1 - refreshDiscount))
    }
    if (money < cost) { addToast(`⚠️ 刷新需要 ¥${cost}，资金不足！`); return }
    setMoney(m => m - cost)
    const g = generateMarketStones(marketLevel)
    setMarketData({ kgStones: g.kgStones, premiumStones: g.premiumStones, auctionStone: g.auctionStone })
    addToast('🔄 市场已刷新，新料到货！')
    addLog({ type:'refresh', text:`刷新市场（${MARKET_LEVELS[marketLevel-1].name}）`, detail:`花费 ¥${cost}`, cashIn:0, cashOut: cost, amount: -cost })
  }, [money, marketLevel, gameMode, isGameOver, npcRelations, addToast, addLog])

  // ── 市场升级 ──（每次升级 +1 每日行动次数）
  const handleUpgrade = useCallback((nextLv) => {
    if (gameMode === 'menu' || isGameOver) return
    if (money < nextLv.upgradeCost) return
    setMoney(m => m - nextLv.upgradeCost)
    setMarketLevel(nextLv.level)
    setDaySpeed(s => s + 1)
    const g = generateMarketStones(nextLv.level)
    setMarketData({ kgStones: g.kgStones, premiumStones: g.premiumStones, auctionStone: g.auctionStone })
    setShowUpgrade(false)
    addToast(`🎉 市场升级！当前：${nextLv.name}，每日行动次数 +1`)
    addLog({ type:'upgrade', text:`市场升级 → ${nextLv.name}（Lv${nextLv.level}）`, detail:`解锁：${nextLv.unlockTip}；每日行动次数 +1`, cashIn:0, cashOut: nextLv.upgradeCost, amount: -nextLv.upgradeCost })
  }, [money, gameMode, isGameOver, addToast, addLog])

  // ── 直播间升级 ──
  const handleLiveStreamUpgrade = useCallback(() => {
    if (gameMode === 'menu' || isGameOver) return
    const nextCfg = LIVE_STREAM_LEVELS[liveStreamLevel + 1]
    if (!nextCfg || nextCfg.cost <= 0 || money < nextCfg.cost) return
    setMoney(m => m - nextCfg.cost)
    setLiveStreamLevel(l => l + 1)
    setShowLiveStreamUpgrade(false)
    addToast(`📺 直播间升级！${nextCfg.name}，可开播售卖翡翠`)
    addLog({ type:'upgrade', text:`直播间升级 → ${nextCfg.name}`, detail: nextCfg.desc, cashOut: nextCfg.cost, amount: -nextCfg.cost })
  }, [money, liveStreamLevel, gameMode, isGameOver, addToast, addLog])

  // ── 专属雕刻大师盘货 ──（艺术家脾气与灵感博弈）
  const handleCarving = useCallback((stoneId, masterId) => {
    if (gameMode === 'menu' || isGameOver) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    const master = ARTIST_MASTERS.find(m => m.id === masterId)
    if (!stone || !stone.cutResult || stone.polished || stone.sold || !master) return
    const ms = artistMasterState[masterId] || {}
    const strike = (ms.strikeUntilDay || 0) > currentDay
    const sick = (ms.sickUntilDay || 0) > currentDay
    if (strike || sick) return
    const baseVal = Math.round(stone.price * stone.cutResult.multiplier * relicCutValueMult)
    const cutId = stone.cutResult.id

    if (masterId === 'chu_shi_weng') {
      if (CHU_HATE.includes(cutId)) {
        setArtistMasterState(prev => ({ ...prev, [masterId]: { ...prev[masterId], strikeUntilDay: currentDay + 1 } }))
        addToast(`😤 褚石翁大怒：「垃圾料也敢拿来？！罢工一天！」`)
        setCarvingStone(null)
        return
      }
      const isMasterpiece = CHU_LOVE.includes(cutId) && Math.random() < (master.skillChance || 0.15)
      const mult = isMasterpiece ? (master.skillMult || 10) : rnd(1.2, 1.8)
      const finalVal = Math.round(baseVal * mult)
      setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, polished: { masterId, qualityBoost: mult } } : s))
      setCarvingMasterRelations(prev => ({ ...prev, [masterId]: (prev[masterId] || 0) + 1 }))
      setCarvingStone(null)
      tickOp()
      if (isMasterpiece) {
        setNpcRelations(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, (v || 0) + 2])))
        addToast(`✨ 点石成金！传世之作 x10！全市 NPC 好感 +2`)
      }
      addLog({ type:'cut', text:`送雕刻「${stone.name}」→ 褚石翁`, detail: isMasterpiece ? `传世之作 ¥${finalVal.toLocaleString()}` : `成品约 ¥${finalVal.toLocaleString()}`, cashOut:0, amount:0 })
    } else if (masterId === 'gui_shou_a9') {
      const flawed = hasStoneFlaw(stone) || cutId === 'brick'
      let result
      if (flawed) {
        const r = Math.random()
        if (r < (master.crushChance || 0.4)) {
          setInventory(inv => inv.filter(s => s.id !== stoneId))
          addToast(`💀 鬼手手抖搞碎了！血本无归！`)
          setCarvingStone(null)
          tickOp()
          addLog({ type:'loss', text:`鬼手·阿九 失手碎料「${stone.name}」`, detail:'灵光乍现 40% 碎料', cashOut:0, amount: -stone.price })
          return
        }
        if (r < (master.crushChance || 0.4) + (master.jackpotChance || 0.1)) {
          result = { mult: master.jackpotMult || 30, msg: '绝世妖孽' }
        } else result = { mult: rnd(1, 1.5), msg: '正常成品' }
      } else result = { mult: rnd(0.9, 1.3), msg: '完美料雕得无聊' }
      const finalVal = Math.round(baseVal * result.mult)
      setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, polished: { masterId, qualityBoost: result.mult } } : s))
      setCarvingMasterRelations(prev => ({ ...prev, [masterId]: (prev[masterId] || 0) + 1 }))
      setCarvingStone(null)
      tickOp()
      addToast(result.mult >= 30 ? `🔮 灵光乍现！绝世妖孽 x30！` : `🔨 鬼手完成`)
      addLog({ type:'cut', text:`送雕刻「${stone.name}」→ 鬼手·阿九`, detail:`${result.msg} · ¥${finalVal.toLocaleString()}`, cashOut:0, amount:0 })
    } else if (masterId === 'qiao_niang_jinyan') {
      const minMoney = master.interactCosts?.hongbao ?? 50000
      if (money < minMoney) { addToast(`巧娘：钱不到位我不动刀`); return }
      const boost = Math.min(master.maxMult || 2, 2)
      const extraRings = master.extraRings || 2
      const finalVal = Math.round(baseVal * boost) + Math.round(baseVal * 0.15) * extraRings
      setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, polished: { masterId, qualityBoost: boost, extraRings } } : s))
      setCarvingMasterRelations(prev => ({ ...prev, [masterId]: (prev[masterId] || 0) + 1 }))
      setCarvingStone(null)
      tickOp()
      addToast(`💰 巧娘极限压榨！2x + ${extraRings} 戒面，稳！`)
      addLog({ type:'cut', text:`送雕刻「${stone.name}」→ 巧娘·金燕`, detail:`倍率 ${boost}x + ${extraRings} 戒面`, cashOut:0, amount:0 })
    } else if (masterId === 'kumu_chan_shi') {
      if (master.rejectGrades?.includes(cutId)) return
      setInventory(inv => inv.filter(s => s.id !== stoneId))
      setKuMuPendingOrders(prev => [...prev, { stone: { ...stone, id: Date.now() + '_km' }, readyAtDay: currentDay + (master.deliveryDays || 3) }])
      setCarvingMasterRelations(prev => ({ ...prev, [masterId]: (prev[masterId] || 0) + 1 }))
      setCarvingStone(null)
      tickOp()
      addToast(`🧘 枯木禅师接单，${master.deliveryDays} 天后取货，带开光词缀`)
      addLog({ type:'cut', text:`送雕刻「${stone.name}」→ 枯木禅师`, detail:`${master.deliveryDays} 天后取货，开光`, cashOut:0, amount:0 })
    } else {
      // 其余 8 位大师：通用逻辑
      if (master.acceptGrades && !master.noPreference && (master.rejectGrades?.includes(cutId) || !master.acceptGrades.includes(cutId))) return
      if (master.dailyLimit && (carvingMasterUsesToday[masterId] || 0) >= master.dailyLimit) { addToast('养生·李叔今日已接满'); return }
      let mult, fee = 0
      if (master.laborFeePct) {
        fee = Math.round(baseVal * master.laborFeePct)
        if (money < fee) { addToast(`工费 ¥${fee.toLocaleString()}，资金不足`); return }
      }
      if (masterId === 'du_tu_daobai') {
        const r = Math.random()
        if (r < (master.gambleChance || 0.3)) mult = master.gambleMult || 0.5
        else if (r < (master.gambleChance || 0.3) + (master.jackpotChance || 0.2)) mult = master.jackpotMult || 3
        else mult = 1
      } else {
        const arr = master.baseMult
        mult = Array.isArray(arr) ? rnd(arr[0], arr[1]) : (master.baseMult || 1.2)
      }
      const finalVal = Math.round(baseVal * mult)
      if (fee > 0) setMoney(m => m - fee)
      if (master.dailyLimit) setCarvingMasterUsesToday(prev => ({ ...prev, [masterId]: (prev[masterId] || 0) + 1 }))
      setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, polished: { masterId, qualityBoost: mult } } : s))
      setCarvingMasterRelations(prev => ({ ...prev, [masterId]: (prev[masterId] || 0) + 1 }))
      setCarvingStone(null)
      tickOp()
      addToast(`🔨 ${master.name} 完成，倍率 ${mult.toFixed(2)}x`)
      addLog({ type:'cut', text:`送雕刻「${stone.name}」→ ${master.name}`, detail: `倍率 ${mult.toFixed(2)}x · ¥${finalVal.toLocaleString()}${fee ? ` 工费 -¥${fee.toLocaleString()}` : ''}`, cashOut: fee, amount: -fee })
    }
  }, [gameMode, isGameOver, currentDay, money, relicCutValueMult, artistMasterState, carvingMasterRelations, carvingMasterUsesToday, addToast, addLog, tickOp])

  // ── 计算直播竞拍出价（供弹窗与流程复用）
  const computeLiveBids = useCallback((stone) => {
    const cutVal = Math.round(stone.price * stone.cutResult.multiplier * (stone.polished?.qualityBoost || 1) * relicCutValueMult)
    const viewers = [...LIVE_VIEWERS].sort(() => Math.random() - 0.5).slice(0, LIVE_STREAM_LEVELS[liveStreamLevel].slotCount || 5)
    return viewers.map(v => {
      const fav = viewerFavorability[v.id] || 0
      const willMult = v.baseWillingness + Math.min(0.3, fav * 0.02)
      const levelBonus = liveStreamLevel >= 2 ? 1.1 : liveStreamLevel >= 3 ? 1.25 : 1
      const bid = Math.round(cutVal * rnd(0.7, 1.1) * willMult * levelBonus / 100) * 100
      return { viewer: v, bid: Math.max(bid, cutVal * 0.3) }
    }).sort((a, b) => b.bid - a.bid)
  }, [liveStreamLevel, viewerFavorability, relicCutValueMult])

  // ── 直播间售卖（auctionResult 为竞拍流程传入的预结算结果）
  const handleLiveSell = useCallback((stoneId, auctionResult) => {
    if (gameMode === 'menu' || isGameOver || liveStreamLevel < 1) return
    const stone = inventoryRef.current.find(s => s.id === stoneId)
    if (!stone || stone.sold || !stone.cutResult) return
    let top, salePrice
    if (auctionResult) {
      top = auctionResult.winner
      salePrice = auctionResult.salePrice
    } else {
      const bids = computeLiveBids(stone)
      top = bids[0]
      salePrice = top.bid
    }
    const profit = salePrice - stone.price
    setMoney(m => m + salePrice)
    setTotalProfit(p => p + profit)
    setTotalDeals(d => d + 1)
    setInventory(inv => inv.map(s => s.id === stoneId ? { ...s, sold: true } : s))
    setViewerFavorability(prev => ({ ...prev, [top.viewer.id]: (prev[top.viewer.id] || 0) + 1 }))
    setLiveSellStone(null)
    setLiveAuctionData(null)
    tickOp()
    addToast(`📺 ${top.viewer.name} 拍下！¥${salePrice.toLocaleString()}`)
    addLog({ type:'profit', text:`直播售卖「${stone.name}」`, detail:`${top.viewer.name} 出价 ¥${salePrice.toLocaleString()} | 好感+1`, cashIn: salePrice, amount: profit })
  }, [gameMode, isGameOver, liveStreamLevel, computeLiveBids, addToast, addLog, tickOp])

  const handleClearCut = useCallback(() => {
    setInventory(inv => inv.filter(s => !s.sold))
  }, [])

  const script    = SCRIPT_MODES[gameMode] || null
  const debtList  = script?.debts || []
  const nextDebt  = (script && debtList.length && debtIndex < debtList.length) ? debtList[debtIndex] : null
  const isDebtMode= gameMode === 'sprint100' || gameMode === 'tycoon300'
  const daysToNextDebt = nextDebt ? Math.max(0, nextDebt.day - currentDay) : null

  const lvCfg     = MARKET_LEVELS[marketLevel-1]
  const nextLvCfg = MARKET_LEVELS[marketLevel]
  const canUpgrade  = nextLvCfg && money >= nextLvCfg.upgradeCost
  const effectiveRefreshCost = (() => {
    let c = lvCfg.refreshCost
    const influencer = NPC_LIST.find(n => n.id === 'influencer')
    const influencerLv = getNpcLevel(npcRelations['influencer'] || 0)
    const refreshDiscount = getNpcSkillValue(influencer, 'refreshDiscount', influencerLv)
    if (typeof refreshDiscount === 'number' && refreshDiscount > 0) c = Math.round(c * (1 - refreshDiscount))
    return c
  })()
  const hasSold     = inventory.some(s => s.sold)
  const unCutCount  = inventory.filter(s => !s.cutResult).length
  const npcStone    = npcTarget ? inventory.find(s => s.id === npcTarget) : null

  // ── 主菜单：选择剧本模式 ──
  if (gameMode === 'menu') {
    return (
      <div style={{ minHeight:'100vh', background:'radial-gradient(circle at top,#0f172a,#020617 55%)', color:'#e2e8f0', fontFamily:"'Microsoft YaHei','PingFang SC',system-ui,sans-serif", display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
        <div className="menu-container" style={{ width:'100%', maxWidth:880, display:'flex', flexDirection:'column', gap:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:52, height:52, borderRadius:16, background:'linear-gradient(135deg,#22c55e,#14b8a6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, boxShadow:'0 0 24px rgba(34,197,94,.6)' }}>💎</div>
              <div>
                <p style={{ margin:0, fontSize:22, fontWeight:900, letterSpacing:'0.08em', background:'linear-gradient(90deg,#22c55e,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>翡翠大亨 · 剧本模式</p>
                <p style={{ margin:2, fontSize:11, color:'#64748b' }}>选择一种生存剧本，从负债深渊里爬出来。</p>
              </div>
            </div>
            <div style={{ textAlign:'right', fontSize:11, color:'#475569' }}>
              <p style={{ margin:0 }}>版本：Roguelike Debt Survival</p>
              <p style={{ margin:0 }}>初始资金：¥50,000</p>
            </div>
          </div>

          <div className="menu-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:14 }}>
            {/* 绝命狂飙 */}
            <button onClick={() => startScript('sprint100')} style={{ textAlign:'left', padding:16, borderRadius:18, border:'1px solid rgba(239,68,68,.4)', background:'linear-gradient(150deg,rgba(24,24,27,.95),rgba(127,29,29,.8))', cursor:'pointer', boxShadow:'0 18px 40px rgba(0,0,0,.8)' }}>
              <p style={{ fontSize:13, fontWeight:800, color:'#fecaca', margin:'0 0 4px' }}>绝命狂飙（100天）</p>
              <p style={{ fontSize:11, color:'#fca5a5', margin:'0 0 10px' }}>每 10 天强制还债，越往后压力越大。一局节奏极快。</p>
              <p style={{ fontSize:10, color:'#ef4444', margin:0 }}>● 高压短线 · Roguelike · 容易 Game Over</p>
            </button>
            {/* 大亨崛起 */}
            <button onClick={() => startScript('tycoon300')} style={{ textAlign:'left', padding:16, borderRadius:18, border:'1px solid rgba(234,179,8,.45)', background:'linear-gradient(150deg,rgba(24,24,27,.95),rgba(120,53,15,.8))', cursor:'pointer', boxShadow:'0 18px 40px rgba(0,0,0,.8)' }}>
              <p style={{ fontSize:13, fontWeight:800, color:'#facc15', margin:'0 0 4px' }}>大亨崛起（300天）</p>
              <p style={{ fontSize:11, color:'#fcd34d', margin:'0 0 10px' }}>每 30 天大型结算，考验滚雪球与长期规划。</p>
              <p style={{ fontSize:10, color:'#fbbf24', margin:0 }}>● 中长线经营 · 债务随时间飙升</p>
            </button>
            {/* 无尽沙盒 */}
            <button onClick={() => startScript('sandbox')} style={{ textAlign:'left', padding:16, borderRadius:18, border:'1px solid rgba(56,189,248,.45)', background:'linear-gradient(150deg,rgba(24,24,27,.95),rgba(15,23,42,.9))', cursor:'pointer', boxShadow:'0 18px 40px rgba(0,0,0,.8)' }}>
              <p style={{ fontSize:13, fontWeight:800, color:'#7dd3fc', margin:'0 0 4px' }}>无尽沙盒</p>
              <p style={{ fontSize:11, color:'#bae6fd', margin:'0 0 10px' }}>没有债务与天数限制，纯粹爽玩买料、切料、收藏。</p>
              <p style={{ fontSize:10, color:'#38bdf8', margin:0 }}>● 轻松体验 · 无限天数 · 适合练习与体验系统</p>
            </button>
          </div>

          <p style={{ fontSize:10, color:'#4b5563', marginTop:4 }}>
            提示：剧本模式为一次性存档体验，每局从 ¥50,000 开始。死亡后只能重开或回主菜单。存档保存在浏览器本地，清理缓存会丢失。
          </p>

          {hasSave && (
            <button onClick={handleLoad} style={{ width:'100%', padding:12, background:'linear-gradient(135deg,rgba(59,130,246,.5),rgba(37,99,235,.4))', border:'1px solid rgba(59,130,246,.6)', borderRadius:14, color:'#93c5fd', fontSize:14, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <span>📂</span> 载入存档
            </button>
          )}

          <Toast messages={toasts} />
        </div>
      </div>
    )
  }

  // ── 游戏主界面 ──
  return (
    <div className={hasModal ? 'app-root modal-open' : 'app-root'} style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'linear-gradient(160deg,#020617 0%,#060f1e 45%,#020a14 100%)', color:'#e2e8f0', fontFamily:"'Microsoft YaHei','PingFang SC',system-ui,sans-serif" }}>

      {/* ── 顶部导航 ── */}
      <header style={{ flexShrink:0, position:'sticky', top:0, zIndex:50, background:'rgba(2,6,23,.88)', backdropFilter:'blur(18px)', borderBottom:'1px solid rgba(30,41,59,.55)', boxShadow:'0 4px 24px rgba(0,0,0,.45)' }}>
        <div className="app-header-inner" style={{ maxWidth:1300, margin:'0 auto', padding:'0 24px', height:62, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:11 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:'linear-gradient(135deg,#065f46,#059669)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, boxShadow:'0 0 14px rgba(16,185,129,.45)' }}>💎</div>
            <div>
              <h1 style={{ fontSize:19, fontWeight:900, letterSpacing:'0.06em', margin:0, background:'linear-gradient(90deg,#34d399,#6ee7b7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>翡翠大亨</h1>
              <p style={{ fontSize:9, color:'#1e3a5f', margin:0, letterSpacing:'0.14em' }}>JADE TYCOON</p>
            </div>
          </div>

          {/* Buff/Debuff 跑马灯 */}
          <BuffDebuffBar activeEffects={activeEffects} currentDay={currentDay} />

          {/* 状态栏 */}
          <div className="app-header-stats" style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            {/* 剧本模式 */}
            <div style={{ background:'rgba(15,23,42,.9)', border:'1px solid rgba(30,41,59,.9)', borderRadius:10, padding:'5px 12px', minWidth:130 }}>
              <p style={{ fontSize:9, color:'#334155', margin:0, marginBottom:2 }}>剧本模式</p>
              <p style={{ fontSize:13, fontWeight:800, color: script ? '#22c55e' : '#64748b', margin:0 }}>
                {script ? script.name : '未选择'}
              </p>
            </div>

            {/* 天数 */}
            <div style={{ background:'rgba(15,23,42,.8)', border:'1px solid rgba(30,41,59,.8)', borderRadius:10, padding:'5px 12px', textAlign:'center', minWidth:105 }}>
              <p style={{ fontSize:9, color:'#334155', margin:0, marginBottom:2 }}>游戏日期</p>
              <p style={{ fontSize:15, fontWeight:800, color:'#a78bfa', margin:0 }}>第 {currentDay} 天{script?.maxDay ? ` / ${script.maxDay}` : ''}</p>
            </div>

            {/* 债务提示（仅债务模式） */}
            {isDebtMode && (
              <div style={{ background:'rgba(24,24,27,.9)', border:`1px solid ${nextDebt ? 'rgba(239,68,68,.6)' : 'rgba(22,163,74,.7)'}`, borderRadius:10, padding:'5px 12px', minWidth:190 }}>
                {nextDebt ? (
                  <>
                    <p style={{ fontSize:9, color:'#7f1d1d', margin:0, marginBottom:2 }}>距离下次还款：<span style={{ color:'#fecaca', fontWeight:700 }}>{daysToNextDebt}</span> 天（结算日：第 {nextDebt.day} 天）</p>
                    <p style={{ fontSize:12, color:'#fecaca', margin:0, fontWeight:800 }}>目标金额：¥{nextDebt.amount.toLocaleString()}</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize:9, color:'#14532d', margin:0, marginBottom:2 }}>本剧本所有债务已结清</p>
                    <p style={{ fontSize:12, color:'#4ade80', margin:0, fontWeight:800 }}>无债一身轻</p>
                  </>
                )}
              </div>
            )}

            {/* 市场等级 */}
            <div onClick={() => setShowUpgrade(true)} className="upgrade-btn" style={{ background: canUpgrade?'linear-gradient(135deg,rgba(5,46,22,.6),rgba(20,83,45,.4))':'rgba(15,23,42,.8)', border:`1px solid ${canUpgrade?'#34d399aa':'rgba(30,41,59,.8)'}`, borderRadius:10, padding:'5px 12px', cursor:'pointer', textAlign:'center', minWidth:110, boxShadow: canUpgrade?'0 0 12px rgba(52,211,153,.25)':'none', position:'relative', overflow:'hidden' }}>
              {canUpgrade && <div style={{ position:'absolute', top:3, right:3, width:6, height:6, borderRadius:'50%', background:'#34d399', boxShadow:'0 0 6px #34d399', animation:'dot-pulse 1.5s ease-in-out infinite' }} />}
              <p style={{ fontSize:9, color:'#475569', margin:0, marginBottom:1 }}>市场等级</p>
              <p style={{ fontSize:13, fontWeight:800, color:lvCfg.color, margin:0 }}>{lvCfg.icon} {lvCfg.name}</p>
              {canUpgrade && <p style={{ fontSize:8, color:'#34d399', margin:0, marginTop:1 }}>▲ 可升级</p>}
            </div>

            {[
              { label:'当前资金',  value:`¥${money.toLocaleString()}`,                                              color: money>=5000?'#fbbf24':money>=1000?'#fb923c':'#f87171', big:true  },
              { label:'累计盈亏',  value:`${totalProfit>=0?'+':''}¥${totalProfit.toLocaleString()}`,              color: totalProfit>=0?'#4ade80':'#f87171',                      big:false },
              { label:'人品值',    value:`${reputation}`,                                                          color: reputation>=5?'#86efac':reputation>=1?'#fbbf24':'#f87171', big:false },
              { label:'交易次数',  value:`${totalDeals} 次`,                                                        color:'#94a3b8',                                                big:false },
              { label:'私人藏馆',  value:`${collection.length} 件`,                                                color:'#fde68a',                                                big:false },
            ].map(stat => (
              <div key={stat.label} className="stat-cell" onClick={stat.label==='私人藏馆' ? ()=>setShowCollection(true):undefined} style={{ background:'rgba(15,23,42,.8)', border:'1px solid rgba(30,41,59,.8)', borderRadius:10, padding:'5px 12px', textAlign:'center', minWidth:stat.big?115:85, cursor:stat.label==='私人藏馆'?'pointer':'default' }}>
                <p style={{ fontSize:9, color:'#334155', margin:0, marginBottom:2 }}>{stat.label}</p>
                <p style={{ fontSize:stat.big?17:14, fontWeight:800, color:stat.color, margin:0, fontVariantNumeric:'tabular-nums' }}>{stat.value}</p>
              </div>
            ))}

            {/* 操作记录 LOG */}
            <button onClick={()=>setShowLog(true)} className="log-btn" style={{ background: logs.length>0?'rgba(30,41,59,.9)':'rgba(15,23,42,.7)', border:`1px solid ${logs.length>0?'rgba(96,165,250,.35)':'rgba(30,41,59,.7)'}`, borderRadius:10, padding:'5px 12px', cursor:'pointer', textAlign:'center', minWidth:72, position:'relative' }}>
              {logs.length>0 && <div style={{ position:'absolute', top:-3, right:-3, background:'#3b82f6', color:'#fff', fontSize:8, fontWeight:800, minWidth:16, height:16, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 3px', border:'1.5px solid rgba(2,6,23,.9)' }}>{logs.length>99?'99+':logs.length}</div>}
              <p style={{ fontSize:9, color:'#334155', margin:0, marginBottom:2 }}>操作记录</p>
              <p style={{ fontSize:15, margin:0 }}>📋</p>
            </button>
          </div>
        </div>
      </header>

      {/* ── 功能按钮栏（切割工作台上方）── */}
      {gameMode !== 'menu' && !isGameOver && (
        <div style={{ flexShrink:0, background:'rgba(15,23,42,.75)', borderBottom:'1px solid rgba(30,41,59,.5)', padding:'10px 24px', display:'flex', alignItems:'center', justifyContent:'center', gap:10, flexWrap:'wrap' }}>
          <button onClick={()=>setShowLiveStreamUpgrade(true)} style={{ background: liveStreamLevel>=1 ? 'rgba(88,28,135,.5)' : 'rgba(15,23,42,.8)', border:`1px solid ${liveStreamLevel>=1 ? 'rgba(192,132,252,.5)' : 'rgba(51,65,85,.7)'}`, borderRadius:10, padding:'8px 16px', cursor:'pointer', textAlign:'center', minWidth:72, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:18 }}>{liveStreamLevel>=1 ? '📺' : '📴'}</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>直播间</span>
          </button>
          <button onClick={()=>setShowNpcRoster(true)} style={{ background:'rgba(15,23,42,.8)', border:'1px solid rgba(51,65,85,.7)', borderRadius:10, padding:'8px 16px', cursor:'pointer', textAlign:'center', minWidth:72, display:'flex', alignItems:'center', gap:6, position:'relative' }}>
            {(() => {
              const maxLv = Math.max(...NPC_LIST.map(n => getNpcLevel(npcRelations[n.id] || 0)))
              const lvColor = NPC_LEVEL_COLORS[maxLv]
              return maxLv > 0 && <div style={{ position:'absolute', top:-4, right:-4, background: lvColor, fontSize:8, fontWeight:800, width:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid rgba(2,6,23,.9)', color:'#000' }}>{maxLv+1}</div>
            })()}
            <span style={{ fontSize:18 }}>👥</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>人脉</span>
          </button>
          <button onClick={()=>setShowPhone(true)} style={{ background:'linear-gradient(135deg,rgba(7,193,96,.4),rgba(6,173,86,.3))', border:'1px solid rgba(34,197,94,.5)', borderRadius:10, padding:'8px 16px', cursor:'pointer', textAlign:'center', minWidth:72, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:18 }}>📱</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>私信</span>
            {phoneMessages.length > 0 && <span style={{ fontSize:9, background:'#ef4444', color:'#fff', padding:'1px 5px', borderRadius:10, marginLeft:2 }}>{phoneMessages.length}</span>}
          </button>
          <button onClick={()=>setShowLaoChen(true)} style={{ background:'linear-gradient(135deg,rgba(22,101,52,.5),rgba(34,197,94,.3))', border:'1px solid rgba(34,197,94,.5)', borderRadius:10, padding:'8px 16px', cursor:'pointer', textAlign:'center', minWidth:72, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:18 }}>🔨</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>雕刻师</span>
          </button>
          <button onClick={handleSave} style={{ background:'rgba(59,130,246,.4)', border:'1px solid rgba(59,130,246,.5)', borderRadius:10, padding:'8px 16px', cursor:'pointer', textAlign:'center', minWidth:72, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:18 }}>💾</span>
            <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0' }}>保存</span>
          </button>
          <button onClick={()=>setLivestreamActive(a=>!a)} style={{
            padding:'8px 16px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6,
            background: livestreamActive ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'rgba(15,23,42,.8)',
            color: livestreamActive ? '#fff' : '#64748b',
            border: livestreamActive ? '1px solid rgba(239,68,68,.5)' : '1px solid rgba(51,65,85,.6)',
          }}>
            <span>{livestreamActive ? '🔴' : '📺'}</span>
            <span>{livestreamActive ? '直播中' : '直播切石'}</span>
          </button>
          {livestreamActive && (
            <button onClick={()=>setShowGiftModal(true)} disabled={inventory.filter(s=>s.cutResult && !s.sold && (s.cutResult?.multiplier||1)<1.2).length===0}
              style={{ padding:'8px 16px', borderRadius:10, border:'1px solid rgba(251,191,36,.5)', background:'linear-gradient(135deg,rgba(180,83,9,.5),rgba(251,191,36,.25))', color:'#fde68a', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <span>🎁</span>
              <span>发福利</span>
            </button>
          )}
        </div>
      )}

      {/* ── 主内容（原石市场 + 切割工作台）── */}
      <main className="app-main-scroll" style={{ flex:1, minHeight:0, overflowY:'auto', overflowX:'hidden' }}>
        <div className="app-main" style={{ maxWidth:1300, margin:'0 auto', padding:'20px 24px', display:'flex', gap:18, alignItems:'flex-start', flexWrap:'wrap' }}>

        {/* ── 左栏：市场 ── */}
        <aside className="app-aside" style={{ width:310, flexShrink:0 }}>
          <div style={{ background:'rgba(13,20,36,.7)', border:'1px solid rgba(30,41,59,.65)', borderRadius:18, padding:16, backdropFilter:'blur(10px)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <span style={{ fontSize:17 }}>{lvCfg.icon}</span>
                <div>
                  <span style={{ fontWeight:800, fontSize:15, color:'#f1f5f9' }}>原石市场</span>
                  <span style={{ marginLeft:6, fontSize:9, padding:'1px 7px', borderRadius:20, background:`${lvCfg.accentColor}55`, color:lvCfg.color, border:`1px solid ${lvCfg.color}44` }}>{lvCfg.name}</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={()=>setShowUpgrade(true)} className="refresh-btn" style={{ background: canUpgrade?`linear-gradient(135deg,${lvCfg.accentColor}aa,${lvCfg.color}66)`:'rgba(30,41,59,.8)', border:`1px solid ${canUpgrade?lvCfg.color+'66':'rgba(51,65,85,.6)'}`, borderRadius:8, padding:'4px 9px', color: canUpgrade?lvCfg.color:'#475569', fontSize:10, cursor:'pointer', fontWeight:700 }}>{nextLvCfg?'↑ 升级':'已满级'}</button>
                <button onClick={handleRefresh} className="refresh-btn" style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(51,65,85,.6)', borderRadius:8, padding:'4px 9px', color:'#64748b', fontSize:10, cursor:'pointer' }}>🔄 -¥{effectiveRefreshCost}{effectiveRefreshCost < lvCfg.refreshCost && <span style={{ color:'#4ade80', marginLeft:2 }}>↓</span>}</button>
              </div>
            </div>

            {/* 三渠道页签 */}
            <div style={{ display:'flex', gap:4, marginBottom:12 }}>
              {[
                { key:'kg', label:'公斤料区', icon:'🧱', count: marketData.kgStones.length },
                { key:'premium', label:'精品柜台', icon:'💎', count: marketData.premiumStones.length },
                { key:'auction', label:'暗标公盘', icon:'🏷️', count: marketData.auctionStone ? 1 : 0 },
              ].map(t => (
                <button key={t.key} onClick={()=>setMarketTab(t.key)} style={{
                  flex:1, padding:'8px 6px', borderRadius:10, border:`1px solid ${marketTab===t.key?'#475569':'rgba(30,41,59,.6)'}`,
                  background: marketTab===t.key ? 'rgba(51,65,85,.9)' : 'rgba(15,23,42,.6)', color: marketTab===t.key?'#f1f5f9':'#64748b',
                  fontSize:11, fontWeight:700, cursor:'pointer'
                }}>{t.icon} {t.label} ({t.count})</button>
              ))}
            </div>

            {marketTab === 'kg' && (marketData.kgStones.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#475569', fontSize:12 }}>公斤料已售罄，刷新补货</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {marketData.kgStones.map(stone => {
                  const eff = Math.round(stone.price * modifiers.marketPrice)
                  return <MarketStoneCard key={stone.id} stone={stone} channel="kg" onBuy={handleBuy} onFlashlight={handleFlashlight} canAfford={money >= eff} marketPriceMult={modifiers.marketPrice} onShowDetail={s=>setStoneDetail({ stone:s, originConfig: ORIGIN_CONFIG[s.originId] || ORIGIN_CONFIG['其他'] })} money={money} />
                })}
              </div>
            ))}

            {marketTab === 'premium' && (marketData.premiumStones.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#475569', fontSize:12 }}>精品柜已空，刷新补货</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {marketData.premiumStones.map(stone => {
                  const eff = Math.round(stone.price * modifiers.marketPrice)
                  const angry = premiumAngryToday.includes(stone.id)
                  return <MarketStoneCard key={stone.id} stone={stone} channel="premium" onBuy={handleBuy} onBargain={()=>setBargainStone(stone)} onFlashlight={handleFlashlight} canAfford={money >= eff} marketPriceMult={modifiers.marketPrice} onShowDetail={s=>setStoneDetail({ stone:s, originConfig: ORIGIN_CONFIG[s.originId] || ORIGIN_CONFIG['其他'] })} money={money} isAngry={angry} />
                })}
              </div>
            ))}

            {marketTab === 'auction' && (!marketData.auctionStone ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#475569', fontSize:12 }}>本轮无暗标，刷新后出现</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                <MarketStoneCard stone={marketData.auctionStone} channel="auction" onBid={()=>setAuctionBidStone(marketData.auctionStone)} onFlashlight={handleFlashlight} onShowDetail={s=>setStoneDetail({ stone:s, originConfig: ORIGIN_CONFIG[s.originId] || ORIGIN_CONFIG['其他'] })} money={money} />
              </div>
            ))}
            <OddsPanel />
          </div>

          {/* 时间系统说明 */}
          <div style={{ background:'rgba(13,20,36,.55)', border:'1px solid rgba(30,41,59,.55)', borderRadius:14, padding:'12px 14px', marginTop:10 }}>
            <p style={{ color:'#334155', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>TIME SYSTEM · 游戏时间</p>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ color:'#64748b', fontSize:11 }}>每 {daySpeed} 次操作 = 1 天</span>
              <span style={{ color:'#a78bfa', fontSize:11, fontWeight:700 }}>当前第 {currentDay} 天</span>
            </div>
            <div style={{ height:4, background:'rgba(30,41,59,.8)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background:'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius:2, width:`${(opCount % daySpeed) / daySpeed * 100}%`, transition:'width .3s' }} />
            </div>
            <p style={{ color:'#1e293b', fontSize:10, marginTop:6 }}>已操作 {opCount} 次，今日进度 {opCount % daySpeed}/{daySpeed}</p>
            <p style={{ color:'#334155', fontSize:10, marginTop:4 }}>✦ 收藏品每天自动升值</p>
          </div>

          {/* 大料加成 */}
          <div style={{ background:'rgba(13,20,36,.55)', border:'1px solid rgba(30,41,59,.55)', borderRadius:14, padding:'12px 14px', marginTop:10 }}>
            <p style={{ color:'#334155', fontSize:10, fontWeight:700, letterSpacing:'0.08em', marginBottom:8 }}>SIZE BONUS · 大料加成</p>
            {SIZES.slice(2).map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ color:'#64748b', fontSize:11 }}>{s.label} ({s.weightRange[0]}~{s.weightRange[1]}kg)</span>
                <div style={{ display:'flex', gap:6 }}>
                  {s.bonusIce>0 && <span style={{ color:'#7dd3fc', fontSize:10 }}>冰种+{(s.bonusIce*100).toFixed(0)}%</span>}
                  {s.bonusImperial>0 && <span style={{ color:'#86efac', fontSize:10 }}>帝王+{(s.bonusImperial*100).toFixed(0)}%</span>}
                </div>
              </div>
            ))}
          </div>

          {/* 已装备道具 */}
          <EquippedRelicsBar equippedRelics={equippedRelics} />
        </aside>

        {/* ── 右栏：工作台 ── */}
        <section style={{ flex:1, minWidth:0 }}>
          <div style={{ background:'rgba(13,20,36,.7)', border:'1px solid rgba(30,41,59,.65)', borderRadius:18, padding:16, backdropFilter:'blur(10px)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:17 }}>⚒️</span>
                <span style={{ fontWeight:800, fontSize:15, color:'#f1f5f9' }}>切割工作台</span>
                {unCutCount > 0 && <span style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'rgba(180,83,9,.3)', color:'#fbbf24', border:'1px solid rgba(251,191,36,.25)', fontWeight:700 }}>{unCutCount} 块待切</span>}
                {collection.length > 0 && <span onClick={()=>setShowCollection(true)} style={{ fontSize:9, padding:'2px 7px', borderRadius:20, background:'rgba(120,53,15,.4)', color:'#fde68a', border:'1px solid rgba(251,191,36,.3)', fontWeight:700, cursor:'pointer' }}>🏺 藏馆 {collection.length} 件</span>}
                {inventory.length > 0 && (
                  <button onClick={()=>setShowWorkbenchLog(true)} style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(96,165,250,.4)', borderRadius:8, padding:'4px 10px', color:'#60a5fa', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                    📋 工作台LOG
                    {inventory.length > WORKBENCH_MAX_VISIBLE && <span style={{ background:'#3b82f6', color:'#fff', padding:'0 5px', borderRadius:10, fontSize:9 }}>{inventory.length}</span>}
                  </button>
                )}
              </div>
              {hasSold && <button onClick={handleClearCut} style={{ background:'rgba(30,41,59,.8)', border:'1px solid rgba(51,65,85,.6)', borderRadius:8, padding:'4px 10px', color:'#64748b', fontSize:10, cursor:'pointer' }}>🗑️ 清理已处置</button>}
            </div>

            {inventory.length === 0 ? (
              <div style={{ textAlign:'center', padding:'72px 0', color:'#1e3a5f' }}>
                <div style={{ fontSize:56, marginBottom:14, opacity:.35 }}>🪨</div>
                <p style={{ fontSize:16, fontWeight:700, color:'#334155', marginBottom:7 }}>工作台空空如也</p>
                <p style={{ fontSize:12, color:'#1e293b' }}>在左侧市场购买原石，切开后可直接卖出、找NPC议价或收藏升值</p>
              </div>
            ) : (
              <div className="app-workbench-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(162px,1fr))', gap:12 }}>
                {(inventory.length > WORKBENCH_MAX_VISIBLE ? inventory.slice(-WORKBENCH_MAX_VISIBLE) : inventory).map(stone => (
                  <WorkbenchCard key={stone.id} stone={stone}
                    onCut={handleCut}
                    onSell={handleSell}
                    onNpc={id => { tickOp(); setNpcTarget(id); }}
                    onCollect={handleCollect}
                    onOpenWindow={handleOpenWindow}
                    onSellSemi={handleSellSemi}
                    onCarving={id => setCarvingStone(inventory.find(s=>s.id===id))}
                    onLiveSell={id => setLiveSellStone(inventory.find(s=>s.id===id))}
                    cutValueMult={relicCutValueMult}
                    money={money}
                    liveStreamLevel={liveStreamLevel}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 新手引导 */}
          {inventory.length === 0 && (
            <div className="app-tip-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:12 }}>
              {[
                { icon:'🏗️', title:'升级市场', desc:'5个等级解锁更多原石种类', color:'#34d399' },
                { icon:'🤝', title:'找NPC议价', desc:'6位NPC随机出价，交易升级关系，出价越来越高', color:'#e879f9' },
                { icon:'🏺', title:'收藏升值', desc:'冰种以上出精品，持有每天增值', color:'#fbbf24' },
                { icon:'📅', title:'时间系统', desc:'每3次操作=1天，收藏自动升值', color:'#a78bfa' },
              ].map(tip => (
                <div key={tip.title} style={{ background:'rgba(13,20,36,.5)', border:`1px solid ${tip.color}22`, borderRadius:14, padding:14, textAlign:'center' }}>
                  <div style={{ fontSize:26, marginBottom:7, filter:`drop-shadow(0 0 7px ${tip.color}66)` }}>{tip.icon}</div>
                  <p style={{ fontWeight:700, fontSize:12, color:tip.color, marginBottom:5 }}>{tip.title}</p>
                  <p style={{ fontSize:10, color:'#334155', lineHeight:1.6 }}>{tip.desc}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>
      </main>

      {/* ── 弹窗 ── */}
      {stoneDetail && <StoneDetailModal stone={stoneDetail.stone} originConfig={stoneDetail.originConfig} onClose={()=>setStoneDetail(null)} />}
      {carvingStone && <CarvingModal stone={carvingStone} money={money} cutValueMult={relicCutValueMult} masters={ARTIST_MASTERS} relations={carvingMasterRelations} masterState={artistMasterState} currentDay={currentDay} usesToday={carvingMasterUsesToday} onSelect={(mid)=>{handleCarving(carvingStone.id, mid); setCarvingStone(null);}} onClose={()=>setCarvingStone(null)} />}
      {liveSellStone && <LiveSellModal stone={liveSellStone} cutValueMult={relicCutValueMult} onConfirm={()=>{ const bids = computeLiveBids(liveSellStone); setLiveAuctionData({ stone: liveSellStone, bids }); setLiveSellStone(null); }} onClose={()=>setLiveSellStone(null)} />}
      {liveAuctionData && <LiveAuctionProcessModal data={liveAuctionData} onComplete={()=>{ const w = liveAuctionData.bids[0]; handleLiveSell(liveAuctionData.stone.id, { winner: w, salePrice: w.bid }); }} />}
      {showLiveStreamUpgrade && <LiveStreamUpgradeModal level={liveStreamLevel} money={money} levels={LIVE_STREAM_LEVELS} onUpgrade={handleLiveStreamUpgrade} onClose={()=>setShowLiveStreamUpgrade(false)} viewerFavorability={viewerFavorability} />}
      {bargainStone && <BargainModal stone={bargainStone} onChooseType={(s,t)=>setBargainQte({stone:s,type:t})} onClose={()=>setBargainStone(null)} />}
      {bargainQte && <BargainQteModal stone={bargainQte.stone} type={bargainQte.type} onComplete={(qtePerfect)=>{handleBargain(bargainQte.stone,bargainQte.type,qtePerfect);setBargainQte(null)}} onClose={()=>setBargainQte(null)} />}
      {auctionBidStone && <BlindAuctionModal stone={auctionBidStone} money={money} onSubmitBid={handleAuctionBid} onClose={()=>setAuctionBidStone(null)} />}
      {showUpgrade   && <UpgradeModal marketLevel={marketLevel} money={money} onUpgrade={handleUpgrade} onClose={()=>setShowUpgrade(false)} />}
      {showLog       && <LogModal logs={logs} onClose={()=>setShowLog(false)} />}
      {showWorkbenchLog && <WorkbenchLogModal stones={inventory} onClose={()=>setShowWorkbenchLog(false)} onCut={handleCut} onSell={handleSell} onNpc={id=>{ tickOp(); setNpcTarget(id); }} onCollect={handleCollect} onOpenWindow={handleOpenWindow} onSellSemi={handleSellSemi} onCarving={id=>setCarvingStone(inventory.find(s=>s.id===id))} onLiveSell={id=>setLiveSellStone(inventory.find(s=>s.id===id))} cutValueMult={relicCutValueMult} money={money} liveStreamLevel={liveStreamLevel} />}
      {showCollection && <CollectionPanel collection={collection} currentDay={currentDay} onSell={handleSellCollection} onClose={()=>setShowCollection(false)} collectionAppreciateBoost={(() => { const p = NPC_LIST.find(n => n.id === 'professor_li'); const lv = getNpcLevel(npcRelations['professor_li'] || 0); return p?.globalPerk && lv >= (p.globalPerk.unlockAtLv ?? 2) ? (p.globalPerk.value ?? 0.2) : 0 })()} />}
      {showNpcRoster && <NpcRosterPanel npcRelations={npcRelations} onClose={()=>setShowNpcRoster(false)} />}
      {npcStone      && <NpcModal stone={npcStone} npcRelations={npcRelations} onSellToNpc={handleSellToNpc} onClose={()=>setNpcTarget(null)} npcOfferMult={modifiers.npcOffer} cutValueMult={relicCutValueMult} />}

      {showPhone && <PhonePanel messages={phoneMessages} npcList={[...NPC_LIST, { id:'bang_yige', name:'榜一大哥', icon:'👑' }]} onReply={handlePhoneReply} onClose={()=>setShowPhone(false)} />}
      {showLaoChen && <ArtistMastersPanel masterState={artistMasterState} money={money} currentDay={currentDay} onInteract={handleArtistInteract} onClose={()=>setShowLaoChen(false)} />}
      {livestreamActive && <LiveStreamBarrageLayer barrages={livestreamBarrages} />}
      {showGiftModal && (
        <div style={{ position:'fixed', inset:0, zIndex:480, background:'rgba(0,0,0,.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={()=>setShowGiftModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'#1e293b', border:'1px solid rgba(251,191,36,.4)', borderRadius:16, padding:20, maxWidth:360 }}>
            <p style={{ color:'#fde68a', marginBottom:12, fontSize:14 }}>选择一块低级料送给弹幕（拉满热度）：</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {inventory.filter(s=>s.cutResult && !s.sold && (s.cutResult?.multiplier||1)<1.2).slice(0,6).map(s=>(
                <button key={s.id} onClick={()=>handleLivestreamGift(s.id)} style={{ padding:'8px 12px', background:'rgba(251,191,36,.15)', border:'1px solid rgba(251,191,36,.4)', borderRadius:10, color:'#fde68a', fontSize:11, cursor:'pointer' }}>{s.cutResult?.name || s.name} · ¥{Math.round(s.price*(s.cutResult?.multiplier||1)).toLocaleString()}</button>
              ))}
            </div>
            <button onClick={()=>setShowGiftModal(false)} style={{ marginTop:12, width:'100%', padding:8, background:'#334155', border:'none', borderRadius:8, color:'#94a3b8', cursor:'pointer' }}>取消</button>
          </div>
        </div>
      )}

      {pendingEvent && <EventModal event={pendingEvent} onConfirm={handleConfirmEvent} />}
      {showBlackMarket && <BlackMarketModal offers={blackMarketOffers} money={money} equippedRelics={equippedRelics} onBuy={(id)=>handleBuyRelic(id, ()=>{ setShowBlackMarket(false); setBlackMarketPurchasedDays(p=>[...p, currentDay]); })} onClose={()=>setShowBlackMarket(false)} />}
      {currentDay > 0 && currentDay % 10 === 5 && !showBlackMarket && !blackMarketPurchasedDays.includes(currentDay) && (
        <button onClick={handleOpenBlackMarket} style={{
          position:'fixed', bottom:24, right:24, zIndex:100,
          padding:'12px 20px', borderRadius:14, border:'1px solid rgba(251,191,36,.5)',
          background:'linear-gradient(135deg,rgba(146,64,14,.9),rgba(180,83,9,.85))',
          color:'#fef3c7', fontSize:13, fontWeight:800, cursor:'pointer',
          boxShadow:'0 4px 20px rgba(251,191,36,.3)',
        }}>🏪 神秘黑市</button>
      )}
      <DebtClearModal info={lastDebtInfo} onClose={() => setLastDebtInfo(null)} />
      <GameOverModal info={gameOverInfo} onRestartSame={restartSameScript} onBackMenu={backToMenu} />
      <Toast messages={toasts} />
    </div>
  )
}
