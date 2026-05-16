import { useState, useEffect } from 'react'
import { Zap, X, Loader2 } from 'lucide-react'
import { SkillItem } from './skills/SkillItem'
import type { SkillInfo } from '@/shared/types'

interface SkillsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SkillsModal({ isOpen, onClose }: SkillsModalProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadSkills()
    }
  }, [isOpen])

  const loadSkills = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await window.electronAPI.skills.list()
      setSkills(data)
    } catch (err) {
      console.error('加载 skills 失败:', err)
      setError('加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗主体 */}
      <div className="relative w-[700px] h-[500px] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 h-14 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-foreground" />
            <span className="text-sm font-semibold">Skills</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 p-6 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <span className="text-muted-foreground">{error}</span>
              <button
                onClick={loadSkills}
                className="text-sm text-primary hover:underline"
              >
                重试
              </button>
            </div>
          ) : skills.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-muted-foreground">未找到 Skills</span>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map((skill, index) => (
                <SkillItem
                  key={skill.name}
                  name={skill.name}
                  description={skill.description}
                  filePath={skill.filePath}
                  scope={skill.scope}
                  isExpanded={expandedIndex === index}
                  onToggle={() => handleToggle(index)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部统计 */}
        {!isLoading && !error && skills.length > 0 && (
          <div className="px-6 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              共 {skills.length} 个 Skills
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
