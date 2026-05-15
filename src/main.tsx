import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ModelProvider } from './renderer/contexts/ModelContext'
import { MessageSettingsProvider } from './renderer/contexts/MessageSettingsContext'
import { ThemeProvider } from './renderer/contexts/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ModelProvider>
        <MessageSettingsProvider>
          <App />
        </MessageSettingsProvider>
      </ModelProvider>
    </ThemeProvider>
  </StrictMode>,
)
