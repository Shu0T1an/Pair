/**
 * 在线获取模型ID的工具函数
 */

export interface ModelInfo {
  id: string
  name?: string
  description?: string
}

export interface FetchModelsResult {
  success: boolean
  models?: ModelInfo[]
  error?: string
}

/**
 * 从 OpenAI Compatible API 获取模型列表
 */
async function fetchOpenAIModels(baseUrl: string, apiKey: string): Promise<FetchModelsResult> {
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/models`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `API 请求失败 (${response.status}): ${errorText}`,
      }
    }

    const data = await response.json()
    
    // OpenAI 格式: { data: [{ id: "model-id", ... }] }
    if (data.data && Array.isArray(data.data)) {
      const models: ModelInfo[] = data.data.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: model.owned_by ? `所有者: ${model.owned_by}` : undefined,
      }))
      return { success: true, models }
    }

    // 某些兼容 API 可能返回数组格式
    if (Array.isArray(data)) {
      const models: ModelInfo[] = data.map((model: any) => ({
        id: typeof model === 'string' ? model : model.id || model.name,
        name: typeof model === 'string' ? model : model.id || model.name,
      }))
      return { success: true, models }
    }

    return {
      success: false,
      error: '无法解析模型列表响应格式',
    }
  } catch (error) {
    return {
      success: false,
      error: `网络错误: ${error instanceof Error ? error.message : '未知错误'}`,
    }
  }
}

/**
 * 从 Anthropic API 获取模型列表
 * 注意: Anthropic 没有公开的模型列表 API，返回常用模型
 */
async function fetchAnthropicModels(): Promise<FetchModelsResult> {
  // Anthropic 没有公开的模型列表 API，返回已知的常用模型
  const knownModels: ModelInfo[] = [
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强大的模型，适合复杂任务' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: '平衡性能和速度' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '最快速的模型，适合简单任务' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '最新模型，性能更强' },
    { id: 'claude-2.1', name: 'Claude 2.1', description: 'Claude 2 系列' },
    { id: 'claude-2.0', name: 'Claude 2.0', description: 'Claude 2 系列' },
    { id: 'claude-instant-1.2', name: 'Claude Instant 1.2', description: '快速响应模型' },
  ]
  
  return {
    success: true,
    models: knownModels,
  }
}

/**
 * 从 Google AI API 获取模型列表
 */
async function fetchGoogleAIModels(apiKey: string): Promise<FetchModelsResult> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `API 请求失败 (${response.status}): ${errorText}`,
      }
    }

    const data = await response.json()
    
    if (data.models && Array.isArray(data.models)) {
      const models: ModelInfo[] = data.models.map((model: any) => ({
        id: model.name?.replace('models/', '') || '',
        name: model.displayName || model.name?.replace('models/', '') || '',
        description: model.description,
      }))
      return { success: true, models }
    }

    return {
      success: false,
      error: '无法解析模型列表响应格式',
    }
  } catch (error) {
    return {
      success: false,
      error: `网络错误: ${error instanceof Error ? error.message : '未知错误'}`,
    }
  }
}

/**
 * 根据 API 类型获取模型列表
 */
export async function fetchModels(
  apiType: string,
  baseUrl: string,
  apiKey: string
): Promise<FetchModelsResult> {
  switch (apiType) {
    case 'openai-completions':
      return fetchOpenAIModels(baseUrl, apiKey)
    
    case 'anthropic-messages':
      return fetchAnthropicModels()
    
    case 'google-generative-ai':
      return fetchGoogleAIModels(apiKey)
    
    default:
      return {
        success: false,
        error: `不支持的 API 类型: ${apiType}`,
      }
  }
}