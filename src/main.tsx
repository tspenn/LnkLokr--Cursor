import React from 'react'
import ReactDOM from 'react-dom/client'
import { localStore } from './lib/localStore'
import { isSupabaseConfigured } from './lib/supabaseConfig'
import { ConfigMissing } from './components/shared/ConfigMissing'
import './index.css'

function renderConfigMissing() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ConfigMissing />
    </React.StrictMode>,
  )
}

localStore.init().catch(console.error).finally(() => {
  if (!isSupabaseConfigured) {
    renderConfigMissing()
    return
  }

  import('./bootstrap').then(({ mountApp }) => mountApp())
})
