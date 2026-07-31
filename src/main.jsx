import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { applyMonthlyTheme } from '@/lib/monthlyTheme'

applyMonthlyTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
