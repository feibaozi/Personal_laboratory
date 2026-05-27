import { getSetting } from './db';

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export async function chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
  const baseUrl = getSetting('llm_base_url') || 'https://api.deepseek.com';
  const apiKey = getSetting('llm_api_key');
  const model = getSetting('llm_model') || 'deepseek-chat';

  if (!apiKey) {
    throw new Error('API Key 未配置，请先在设置页面配置 DeepSeek API Key');
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      stream: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API 错误 ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function chatStream(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options?: ChatOptions
): Promise<string> {
  const baseUrl = getSetting('llm_base_url') || 'https://api.deepseek.com';
  const apiKey = getSetting('llm_api_key');
  const model = getSetting('llm_model') || 'deepseek-chat';

  if (!apiKey) {
    throw new Error('API Key 未配置，请先在设置页面配置 DeepSeek API Key');
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API 错误 ${response.status}: ${err}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Stream not supported');

  const decoder = new TextDecoder();
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n').filter((l) => l.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          onChunk(content);
        }
      } catch {
        // skip unparseable chunks
      }
    }
  }

  return fullContent;
}

import { pipeline, env, type FeatureExtractionPipeline } from '@xenova/transformers';

// Cache models in the project directory, not node_modules
env.cacheDir = './data/models_cache';
env.remoteHost = 'https://hf-mirror.com';

let extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    ) as FeatureExtractionPipeline;
  }
  return extractor;
}

export async function embedText(text: string): Promise<number[]> {
  try {
    const model = await getExtractor();
    const result = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  } catch (err) {
    console.error('Local embedding failed:', err);
    throw err;
  }
}
