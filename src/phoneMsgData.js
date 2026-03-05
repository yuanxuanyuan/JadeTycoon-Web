// 200 个私信事件模板 - 与 PHONE_MSG_POOL 合并使用
const PHONE_NPC_IDS = ['lao_wang', 'xiao_mei', 'master_chen', 'influencer', 'zhang_zong', 'fat_uncle', 'professor_li', 'auntie_zhou', 'old_driver', 'pawn_boss', 'newbie_buyer', 'hotel_boss', 'stock_guy', 'feng_shui', 'wedding_planner', 'museum_curator', 'old_monk', 'hk_trader', 'taiwan_lady', 'myanmar_agent', 'kid_rich', 'retired_cop', 'hospital_dean', 'old_gambler', 'antique_dealer']

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rndInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)) }

const MSG_TEMPLATES = [
  { msgs: ['兄弟手头紧，能借我{amount}周转吗？', '急用钱，{amount}能借我吗？三天还。', '最近周转不开，{amount}救急行不？'], type: 'borrow', amount: [3000, 5000, 8000], opts: [{ text: '借给你', actionType: 'PAY_MONEY', affinityDelta: 2 }, { text: '不好意思', actionType: 'TEXT', affinityDelta: -1 }] },
  { msgs: ['听说缅甸矿难，好料要涨！', '最近公盘有动静，你囤货了吗？', '行情要变，早做准备啊。'], type: 'gossip', opts: [{ text: '早囤了', actionType: 'TEXT', affinityDelta: 1 }, { text: '马上去看', actionType: 'TEXT', affinityDelta: 0 }] },
  { msgs: ['有一单{type}，客户指定要，你那边有吗？', '急单！{type}溢价收！', '客户要{type}，有货赶紧联系。'], type: 'order', typeVals: ['冰种观音', '玻璃种手镯', '帝王绿戒面', '高冰挂件'], opts: [{ text: '有，明天带', actionType: 'TEXT', affinityDelta: 3 }, { text: '暂时没有', actionType: 'TEXT', affinityDelta: 0 }] },
  { msgs: ['节日快乐！发个红包~', '恭喜发财，红包拿来！', '小小心意，收下吧~'], type: 'redpacket', amount: [500, 1500], opts: [{ text: '领取红包', actionType: 'OPEN_REDPACKET', affinityDelta: 1 }] },
  { msgs: ['转账{amount}给你了，查收。', '刚转了{amount}，谢了。'], type: 'transfer_in', amount: [2000, 5000, 10000], opts: [{ text: '收到了', actionType: 'TEXT', affinityDelta: 1 }] },
  { msgs: ['最近手气怎么样？', '切了几块？有涨吗？', '赌石有风险，悠着点。'], type: 'chat', opts: [{ text: '还行', actionType: 'TEXT', affinityDelta: 0 }, { text: '切涨了', actionType: 'TEXT', affinityDelta: 1 }] },
  { msgs: ['你那块料切了吗？', '上次那块冰种出手没？', '有好货记得叫我。'], type: 'follow', opts: [{ text: '切了，还行', actionType: 'TEXT', affinityDelta: 1 }, { text: '还没', actionType: 'TEXT', affinityDelta: 0 }] },
  { msgs: ['介绍个客户给你，靠谱的。', '我朋友想买翡翠，推你微信了。', '有个大单，要不要接？'], type: 'intro', opts: [{ text: '谢了！', actionType: 'TEXT', affinityDelta: 2 }, { text: '改天聊', actionType: 'TEXT', affinityDelta: 0 }] },
  { msgs: ['上次那批货客户很满意！', '你送的料品质不错。', '合作愉快，下次再来。'], type: 'praise', opts: [{ text: '应该的', actionType: 'TEXT', affinityDelta: 1 }, { text: '多谢认可', actionType: 'TEXT', affinityDelta: 2 }] },
  { msgs: ['能便宜点吗？老主顾了。', '价格能不能再谈谈？', '量大从优，给个折扣？'], type: 'bargain', opts: [{ text: '好吧，九折', actionType: 'TEXT', affinityDelta: 2 }, { text: '已经是最低价了', actionType: 'TEXT', affinityDelta: -1 }] },
]

function buildPhoneMsgExpanded() {
  const pool = []
  let id = 1
  for (let i = 0; i < 200; i++) {
    const tpl = MSG_TEMPLATES[i % MSG_TEMPLATES.length]
    const npcId = pick(PHONE_NPC_IDS)
    let msg = pick(tpl.msgs)
    if (msg.includes('{amount}')) {
      const amt = Array.isArray(tpl.amount) ? rndInt(tpl.amount[0], tpl.amount[tpl.amount.length - 1]) : (tpl.amount || 5000)
      msg = msg.replace(/\{amount\}/g, amt.toLocaleString())
    }
    let orderTypeVal = null
    if (msg.includes('{type}')) {
      orderTypeVal = pick(tpl.typeVals || ['冰种观音'])
      msg = msg.replace(/\{type\}/g, orderTypeVal)
    }

    const options = (tpl.opts || []).map(o => {
      const opt = { ...o, nextId: null, reply: o.text === '借给你' ? '已转' : o.text === '领取红包' ? '谢谢！' : o.text }
      if (o.actionType === 'PAY_MONEY' && msg.match(/借我(\d[\d,]*)/)) {
        const m = msg.match(/借我(\d[\d,]*)/)
        opt.amount = m ? parseInt(m[1].replace(/,/g, ''), 10) : 5000
        opt.nextId = id === 1 ? 'borrow_ok' : null
      }
      if (o.actionType === 'OPEN_REDPACKET') opt.reply = '谢谢！'
      return opt
    })

    const amountMatch = msg.match(/(\d[\d,]+)/)
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0
    if (tpl.type === 'borrow' && options.some(o => o.text === '借给你')) {
      const idx = options.findIndex(o => o.text === '借给你')
      if (idx >= 0) {
        options[idx].actionType = 'PAY_MONEY'
        options[idx].amount = amount || 5000
        options[idx].nextId = 'borrow_ok'
        options[idx].reply = '已转'
      }
    }
    const baseEntry = { id: `msg_${id++}`, npcId, type: tpl.type, msg }
    if (tpl.type === 'order' && orderTypeVal) baseEntry.orderTypeVal = orderTypeVal
    if (tpl.type === 'redpacket') {
      pool.push({
        ...baseEntry,
        bubbleType: 'redpacket',
        redpacketAmount: tpl.amount || [500, 2000],
        options: options.map(o => ({ ...o, actionType: o.actionType || 'TEXT', affinityDelta: o.affinityDelta ?? 0, nextId: null, reply: o.reply || o.text })),
      })
    } else {
      const opts = options.map(o => {
        const o2 = { ...o, actionType: o.actionType || 'TEXT', affinityDelta: o.affinityDelta ?? 0, nextId: null, reply: o.reply || o.text }
        if (tpl.type === 'order' && (o.text === '有，明天带' || o.text === '有,明天带来')) o2.requiresOrderItem = true
        return o2
      })
      pool.push({ ...baseEntry, options: opts })
    }
  }
  pool.push({
    id: 'borrow_ok',
    npcId: 'lao_wang',
    msg: '太感谢了！三天后一定还！',
    options: [{ text: '[结束]', actionType: 'TEXT', affinityDelta: 0, nextId: null, reply: '' }],
  })
  return pool
}

export { buildPhoneMsgExpanded, PHONE_NPC_IDS }
