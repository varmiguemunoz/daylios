import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ConsultoraApp } from './consultora/ConsultoraApp'

/** La misma página sirve dos ventanas: el popover del menubar y la Consultora (`?window=consultora`). */
const isConsultora = new URLSearchParams(window.location.search).get('window') === 'consultora'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isConsultora ? <ConsultoraApp /> : <App />}</StrictMode>
)
