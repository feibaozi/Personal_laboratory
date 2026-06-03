interface LlmConfig {
  provider: 'openai' | 'ollama' | 'anthropic';
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export class LlmClient {
  private config: LlmConfig;

  constructor(config: LlmConfig) {
    this.config = config;
  }

  async chat(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
    const endpoint = this.getEndpoint(baseUrl);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false,
      }),
    });

    const data = (await res.json()) as any;
    return data.choices?.[0]?.message?.content || '';
  }

  async *chatStream(
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string> {
    const baseUrl = this.config.baseUrl || this.getDefaultBaseUrl();
    const endpoint = this.getEndpoint(baseUrl);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true,
      }),
    });

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {}
        }
      }
    }
  }

  private getDefaultBaseUrl(): string {
    switch (this.config.provider) {
      case 'openai':
        return 'https://api.openai.com';
      case 'ollama':
        return 'http://localhost:11434';
      case 'anthropic':
        return 'https://api.anthropic.com';
    }
  }

  private getEndpoint(baseUrl: string): string {
    switch (this.config.provider) {
      case 'openai':
      case 'ollama':
        return `${baseUrl}/v1/chat/completions`;
      case 'anthropic':
        return `${baseUrl}/v1/messages`;
    }
  }
}