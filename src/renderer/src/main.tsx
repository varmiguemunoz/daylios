import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConsultoraApp } from './consultora/ConsultoraApp'
import { VoicePill } from './voice/VoicePill'

/**
 * La misma página sirve tres ventanas: el popover del menubar, la Consultora (`?window=consultora`)
 * y la pastilla de nota de voz (`?window=voice`).
 */
const kind = new URLSearchParams(window.location.search).get('window')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {kind === 'consultora' ? <ConsultoraApp /> : kind === 'voice' ? <VoicePill /> : <App />}
  </StrictMode>
)
