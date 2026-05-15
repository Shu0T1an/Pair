import { ModelProvider } from '@/renderer/contexts/ModelContext'
import { MessageSettingsProvider } from '@/renderer/contexts/MessageSettingsContext'
import { ChatPage } from '@/renderer/pages/ChatPage'

function App() {
  return (
    <ModelProvider>
      <MessageSettingsProvider>
        <ChatPage />
      </MessageSettingsProvider>
    </ModelProvider>
  )
}

export default App
