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
