import { useState, useCallback, useEffect, useRef } from 'react'
import { SHOP_NPC_POOL, SHOP_LEVELS, SHOP_GRADE_COLORS } from './shopNpcPool'

function rnd(min, max) { return min + Math.random() * (max - min) }
function rndInt(min, max) { return Math.floor(min + Math.random() * (max - min + 1)) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// 获取商品估值：石头或饰品
function getItemCutValue(item, cutValueMult = 1) {
  if (item.type === 'stone') {
    const s = item.raw
    const r = s.cutResult
    const polishBoost = s.polished?.qualityBoost ?? 1
    return Math.round(s.price * r.multiplier * cutValueMult * polishBoost)
  }
  return item.raw.value ?? item.raw.baseValue ?? 0
}

// 生成访客实例（带随机 budget）
function spawnVisitor(npcrec, shopLv) {
  const [lo, hi] = Array.isArray(npcrec.budget) ? npcrec.budget : [npcrec.budget || 10, npcrec.budget || 50]
  const budgetWan = lo + Math.random() * (hi - lo)
  const budgetYuan = Math.round(budgetWan * 10000)
  return {
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...npcrec,
    budget: budgetYuan,
    x: rnd(15, 75),
    y: rnd(20, 70),
    dx: rnd(-0.8, 0.8),
    bubble: null,
    bubbleAt: 0,
    targetShelfIdx: null,
    targetShelfAt: null,
    leaving: false,
    lastRoamBubbleAt: 0,
  }
}

export default function ShopPanel({
  shopLevel,
  setShopLevel,
  shopShelves,
  setShopShelves,
  inventory,
  jadeAccessories,
  setInventory,
  setJadeAccessories,
  money,
  setMoney,
  cutValueMult,
  onClose,
  addToast,
  visitorsToday,
  setVisitorsToday,
  dailyVisitorLimit,
  relicShopSet = false,
  relicCrookSet = false,
}) {
  const lvCfg = SHOP_LEVELS[shopLevel - 1] || SHOP_LEVELS[0]
  const shelfCount = lvCfg.shelfCount
  const [visitors, setVisitors] = useState([])
  const [listingTarget, setListingTarget] = useState(null) // { type:'stone'|'accessory', raw }
  const [bargainModal, setBargainModal] = useState(null)   // { visitor, shelfIdx, offerPrice, item }
  const tickRef = useRef(0)
  const visitorIdRef = useRef(0)

  const eligibleNpcs = SHOP_NPC_POOL.filter(n => n.minShopLv <= shopLevel && (n.budget[0] > 0 || n.budget[1] > 0))

  // 打开商铺时立即来一批 NPC（每次打开必有新客流，超出当日额度时仍生成）
  useEffect(() => {
    const remain = Math.max(0, dailyVisitorLimit - visitorsToday)
    const batch = remain > 0 ? Math.min(3, remain) : 3  // 额度用完时仍来 3 人作为开门客流
    const newList = []
    for (let i = 0; i < batch; i++) {
      const npc = pick(eligibleNpcs)
      if (npc && (npc.budget[0] > 0 || npc.budget[1] > 0)) newList.push(spawnVisitor(npc, shopLevel))
    }
    if (newList.length) {
      setVisitors(v => [...v, ...newList])
      setVisitorsToday(n => n + newList.length)  // 实际客流数，与当前 NPC 数量一致
    }
  }, []) // 每次打开商铺时执行

  // 从背包/工作台上架
  const handleList = useCallback((type, raw) => {
    setListingTarget({ type, raw })
  }, [])

  const handleConfirmList = useCallback((sellPrice) => {
    if (!listingTarget || shopShelves.length >= shelfCount) return
    const cutVal = getItemCutValue(listingTarget, cutValueMult)
    const entry = {
      type: listingTarget.type,
      raw: listingTarget.raw,
      cutValue: cutVal,
      sellPrice: Math.max(0, Math.round(Number(sellPrice) || cutVal)),
    }
    setShopShelves(s => [...s, entry])
    if (listingTarget.type === 'stone') {
      setInventory(inv => inv.filter(x => x.id !== listingTarget.raw.id))
    } else {
      setJadeAccessories(a => a.filter(x => x.id !== listingTarget.raw.id))
    }
    setListingTarget(null)
  }, [listingTarget, shopShelves.length, shelfCount, cutValueMult, setShopShelves, setInventory, setJadeAccessories])

  const handleUnlist = useCallback((idx) => {
    const ent = shopShelves[idx]
    if (!ent) return
    if (ent.type === 'blind_box') { setShopShelves(s => s.filter((_, i) => i !== idx)); return }
    if (ent.type === 'stone') setInventory(inv => [...inv, ent.raw])
    else setJadeAccessories(a => [...a, ent.raw])
    setShopShelves(s => s.filter((_, i) => i !== idx))
  }, [shopShelves, setShopShelves, setInventory, setJadeAccessories])

  // 定时刷访客
  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current++
      setVisitors(v => {
        const next = v.filter(x => !x.leaving)
        if (next.length < 4 && visitorsToday < dailyVisitorLimit) {
          const npc = pick(eligibleNpcs)
          if (npc && (npc.budget[0] > 0 || npc.budget[1] > 0)) {
            setVisitorsToday(n => n + 1)
            const nv = spawnVisitor(npc, shopLevel)
            return [...next, nv]
          }
        }
        return next
      })
    }, 1800)
    return () => clearInterval(iv)
  }, [shopLevel, dailyVisitorLimit, visitorsToday, eligibleNpcs.length])

  // 访客移动 + 购买逻辑
  useEffect(() => {
    const iv = setInterval(() => {
      setVisitors(v => {
        return v.map(visitor => {
          if (visitor.leaving) {
            if (visitor.bubbleAt > 0 && Date.now() - visitor.bubbleAt > 2500) {
              return null
            }
            return visitor
          }
          let { x, y, dx, targetShelfIdx, phrases, lastRoamBubbleAt } = visitor
          x += dx * 0.6
          if (x < 10 || x > 85) dx = -dx
          x = Math.max(5, Math.min(90, x))
          const next = { ...visitor, x, y, dx }
          if (targetShelfIdx == null && shopShelves.length > 0 && Math.random() < 0.015) {
            next.targetShelfIdx = Math.floor(Math.random() * shopShelves.length)
            next.targetShelfAt = Date.now()
          }
          // 逛时自动显示个性化气泡（每3~5秒一句）
          const now = Date.now()
          if (!next.bubble && next.phrases?.length && now - (lastRoamBubbleAt || 0) > 3200 + Math.random() * 2000) {
            next.bubble = next.phrases[Math.floor(Math.random() * next.phrases.length)]
            next.bubbleAt = now
            next.lastRoamBubbleAt = now
          } else if (next.bubble && next.bubbleAt && now - next.bubbleAt > 2200 && !next.leaving) {
            next.bubble = null
          }
          return next
        }).filter(Boolean)
      })
    }, 80)
    return () => clearInterval(iv)
  }, [shopShelves.length])

  // NPC 购买判定
  const tryPurchase = useCallback((visitor, shelfIdx) => {
    const ent = shopShelves[shelfIdx]
    if (!ent) return
    const cutVal = ent.cutValue
    const sellPrice = ent.sellPrice
    const k = visitor.knowledge

    // 福袋盲盒：小白/游客会盲目按标价购买
    if (ent.type === 'blind_box') {
      if (sellPrice > visitor.budget) return { action: 'leave', bubble: '买不起...' }
      if (k < 0.3 && Math.random() < 0.7) return { action: 'buy', price: sellPrice }
      if (k < 0.5 && Math.random() < 0.3) return { action: 'buy', price: sellPrice }
      return { action: 'leave', bubble: '这盲盒靠谱吗...' }
    }

    if (sellPrice > visitor.budget) {
      return { action: 'leave', bubble: '买不起...' }
    }

    // 行家 knowledge > 0.8
    if (k > 0.8) {
      if (sellPrice > cutVal * 1.2) {
        if (relicShopSet && Math.random() < 0.2) {
          return { action: 'buy', price: sellPrice }
        }
        return { action: 'leave', bubble: '想拿我当猪宰？' }
      }
      if (sellPrice <= cutVal) {
        return { action: 'buy', price: sellPrice }
      }
      return { action: 'bargain', offerPrice: Math.round(cutVal * 1.05) }
    }

    // 小白 knowledge < 0.3（奸商流3件套：溢价容忍×2，最高约6倍）
    if (k < 0.3) {
      const maxOverpay = relicCrookSet ? 6 : 3
      if (sellPrice > cutVal * maxOverpay) {
        return { action: 'leave', bubble: '太贵了吧...' }
      }
      if (Math.random() < 0.4) {
        return { action: 'buy', price: sellPrice }
      }
      const offer = Math.round(sellPrice * 0.8)
      return { action: 'bargain', offerPrice: Math.min(offer, visitor.budget) }
    }

    // 市民 0.3 ~ 0.8
    if (sellPrice > cutVal * 1.5) {
      const offer = Math.round(sellPrice * rnd(0.7, 0.9))
      return { action: 'bargain', offerPrice: Math.min(offer, visitor.budget) }
    }
    return { action: 'buy', price: sellPrice }
  }, [shopShelves, relicShopSet, relicCrookSet])

  const completePurchase = useCallback((visitorId, shelfIdx, price) => {
    const ent = shopShelves[shelfIdx]
    if (!ent) return
    setMoney(m => m + price)
    addToast(`💰 ${ent.raw.name || ent.raw.cutResult?.name || '商品'} 售出 ¥${price.toLocaleString()}`)
    setShopShelves(s => s.filter((_, i) => i !== shelfIdx))
    setVisitors(v => v.map(x => x.id === visitorId ? { ...x, bubble: '老板，这件我要了！', bubbleAt: Date.now(), leaving: true } : x))
  }, [shopShelves, setMoney, addToast, setShopShelves])

  // 当访客走到货架前时触发检查
  const processVisitorAtShelf = useCallback((visitorId, shelfIdx) => {
    const visitor = visitors.find(v => v.id === visitorId)
    if (!visitor || visitor.leaving) return
    const result = tryPurchase(visitor, shelfIdx)
    if (!result) return

    if (result.action === 'leave') {
      setVisitors(v => v.map(x => x.id === visitorId ? { ...x, bubble: result.bubble, bubbleAt: Date.now(), leaving: true } : x))
      return
    }
    if (result.action === 'buy') {
      completePurchase(visitorId, shelfIdx, result.price)
      return
    }
    if (result.action === 'bargain') {
      setBargainModal({ visitor, shelfIdx, offerPrice: result.offerPrice, item: shopShelves[shelfIdx] })
    }
  }, [visitors, tryPurchase, shopShelves, completePurchase])

  // 访客到达货架后自动触发购买判定（2秒后）
  const [pendingCheck, setPendingCheck] = useState(null)
  const processRef = useRef(null)
  processRef.current = processVisitorAtShelf
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now()
      const v = visitors.find(x => x.targetShelfIdx != null && x.targetShelfAt && !x.leaving && now - x.targetShelfAt > 2200)
      if (v) setPendingCheck({ visitorId: v.id, shelfIdx: v.targetShelfIdx })
    }, 400)
    return () => clearInterval(iv)
  }, [visitors])
  useEffect(() => {
    if (!pendingCheck) return
    processRef.current?.(pendingCheck.visitorId, pendingCheck.shelfIdx)
    setPendingCheck(null)
  }, [pendingCheck])

  const handleBargainAccept = useCallback(() => {
    if (!bargainModal) return
    completePurchase(bargainModal.visitor.id, bargainModal.shelfIdx, bargainModal.offerPrice)
    setBargainModal(null)
  }, [bargainModal, completePurchase])

  const handleBargainReject = useCallback(() => {
    if (!bargainModal) return
    setVisitors(v => v.map(x => x.id === bargainModal.visitor.id ? { ...x, bubble: '算了，下次吧', bubbleAt: Date.now(), leaving: true } : x))
    setBargainModal(null)
  }, [bargainModal])

  // 可上架的石头（切开且未售）
  const listableStones = inventory.filter(s => s.cutResult && !s.sold)
  const brickStones = listableStones.filter(s => s.cutResult?.id === 'brick')
  const BLIND_BOX_PRICE = 50000
  const canCreateBlindBox = brickStones.length >= 10 && shopShelves.length < shelfCount

  const handleCreateBlindBox = useCallback(() => {
    if (brickStones.length < 10 || shopShelves.length >= shelfCount) return
    const toConsume = brickStones.slice(0, 10).map(s => s.id)
    setInventory(inv => inv.filter(x => !toConsume.includes(x.id)))
    setShopShelves(s => [...s, {
      type: 'blind_box',
      raw: { name: '翡翠福袋盲盒', emoji: '🎁', id: `blindbox_${Date.now()}` },
      cutValue: BLIND_BOX_PRICE,
      sellPrice: BLIND_BOX_PRICE,
    }])
    addToast('🎁 消耗 10 块砖头料，合成翡翠福袋盲盒上架！')
  }, [brickStones.length, shopShelves.length, shelfCount, setInventory, setShopShelves, addToast])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 900, height: '85vh', background: 'linear-gradient(165deg,#1e293b 0%,#0f172a 100%)',
        borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(71,85,105,.5)',
      }}>
        {/* 标题 */}
        <div style={{ background: 'linear-gradient(90deg,#065f46,#047857)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>🏪 {lvCfg.icon} {lvCfg.name}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {shopLevel < 5 && (() => {
              const nextLv = SHOP_LEVELS[shopLevel]
              const cost = nextLv?.upgradeCost ?? 0
              const canUp = cost > 0 && money >= cost
              return canUp ? (
                <button onClick={() => { setMoney(m => m - cost); setShopLevel(shopLevel + 1); addToast(`✨ 商铺升级至 ${nextLv.name}！`); }} style={{ background: 'rgba(251,191,36,.4)', border: '1px solid rgba(251,191,36,.7)', borderRadius: 8, padding: '6px 12px', color: '#fde68a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  升级 → {nextLv.icon} {nextLv.name} {cost >= 1e8 ? `${(cost/1e8).toFixed(0)}亿` : `${Math.round(cost/1e4)}万`}
                </button>
              ) : cost > 0 ? (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>升级需 {cost >= 1e8 ? `${(cost/1e8).toFixed(0)}亿` : `${Math.round(cost/1e4)}万`}</span>
              ) : null
            })()}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: 'pointer' }}>关闭</button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', gap: 16, padding: 16, overflow: 'hidden', minHeight: 0 }}>
          {/* 左侧：上架与货架 */}
          <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
            <div style={{ background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: 12, border: '1px solid rgba(51,65,85,.6)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>📦 上架商品（{shopShelves.length}/{shelfCount}）</p>
              <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>从背包选择成品，自定义标价</p>
              {canCreateBlindBox && (
                <button onClick={handleCreateBlindBox} style={{ marginBottom: 8, padding: '8px 12px', background: 'linear-gradient(135deg,rgba(251,191,36,.25),rgba(245,158,11,.2))', border: '1px solid rgba(251,191,36,.5)', borderRadius: 8, color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  🎁 10 块砖头料 → 福袋盲盒 ¥50,000
                </button>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto' }}>
                {listableStones.slice(0, 8).map(s => (
                  <button key={s.id} onClick={() => handleList('stone', s)} style={{
                    padding: '6px 10px', background: 'rgba(51,65,85,.6)', border: '1px solid rgba(71,85,105,.8)', borderRadius: 8, color: '#e2e8f0', fontSize: 10, cursor: 'pointer',
                  }}>
                    {s.cutResult?.emoji || '🪨'} {s.cutResult?.name || s.name}
                  </button>
                ))}
                {jadeAccessories.slice(0, 6).map(a => (
                  <button key={a.id} onClick={() => handleList('accessory', a)} style={{
                    padding: '6px 10px', background: 'rgba(51,65,85,.6)', border: '1px solid rgba(71,85,105,.8)', borderRadius: 8, color: '#e2e8f0', fontSize: 10, cursor: 'pointer',
                  }}>
                    {a.emoji || '💎'} {a.name}
                  </button>
                ))}
                {listableStones.length === 0 && jadeAccessories.length === 0 && (
                  <span style={{ fontSize: 11, color: '#64748b' }}>背包暂无成品</span>
                )}
              </div>
            </div>

            <div style={{ flex: 1, background: 'rgba(15,23,42,.8)', borderRadius: 12, padding: 12, overflowY: 'auto', border: '1px solid rgba(51,65,85,.6)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>🏷 已上架</p>
              {shopShelves.map((ent, idx) => {
                const gradeId = ent.type === 'blind_box' ? 'ice' : ent.type === 'stone' ? (ent.raw.cutResult?.id || 'waxy') : (ent.raw.grade || 'ice')
                const colors = SHOP_GRADE_COLORS[gradeId] || SHOP_GRADE_COLORS.ice
                const nameColor = ent.type === 'stone' ? (ent.raw.cutResult?.textColor) : (ent.raw.gradeColor)
                const effectiveNameColor = nameColor || colors.textColor
                return (
                <div key={idx} style={{
                  background: `linear-gradient(135deg,${colors.gradientFrom}22,${colors.gradientTo}18)`,
                  border: `1px solid ${colors.borderColor}66`,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                  <div>
                    <span style={{ fontSize: 12, color: effectiveNameColor, fontWeight: 600 }}>
                      {ent.type === 'blind_box' ? '🎁' : ent.type === 'stone' ? (ent.raw.cutResult?.emoji || '🪨') : (ent.raw.emoji || '💎')} {ent.raw.name || ent.raw.cutResult?.name || '商品'}
                    </span>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: '#94a3b8' }}>
                      估值 ¥{ent.cutValue?.toLocaleString()} · 标价 ¥{ent.sellPrice?.toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => handleUnlist(idx)} style={{ padding: '4px 10px', background: 'rgba(239,68,68,.3)', border: '1px solid rgba(239,68,68,.5)', borderRadius: 6, color: '#fca5a5', fontSize: 10, cursor: 'pointer' }}>下架</button>
                </div>
              )})}
              {shopShelves.length === 0 && <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>暂无上架商品</p>}
            </div>
          </div>

          {/* 右侧：店铺大厅 */}
          <div style={{ flex: 1, background: 'linear-gradient(180deg,rgba(30,41,59,.5),rgba(15,23,42,.7))', borderRadius: 12, border: '1px solid rgba(51,65,85,.6)', position: 'relative', overflow: 'hidden' }}>
            <p style={{ position: 'absolute', top: 8, left: 12, margin: 0, fontSize: 11, color: '#64748b', zIndex: 10 }}>今日客流 {visitorsToday}/{dailyVisitorLimit} · 当前 {visitors.length} 人</p>
            {visitors.map(v => (
              <div
                key={v.id}
                onClick={() => v.targetShelfIdx != null && processVisitorAtShelf(v.id, v.targetShelfIdx)}
                style={{
                  position: 'absolute',
                  left: `${v.x}%`,
                  top: `${v.y}%`,
                  transform: 'translate(-50%,-50%)',
                  zIndex: v.leaving ? 5 : 15,
                  cursor: v.targetShelfIdx != null ? 'pointer' : 'default',
                  transition: 'left 0.08s linear, top 0.08s linear',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: v.type === 'tycoon' ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : v.type === 'expert' ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)' : 'linear-gradient(135deg,#64748b,#475569)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 2px 8px rgba(0,0,0,.4)',
                }}>
                  {v.headIcon || v.emoji || '👤'}
                </div>
                {v.bubble && (
                  <div style={{
                    position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4,
                    padding: '6px 10px', background: 'rgba(15,23,42,.95)', border: '1px solid rgba(71,85,105,.8)', borderRadius: 8, fontSize: 11, color: '#e2e8f0', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
                    animation: 'fadeIn 0.2s ease',
                  }}>
                    {v.bubble}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 上架定价弹窗 */}
        {listingTarget && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setListingTarget(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: 16, padding: 24, minWidth: 280, border: '1px solid rgba(71,85,105,.8)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0', fontWeight: 700 }}>
                {listingTarget.raw.name || listingTarget.raw.cutResult?.name} - 设定售价
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 11, color: '#94a3b8' }}>
                参考估值 ¥{getItemCutValue(listingTarget, cutValueMult).toLocaleString()}
              </p>
              <input
                type="number"
                defaultValue={getItemCutValue(listingTarget, cutValueMult)}
                min={0}
                placeholder="输入标价"
                onKeyDown={e => { if (e.key === 'Enter') handleConfirmList(e.target.value) }}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(71,85,105,.8)', background: 'rgba(15,23,42,.8)', color: '#e2e8f0', fontSize: 14, marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setListingTarget(null)} style={{ padding: '8px 16px', background: 'rgba(71,85,105,.6)', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>取消</button>
                <button onClick={() => { const inp = document.querySelector('input[type=number]'); handleConfirmList(inp?.value || 0); }} style={{ padding: '8px 16px', background: '#059669', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>上架</button>
              </div>
            </div>
          </div>
        )}

        {/* 讨价还价弹窗 */}
        {bargainModal && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={() => setBargainModal(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', borderRadius: 16, padding: 24, minWidth: 300, border: '1px solid rgba(251,191,36,.4)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: '#fde68a' }}>
                {bargainModal.visitor.headIcon || bargainModal.visitor.emoji || '👤'} {bargainModal.visitor.name} 砍价
              </p>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#94a3b8' }}>
                原价 ¥{bargainModal.item.sellPrice?.toLocaleString()} · 出价 ¥{bargainModal.offerPrice?.toLocaleString()}
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={handleBargainReject} style={{ padding: '10px 18px', background: 'rgba(239,68,68,.3)', border: '1px solid rgba(239,68,68,.5)', borderRadius: 10, color: '#fca5a5', fontWeight: 700, cursor: 'pointer' }}>拒绝</button>
                <button onClick={handleBargainAccept} style={{ padding: '10px 18px', background: '#059669', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>同意 ¥{bargainModal.offerPrice?.toLocaleString()}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
