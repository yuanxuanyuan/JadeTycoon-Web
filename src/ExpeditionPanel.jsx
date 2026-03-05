import { useState, useCallback, useRef, useEffect } from 'react'
import { NODE_TYPES, generateExpeditionMap, pickExpeditionEvent, EXPEDITION_EVENTS } from './expeditionData'

function rnd(min, max) { return min + Math.random() * (max - min) }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

export default function ExpeditionPanel({
  daysLeft,
  capital = 300000,
  inventory,
  setInventory,
  money,
  setMoney,
  currentDay,
  tickExpeditionDay,
  onExit,
  addToast,
  generateStone,
  cutValueMult,
  ORIGIN_CONFIG,
  CUT_RESULTS,
}) {
  const [map, setMap] = useState(() => generateExpeditionMap())
  const [currentNode, setCurrentNode] = useState({ row: 0, col: 0 })
  const [visited, setVisited] = useState(new Set())
  const [modal, setModal] = useState(null) // { type, data }
  const [localInventory, setLocalInventory] = useState([...inventory])
  const [localMoney, setLocalMoney] = useState(capital || money)
  const [localDays, setLocalDays] = useState(daysLeft)
  const initialDaysRef = useRef(daysLeft)
  const invRef = useRef(localInventory)
  const moneyRef = useRef(localMoney)
  const hasExitedRef = useRef(false)
  useEffect(() => { invRef.current = localInventory; moneyRef.current = localMoney }, [localInventory, localMoney])
  useEffect(() => {
    if (!hasExitedRef.current && localDays <= 0 && !modal) {
      hasExitedRef.current = true
      addToast('⏰ 远征时间到！即将返回')
      onExit(invRef.current, moneyRef.current, initialDaysRef.current)
    }
  }, [localDays, modal, onExit, addToast])

  const visit = useCallback((node) => {
    const key = `${node.row}_${node.col}`
    if (visited.has(key)) return
    setVisited(s => new Set([...s, key]))
    setCurrentNode({ row: node.row, col: node.col })

    if (node.type === 'boss') {
      setModal({ type: 'boss', node })
      return
    }
    if (node.type === 'stone_stall') {
      const stones = Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => generateStone())
      setModal({ type: 'stone_stall', stones, node })
      return
    }
    if (node.type === 'smuggler_camp') {
      const stones = Array.from({ length: 2 }, () => generateStone())
      const risk = Math.random() < 0.3
      setModal({ type: 'smuggler_camp', stones, risk, node })
      return
    }
    if (node.type === 'random_event') {
      const ev = pick(EXPEDITION_EVENTS)
      const amount = Math.round(localMoney * (ev.effect?.cashLoss || ev.effect?.cashGain || 0.1))
      setModal({ type: 'random_event', event: ev, amount, node })
      return
    }
    if (node.type === 'rest_area') {
      setModal({ type: 'rest_area', node })
      return
    }
  }, [visited, localMoney, generateStone])

  const handleCloseModal = useCallback(() => {
    setModal(null)
    const key = `${currentNode.row}_${currentNode.col}`
    const node = map[currentNode.row]?.[currentNode.col]
    if (node?.type === 'boss') {
      onExit(localInventory, localMoney, initialDaysRef.current - localDays)
      return
    }
    setLocalDays(d => {
      const next = d - 1
      if (next <= 0) {
        setTimeout(() => {
          addToast('⏰ 远征时间到！即将返回')
          onExit(localInventory, localMoney, initialDaysRef.current)
        }, 300)
      }
      return next
    })
  }, [currentNode, map, localInventory, localMoney, onExit, addToast])

  const handleBuyStone = useCallback((stone, price) => {
    if (localMoney < price) return
    setLocalMoney(m => m - price)
    setLocalInventory(inv => [...inv, { ...stone, id: stone.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }])
    addToast(`💰 购入 ${stone.name} ¥${price.toLocaleString()}`)
  }, [localMoney, addToast])

  const handleSmugglerBuy = useCallback((stone, price, risk) => {
    if (localMoney < price) return
    setLocalMoney(m => m - price)
    if (risk && Math.random() < 0.3) {
      addToast('😱 走私客黑吃黑！钱货两空')
      return
    }
    setLocalInventory(inv => [...inv, { ...stone, id: stone.id || `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` }])
    addToast(`🏕️ 走私购入 ${stone.name} ¥${price.toLocaleString()}`)
  }, [localMoney, addToast])

  const handleEventResult = useCallback((ev, choice) => {
    const amt = Math.round(localMoney * (ev.effect?.cashLoss || ev.effect?.cashGain || 0.1))
    if (ev.effect?.cashLoss) setLocalMoney(m => Math.max(0, m - amt))
    if (ev.effect?.cashGain) setLocalMoney(m => m + amt)
    if (ev.effect?.reputation) addToast(`✨ 人品值 +${ev.effect.reputation}`)
    if (ev.effect?.daysLost) setLocalDays(d => Math.max(0, d - ev.effect.daysLost))
    if (ev.effect?.giveLegendary || ev.effect?.giveGlass || ev.effect?.giveIce || ev.effect?.giveImperial || ev.effect?.giveFlower || ev.effect?.giveWaxy || ev.effect?.giveEpic || ev.effect?.giveRare || ev.effect?.giveUncommon) {
      const st = generateStone()
      setLocalInventory(inv => [...inv, st])
      addToast(`🎁 获得 ${st.name}`)
    }
    addToast(ev.type === 'positive' ? `✨ ${ev.name}` : `⚠️ ${ev.name}`)
    setModal(null)
    const daysToLose = 1 + (ev.effect?.daysLost || 0)
    setLocalDays(d => Math.max(0, d - daysToLose))
  }, [localMoney, generateStone, addToast])

  const handleBossWin = useCallback(() => {
    const champStone = generateStone()
    champStone.quality = 'legendary'
    champStone.price = Math.round(champStone.price * 3)
    const newInv = [...localInventory, champStone]
    addToast('👑 标王到手！获得传奇原石')
    setModal(null)
    onExit(newInv, localMoney, initialDaysRef.current)
  }, [generateStone, addToast, localInventory, localMoney, onExit])

  const allNodes = map.flat()
  const isReachable = (node) => {
    const { row, col } = node
    if (row === 0) return visited.has('0_0') ? false : row === currentNode.row && col === currentNode.col
    if (row === currentNode.row + 1) {
      const prevRow = map[currentNode.row]
      if (!prevRow) return false
      const prevCol = currentNode.col
      return col >= Math.max(0, prevCol - 1) && col <= Math.min(prevRow.length - 1, prevCol + 1)
    }
    return visited.has(`${row}_${col}`)
  }

  return (
    <div style={{ padding: 20, minHeight: 400 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#fbbf24', fontSize: 18 }}>🗺️ 寻玉远征</h3>
        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
          <span style={{ color: '#94a3b8' }}>剩余 <strong style={{ color: '#fbbf24' }}>{localDays}</strong> 天</span>
          <span style={{ color: '#94a3b8' }}>资金 ¥<strong style={{ color: '#4ade80' }}>{localMoney.toLocaleString()}</strong></span>
          <span style={{ color: '#94a3b8' }}>原石 <strong>{localInventory.length}</strong> 块</span>
        </div>
      </div>

      {/* 路线图 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
        {map.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
            {row.map((node, ci) => {
              const nt = NODE_TYPES[node.type]
              const key = `${node.row}_${node.col}`
              const reachable = ri === 0 ? (ri === currentNode.row && ci === currentNode.col) : (ri === currentNode.row + 1 && Math.abs(ci - currentNode.col) <= 1) || visited.has(key)
              const isCurrent = ri === currentNode.row && ci === currentNode.col
              return (
                <button
                  key={node.id}
                  onClick={() => reachable && visit(node)}
                  disabled={!reachable}
                  style={{
                    width: 64, height: 64, borderRadius: 12, border: `2px solid ${isCurrent ? '#fbbf24' : reachable ? 'rgba(251,191,36,.5)' : 'rgba(51,65,85,.5)'}`,
                    background: isCurrent ? 'rgba(251,191,36,.2)' : reachable ? 'rgba(30,41,59,.8)' : 'rgba(15,23,42,.6)',
                    fontSize: 28, cursor: reachable ? 'pointer' : 'not-allowed', opacity: reachable ? 1 : 0.4,
                    boxShadow: isCurrent ? '0 0 16px rgba(251,191,36,.4)' : 'none',
                  }}
                >
                  {visited.has(key) ? '✓' : nt?.icon || '?'}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button onClick={() => onExit(localInventory, localMoney, initialDaysRef.current - localDays)} style={{ padding: '8px 20px', background: 'rgba(239,68,68,.3)', border: '1px solid rgba(239,68,68,.5)', borderRadius: 8, color: '#fca5a5', cursor: 'pointer', fontSize: 12 }}>提前结束远征</button>
      </div>

      {/* 节点弹窗 */}
      {modal?.type === 'stone_stall' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={handleCloseModal}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg,#1c1917,#0f172a)', border: '1px solid rgba(251,191,36,.5)', borderRadius: 18, padding: 24, maxWidth: 480, width: '100%' }}>
            <h4 style={{ margin: '0 0 16px', color: '#fbbf24' }}>💎 原石摊</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modal.stones?.map(s => {
                const price = Math.round(s.price * (0.85 + Math.random() * 0.25))
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'rgba(30,41,59,.5)', borderRadius: 10 }}>
                    <span>{s.emoji} {s.name} ¥{s.price?.toLocaleString()}</span>
                    <button onClick={() => { handleBuyStone(s, price); }} disabled={localMoney < price} style={{ padding: '6px 14px', background: localMoney >= price ? 'linear-gradient(135deg,#92400e,#b45309)' : '#334155', border: 'none', borderRadius: 8, color: '#fff', cursor: localMoney >= price ? 'pointer' : 'not-allowed', fontSize: 12 }}>¥{price.toLocaleString()} 购买</button>
                  </div>
                )
              })}
            </div>
            <button onClick={handleCloseModal} style={{ marginTop: 16, width: '100%', padding: 10, background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>离开</button>
          </div>
        </div>
      )}

      {modal?.type === 'smuggler_camp' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={handleCloseModal}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg,#422006,#0f172a)', border: '1px solid rgba(251,191,36,.5)', borderRadius: 18, padding: 24, maxWidth: 480, width: '100%' }}>
            <h4 style={{ margin: '0 0 8px', color: '#fbbf24' }}>🏕️ 走私客营地</h4>
            <p style={{ fontSize: 11, color: '#fcd34d', margin: '0 0 16px' }}>便宜高货，但有 30% 黑吃黑风险</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modal.stones?.map(s => {
                const price = Math.round(s.price * 0.4)
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, background: 'rgba(30,41,59,.5)', borderRadius: 10 }}>
                    <span>{s.emoji} {s.name}</span>
                    <button onClick={() => handleSmugglerBuy(s, price, modal.risk)} disabled={localMoney < price} style={{ padding: '6px 14px', background: localMoney >= price ? '#b45309' : '#334155', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12 }}>¥{price.toLocaleString()} 冒险购买</button>
                  </div>
                )
              })}
            </div>
            <button onClick={handleCloseModal} style={{ marginTop: 16, width: '100%', padding: 10, background: '#334155', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>离开</button>
          </div>
        </div>
      )}

      {modal?.type === 'random_event' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => handleEventResult(modal.event)}>
          <div onClick={e => e.stopPropagation()} style={{ background: modal.event.type === 'positive' ? 'linear-gradient(160deg,#052e16,#0f172a)' : 'linear-gradient(160deg,#422006,#0f172a)', border: `1px solid ${modal.event.type === 'positive' ? 'rgba(34,197,94,.5)' : 'rgba(251,191,36,.5)'}`, borderRadius: 18, padding: 24, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: 48, margin: '0 0 12px' }}>{modal.event.icon}</p>
            <h4 style={{ margin: '0 0 8px', color: modal.event.type === 'positive' ? '#4ade80' : '#fbbf24' }}>{modal.event.name}</h4>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>{modal.event.desc.replace('{amount}', modal.amount?.toLocaleString())}</p>
            <button onClick={() => handleEventResult(modal.event)} style={{ padding: '10px 24px', background: modal.event.type === 'positive' ? '#059669' : '#b45309', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 700 }}>继续</button>
          </div>
        </div>
      )}

      {modal?.type === 'rest_area' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={handleCloseModal}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg,#1c1917,#0f172a)', border: '1px solid rgba(139,92,246,.5)', borderRadius: 18, padding: 24, maxWidth: 400, textAlign: 'center' }}>
            <h4 style={{ margin: '0 0 12px', color: '#a78bfa' }}>🛋️ 休息区 · 流浪雕刻师</h4>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>可现场加工 1 件原石（需返回主界面雕刻师）</p>
            <p style={{ fontSize: 11, color: '#64748b' }}>休息恢复精力，不消耗天数</p>
            <button onClick={handleCloseModal} style={{ marginTop: 16, padding: '10px 24px', background: '#7c3aed', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer' }}>继续前行</button>
          </div>
        </div>
      )}

      {modal?.type === 'boss' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={handleCloseModal}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'linear-gradient(160deg,#422006,#0f172a)', border: '2px solid rgba(251,191,36,.8)', borderRadius: 22, padding: 32, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 0 40px rgba(251,191,36,.2)' }}>
            <p style={{ fontSize: 64, margin: '0 0 16px' }}>👑</p>
            <h3 style={{ margin: '0 0 8px', color: '#fbbf24', fontSize: 22 }}>军阀私人公盘</h3>
            <p style={{ fontSize: 13, color: '#fcd34d', margin: '0 0 20px' }}>赢下标王即可通关远征！参与竞标需至少 ¥500,000</p>
            {localMoney >= 500000 ? (
              <button onClick={handleBossWin} style={{ padding: '14px 32px', background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 12, color: '#1c1917', cursor: 'pointer', fontWeight: 800, fontSize: 16 }}>参与竞标并获胜</button>
            ) : (
              <p style={{ color: '#f87171', fontSize: 12 }}>资金不足，无法竞标</p>
            )}
            <button onClick={() => { setModal(null); onExit(localInventory, localMoney, initialDaysRef.current); }} style={{ marginTop: 8, width: '100%', padding: 10, background: 'rgba(51,65,85,.8)', border: 'none', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>放弃标王，结束远征</button>
          </div>
        </div>
      )}
    </div>
  )
}
