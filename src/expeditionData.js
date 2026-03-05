/**
 * 寻玉远征 (Expedition) - Slay the Spire 式路线图数据
 * 解锁5级市场后，消耗7~10天+启动资金进入节点路线探索
 */

export const EXPEDITION_DAYS = [7, 8, 9, 10]
export const EXPEDITION_CAPITAL_MIN = 200000
export const EXPEDITION_CAPITAL_MAX = 500000

// 节点类型
export const NODE_TYPES = {
  stone_stall: { id: 'stone_stall', name: '原石摊', icon: '💎', desc: '常规购买原石' },
  smuggler_camp: { id: 'smuggler_camp', name: '走私客营地', icon: '🏕️', desc: '极其便宜的高货，但有黑吃黑风险' },
  random_event: { id: 'random_event', name: '突发事件', icon: '❓', desc: '塌方、矿脉、意外...' },
  rest_area: { id: 'rest_area', name: '休息区', icon: '🛋️', desc: '流浪雕刻师，可现场加工' },
  boss: { id: 'boss', name: '军阀公盘', icon: '👑', desc: '终极Boss：赢下标王' },
}

// 远征内突发事件（50+ 个）
export const EXPEDITION_EVENTS = [
  { id: 'cave_in', type: 'negative', icon: '⛏️', name: '塌方', desc: '矿道塌方！损失 ¥{amount} 并浪费 1 天', effect: { cashLoss: 0.1, daysLost: 1 } },
  { id: 'premium_vein', type: 'positive', icon: '✨', name: '挖出极品矿脉', desc: '发现隐藏矿脉！获得一块传奇品质原石', effect: { giveLegendary: 1 } },
  { id: 'bandit_road', type: 'negative', icon: '🗡️', name: '遇劫匪', desc: '半路遇劫！交出 {amount} 或失去 1 块最贵原石', effect: { cashOrStone: true } },
  { id: 'lucky_stone', type: 'positive', icon: '🍀', name: '踩到宝', desc: '脚下一滑，踢出一块冰种料！', effect: { giveIce: 1 } },
  { id: 'poison_gas', type: 'negative', icon: '💨', name: '毒气渗漏', desc: '吸入毒气，头晕目眩。损失 2 天恢复', effect: { daysLost: 2 } },
  { id: 'old_miner', type: 'positive', icon: '👴', name: '老矿工指点', desc: '老矿工传授经验，下一块原石打灯准确率+50%', effect: { nextFlashlightBonus: 0.5 } },
  { id: 'flood', type: 'negative', icon: '🌊', name: '地下暗河突涨', desc: '暗河涨水！损失 ¥{amount} 和 1 块随机原石', effect: { cashLoss: 0.15, loseRandomStone: 1 } },
  { id: 'jade_buddha', type: 'positive', icon: '🙏', name: '祭拜翡翠佛', desc: '路边小庙，诚心祭拜。人品值+2', effect: { reputation: 2 } },
  { id: 'fake_guide', type: 'negative', icon: '🕵️', name: '假向导', desc: '被假向导骗走 ¥{amount}', effect: { cashLoss: 0.2 } },
  { id: 'treasure_map', type: 'positive', icon: '🗺️', name: '藏宝图', desc: '捡到半张藏宝图！下个节点必出高货', effect: { nextNodePremium: true } },
  { id: 'snake_bite', type: 'negative', icon: '🐍', name: '毒蛇咬伤', desc: '被毒蛇咬伤，花 ¥{amount} 买血清', effect: { cashLoss: 0.08 } },
  { id: 'merchant_discount', type: 'positive', icon: '🛒', name: '热情商人', desc: '路遇商人，所有原石打8折', effect: { marketDiscount: 0.8 } },
  { id: 'landslide', type: 'negative', icon: '🏔️', name: '山体滑坡', desc: '滑坡封路，绕道多耗 2 天', effect: { daysLost: 2 } },
  { id: 'gem_sparkle', type: 'positive', icon: '💠', name: '宝石闪光', desc: '岩壁反光，挖出一块玻璃种！', effect: { giveGlass: 1 } },
  { id: 'military_check', type: 'negative', icon: '🪖', name: '军阀盘查', desc: '被军阀手下盘查，贿赂 ¥{amount} 过关', effect: { cashLoss: 0.12 } },
  { id: 'fortune_teller', type: 'positive', icon: '🔮', name: '算命先生', desc: '「你今日有财！」下一刀切涨概率+20%', effect: { nextCutBonus: 0.2 } },
  { id: 'broken_bridge', type: 'negative', icon: '🌉', name: '桥断了', desc: '独木桥朽坏，绕路损失 1 天', effect: { daysLost: 1 } },
  { id: 'dragon_scale', type: 'positive', icon: '🐉', name: '龙鳞矿', desc: '发现龙鳞纹矿脉！获得帝王绿毛料', effect: { giveImperial: 1 } },
  { id: 'food_poison', type: 'negative', icon: '🤢', name: '吃坏肚子', desc: '路边摊不干净，卧床 1 天', effect: { daysLost: 1 } },
  { id: 'lucky_coin', type: 'positive', icon: '🪙', name: '捡到古币', desc: '踢到一枚古币，卖出得 ¥{amount}', effect: { cashGain: 0.05 } },
  { id: 'thief_pickpocket', type: 'negative', icon: '👛', name: '扒手', desc: '钱包被摸，损失 ¥{amount}', effect: { cashLoss: 0.1 } },
  { id: 'rain_blessing', type: 'positive', icon: '🌧️', name: '喜雨', desc: '久旱逢甘霖，矿工干劲足。下个原石摊多2块料', effect: { nextStallBonus: 2 } },
  { id: 'bear_attack', type: 'negative', icon: '🐻', name: '熊出没', desc: '遇熊！丢下最便宜那块原石保命', effect: { loseCheapestStone: 1 } },
  { id: 'jade_spring', type: 'positive', icon: '⛲', name: '翡翠泉', desc: '泡翡翠泉，身心舒畅。人品+1，明日精力+1', effect: { reputation: 1, nextDayBonus: 1 } },
  { id: 'fog_maze', type: 'negative', icon: '🌫️', name: '迷雾迷路', desc: '大雾弥漫，迷路浪费 1 天', effect: { daysLost: 1 } },
  { id: 'smuggler_tip', type: 'positive', icon: '🤫', name: '走私客内线', desc: '得到内线消息，下个走私营地无风险', effect: { nextSmugglerSafe: true } },
  { id: 'earthquake', type: 'negative', icon: '🌍', name: '小地震', desc: '地震！损失 ¥{amount} 和 1 天', effect: { cashLoss: 0.08, daysLost: 1 } },
  { id: 'phoenix_ash', type: 'positive', icon: '🪶', name: '凤凰灰', desc: '捡到凤凰羽烧成的灰，下一块料冰种概率+30%', effect: { nextIceBonus: 0.3 } },
  { id: 'bandit_ambush', type: 'negative', icon: '🏹', name: '伏击', desc: '遭遇伏击！交出 2 块原石或 ¥{amount}', effect: { stoneOrCash: { stones: 2, cashPct: 0.25 } } },
  { id: 'temple_donate', type: 'positive', icon: '⛩️', name: '寺庙布施', desc: '布施后得高僧祝福，人品+3', effect: { reputation: 3 } },
  { id: 'infectious', type: 'negative', icon: '🤒', name: '染病', desc: '水土不服生病，休养 2 天', effect: { daysLost: 2 } },
  { id: 'gold_nugget', type: 'positive', icon: '🥇', name: '金块', desc: '挖到伴生金块，变卖得 ¥{amount}', effect: { cashGain: 0.08 } },
  { id: 'false_alarm', type: 'negative', icon: '🚨', name: '虚惊一场', desc: '听说前方有军阀，绕路浪费 1 天', effect: { daysLost: 1 } },
  { id: 'master_meet', type: 'positive', icon: '👨‍🎨', name: '巧遇大师', desc: '路遇流浪雕刻师，免费加工 1 件', effect: { freeCarve: 1 } },
  { id: 'bribe_demand', type: 'negative', icon: '💰', name: '索贿', desc: '关卡索贿 ¥{amount}', effect: { cashLoss: 0.06 } },
  { id: 'aurora', type: 'positive', icon: '🌌', name: '极光显灵', desc: '夜观极光，灵感顿开。下3块料切涨概率+15%', effect: { next3CutBonus: 0.15 } },
  { id: 'sinkhole', type: 'negative', icon: '🕳️', name: '陷坑', desc: '踩进陷坑，伤到脚。休息 1 天', effect: { daysLost: 1 } },
  { id: 'warrior_spirit', type: 'positive', icon: '⚔️', name: '战神附体', desc: '冥冥中如有神助，下次竞标出价+20%把握', effect: { nextBidBonus: 0.2 } },
  { id: 'fake_stone', type: 'negative', icon: '🎭', name: '买到假料', desc: '上次买的原来是假货！损失 1 块最贵原石', effect: { loseMostExpensive: 1 } },
  { id: 'rainbow_bridge', type: 'positive', icon: '🌈', name: '彩虹桥', desc: '彩虹下挖出花青料，品质上乘', effect: { giveFlower: 1 } },
  { id: 'scorpion', type: 'negative', icon: '🦂', name: '蝎子蛰', desc: '被蝎子蛰，花 ¥{amount} 疗伤', effect: { cashLoss: 0.04 } },
  { id: 'ancestor_guide', type: 'positive', icon: '👻', name: '祖先托梦', desc: '梦到祖先指路，下个节点奖励翻倍', effect: { nextRewardDouble: true } },
  { id: 'price_gouge', type: 'negative', icon: '📈', name: '物价飞涨', desc: '当地物价暴涨，多花 ¥{amount}', effect: { cashLoss: 0.1 } },
  { id: 'lucky_stall', type: 'positive', icon: '🎰', name: '幸运摊位', desc: '摊主说今日第一单半价！', effect: { nextBuyHalf: true } },
  { id: 'rope_cut', type: 'negative', icon: '🪢', name: '绳索断裂', desc: '攀岩时绳断，摔伤休养 1 天', effect: { daysLost: 1 } },
  { id: 'jade_egg', type: 'positive', icon: '🥚', name: '翡翠蛋', desc: '捡到一颗翡翠原石蛋，开出糯种', effect: { giveWaxy: 1 } },
  { id: 'sleeping_gas', type: 'negative', icon: '😴', name: '迷烟', desc: '被人下迷烟，醒来发现少了 ¥{amount}', effect: { cashLoss: 0.15 } },
  { id: 'king_fisher', type: 'positive', icon: '🦜', name: '翠鸟引路', desc: '翠鸟带路找到矿坑，获得精品料', effect: { giveRare: 1 } },
  { id: 'mud_slide', type: 'negative', icon: '🧱', name: '泥石流', desc: '泥石流阻断道路，绕行 2 天', effect: { daysLost: 2 } },
  { id: 'lotus_pond', type: 'positive', icon: '🪷', name: '莲池', desc: '莲池边打坐，心静眼明。打灯准确率永久+5%（本局）', effect: { flashlightAccPermanent: 0.05 } },
  { id: 'fake_auction', type: 'negative', icon: '📢', name: '假拍卖', desc: '参与假拍卖被骗 ¥{amount}', effect: { cashLoss: 0.18 } },
  { id: 'star_align', type: 'positive', icon: '⭐', name: '星辰连珠', desc: '星象大吉！下 5 次切割砖头率-20%', effect: { next5BrickReduce: 0.2 } },
  { id: 'thunder_storm', type: 'negative', icon: '⛈️', name: '雷暴', desc: '雷暴封山，困 1 天', effect: { daysLost: 1 } },
  { id: 'hermit_gift', type: 'positive', icon: '🧙', name: '隐士赠礼', desc: '山中隐士赠你一块老坑料', effect: { giveEpic: 1 } },
  { id: 'quicksand', type: 'negative', icon: '🏜️', name: '流沙', desc: '陷入流沙，丢下背包里最便宜 2 块料脱身', effect: { lose2Cheapest: true } },
  { id: 'dragon_dream', type: 'positive', icon: '🐲', name: '龙梦', desc: '梦见青龙吐珠，醒来发现人品+2', effect: { reputation: 2 } },
  { id: 'market_crash', type: 'negative', icon: '📉', name: '当地崩盘', desc: '当地翡翠价崩，你手上原石估值-10%', effect: { inventoryValueDown: 0.1 } },
  { id: 'bamboo_slip', type: 'positive', icon: '📜', name: '古竹简', desc: '挖到古竹简，记载矿脉位置。下节点必出史诗料', effect: { nextEpic: true } },
  { id: 'witch_curse', type: 'negative', icon: '🧹', name: '巫婆诅咒', desc: '得罪巫婆，下 2 刀切垮概率+30%', effect: { next2BrickBonus: 0.3 } },
  { id: 'buddha_light', type: 'positive', icon: '🙏', name: '佛光普照', desc: '佛光中一块原石发亮，开出冰种', effect: { giveIce: 1 } },
  { id: 'snake_trap', type: 'negative', icon: '🐍', name: '蛇窝', desc: '误入蛇窝，被咬花 ¥{amount} 解毒', effect: { cashLoss: 0.07 } },
  { id: 'merchant_friend', type: 'positive', icon: '🤝', name: '商人朋友', desc: '偶遇老主顾，送你一块精品', effect: { giveUncommon: 1 } },
  { id: 'cave_collapse', type: 'negative', icon: '💥', name: '洞窟坍塌', desc: '洞窟坍塌！损失 ¥{amount}，2 天挖出路', effect: { cashLoss: 0.2, daysLost: 2 } },
]

// 生成远征路线（每行2-4个节点，约4-5行，最后一行为Boss）
export function generateExpeditionMap() {
  const rows = 5
  const map = []
  const nodeTypeWeights = {
    stone_stall: 3,
    smuggler_camp: 2,
    random_event: 2,
    rest_area: 1,
  }
  const types = Object.keys(nodeTypeWeights)
  const totalWeight = types.reduce((s, t) => s + nodeTypeWeights[t], 0)

  function weightedPick() {
    let r = Math.random() * totalWeight
    for (const t of types) {
      r -= nodeTypeWeights[t]
      if (r <= 0) return t
    }
    return types[0]
  }
  for (let r = 0; r < rows; r++) {
    const count = r === 0 ? 1 : r === rows - 1 ? 1 : 2 + Math.floor(Math.random() * 2)
    const row = []
    for (let i = 0; i < count; i++) {
      const type = r === rows - 1 ? 'boss' : weightedPick()
      row.push({ id: `n_${r}_${i}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type, row: r, col: i })
    }
    map.push(row)
  }
  return map
}

// 从事件池随机抽取
export function pickExpeditionEvent() {
  return EXPEDITION_EVENTS[Math.floor(Math.random() * EXPEDITION_EVENTS.length)]
}
