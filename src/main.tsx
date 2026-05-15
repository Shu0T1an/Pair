import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ModelProvider } from './renderer/contexts/ModelContext'
import { MessageSettingsProvider } from './renderer/contexts/MessageSettingsContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModelProvider>
      <MessageSettingsProvider>
        <App />
      </MessageSettingsProvider>
    </ModelProvider>
  </StrictMode>,
)
