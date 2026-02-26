import { scan } from 'react-scan' // must be imported before React
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// @ts-expect-error Vite injects import.meta.env at build time
if (import.meta.env.DEV) {
  scan({ enabled: true, showToolbar: true })
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
