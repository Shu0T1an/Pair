import { MessageSquare } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import type { MessageQueueStatus } from '@/shared/types'

interface QueueIndicatorProps {
  status: MessageQueueStatus
}

export function QueueIndicator({ status }: QueueIndicatorProps) {
  if (status.totalCount === 0) {
    return null
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-md cursor-help">
            <MessageSquare size={12} />
            <span className="text-xs font-mono">{status.totalCount}</span>
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="w-48">
          <div className="space-y-2">
            <div className="font-medium">消息队列</div>
            <div className="space-y-1 text-sm">
              {status.steeringCount > 0 && (
                <div className="flex justify-between">
                  <span>Steering:</span>
                  <span className="font-mono">{status.steeringCount}</span>
                </div>
              )}
              {status.followUpCount > 0 && (
                <div className="flex justify-between">
                  <span>Follow-up:</span>
                  <span className="font-mono">{status.followUpCount}</span>
                </div>
              )}
            </div>
            
            <div className="text-muted-foreground text-xs">
              Enter: Steering | Alt+Enter: Follow-up
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
