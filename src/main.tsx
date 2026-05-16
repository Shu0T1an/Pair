import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ModelProvider } from './renderer/contexts/ModelContext'
import { MessageSettingsProvider } from './renderer/contexts/MessageSettingsContext'
import { ThemeProvider } from './renderer/contexts/ThemeContext'
import { SessionStateProvider } from './renderer/contexts/SessionStateContext'
import { GlobalStreamProvider } from './renderer/contexts/GlobalStreamContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ModelProvider>
        <MessageSettingsProvider>
          <SessionStateProvider>
            <GlobalStreamProvider>
              <App />
            </GlobalStreamProvider>
          </SessionStateProvider>
        </MessageSettingsProvider>
      </ModelProvider>
    </ThemeProvider>
  </StrictMode>,
)
