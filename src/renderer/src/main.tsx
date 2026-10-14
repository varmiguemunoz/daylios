import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConsultoraApp } from './consultora/ConsultoraApp'
import { VoicePill } from './voice/VoicePill'
import { loadUiState } from './lib/ui-state'

const kind = new URLSearchParams(window.location.search).get('window')

// El estado de la interfaz se carga antes de pintar: la ventana abre ya como la dejaste.
void loadUiState().finally(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {kind === 'consultora' ? <ConsultoraApp /> : kind === 'voice' ? <VoicePill /> : <App />}
    </StrictMode>
  )
)
