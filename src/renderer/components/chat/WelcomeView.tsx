import { useState, useEffect } from 'react'
import { 
  Code2, 
  FileText, 
  Lightbulb, 
  Sparkles, 
  MessageSquare, 
  Zap,
  BookOpen,
  Palette
} from 'lucide-react'
import { cn } from '@/renderer/lib/utils'

// 获取动态问候语
function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours()
  
  if (hour < 6) {
    return { text: '夜深了，还在忙碌吗？', emoji: '🌙' }
  } else if (hour < 9) {
    return { text: '早上好，新的一天开始了', emoji: '🌅' }
  } else if (hour < 12) {
    return { text: '上午好，今天想做点什么？', emoji: '☀️' }
  } else if (hour < 14) {
    return { text: '中午好，休息片刻再继续', emoji: '🍱' }
  } else if (hour < 18) {
    return { text: '下午好，有什么可以帮你的？', emoji: '🌤️' }
  } else if (hour < 22) {
    return { text: '晚上好，期待为你服务', emoji: '🌆' }
  } else {
    return { text: '夜深了，注意休息哦', emoji: '✨' }
  }
}

// 功能推荐卡片
const featureCards = [
  {
    icon: Code2,
    title: '代码助手',
    description: '编写、调试、优化代码',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    prompt: '帮我写一个 React 自定义 Hook'
  },
  {
    icon: FileText,
    title: '文档润色',
    description: '优化文案、翻译、总结',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    prompt: '帮我润色这段文字，使其更专业'
  },
  {
    icon: Lightbulb,
    title: '创意写作',
    description: '头脑风暴、创意构思',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    prompt: '给我一些产品命名的创意建议'
  },
  {
    icon: BookOpen,
    title: '知识问答',
    description: '解答问题、解释概念',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    prompt: '解释一下什么是微服务架构'
  }
]

// 能力说明
const capabilities = [
  { icon: Zap, text: '多模型切换，灵活选择' },
  { icon: MessageSquare, text: '上下文记忆，连续对话' },
  { icon: Sparkles, text: '流式输出，实时响应' },
  { icon: Palette, text: '多种主题，个性定制' }
]

interface WelcomeViewProps {
  onSendMessage?: (text: string) => void
}

export function WelcomeView({ onSendMessage }: WelcomeViewProps) {
  const [greeting, setGreeting] = useState(getGreeting())
  
  // 每分钟更新问候语
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting())
    }, 60000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* 欢迎语 */}
        <div className="text-center space-y-3">
          <div className="text-4xl">{greeting.emoji}</div>
          <h1 className="text-2xl font-semibold text-foreground">
            {greeting.text}
          </h1>
          <p className="text-muted-foreground">
            我是 Pair，你的 AI 编程助手，可以帮你处理各种任务
          </p>
        </div>
        
        {/* 功能推荐卡片 */}
        <div className="grid grid-cols-2 gap-3">
          {featureCards.map((card) => (
            <button
              key={card.title}
              onClick={() => onSendMessage?.(card.prompt)}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border border-border",
                "bg-background hover:bg-accent/50 transition-all duration-200",
                "text-left group cursor-pointer",
                "hover:shadow-md hover:border-primary/20"
              )}
            >
              <div className={cn("p-2 rounded-lg", card.bgColor)}>
                <card.icon size={20} className={card.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm group-hover:text-primary transition-colors">
                  {card.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {card.description}
                </div>
              </div>
            </button>
          ))}
        </div>
        
        {/* 能力说明 */}
        <div className="flex flex-wrap justify-center gap-4 pt-2">
          {capabilities.map((cap) => (
            <div 
              key={cap.text}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <cap.icon size={14} className="text-primary/60" />
              <span>{cap.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
