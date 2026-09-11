import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.js'
import './stile.css'

createRoot(document.getElementById('radice')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
