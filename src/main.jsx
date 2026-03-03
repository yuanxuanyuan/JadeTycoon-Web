import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(e, info) { console.error('App Error:', e, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:'100vh', background:'#0f172a', color:'#fecaca', padding:24, fontFamily:'monospace' }}>
          <h2 style={{ color:'#f87171' }}>渲染出错</h2>
          <pre style={{ marginTop:12, fontSize:12, overflow:'auto' }}>{this.state.error?.message}</pre>
          <p style={{ marginTop:12, fontSize:11, color:'#94a3b8' }}>请打开开发者工具(F12) → Console 查看完整错误</p>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
