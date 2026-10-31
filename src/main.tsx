import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/sora/latin-400.css'
import '@fontsource/sora/latin-600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Missing root')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register after the first paint. window.load waits on map tiles and fonts, and a
// cache-first worker must not be allowed to hold the document open.
if ('serviceWorker' in navigator) {
  const register = () => {
    const base = import.meta.env.BASE_URL
    void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Private mode can refuse workers. The page still runs from the network.
    })
  }
  window.setTimeout(register, 0)
}
