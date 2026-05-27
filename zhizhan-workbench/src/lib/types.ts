export interface Stock {
  id: number;
  code: string;
  name: string;
  market: string;
  industry: string;
  watchStatus: "focused" | "observing" | "closed";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialData {
  id: number;
  stockId: number;
  reportDate: string;
  reportType: string;
  revenue: number;
  netProfit: number;
  totalAssets: number;
  totalLiabilities: number;
  operatingCf: number;
  grossMargin: number;
  roe: number;
  debtRatio: number;
  receivables: number;
}

export interface SentimentEvent {
  id: number;
  stockId: number;
  source: string;
  sourceUrl: string;
  title: string;
  content: string;
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  impactScore: number;
  eventClusterId: string;
  publishedAt: string;
  fetchedAt: string;
}

export interface EventCluster {
  id: number;
  clusterId: string;
  title: string;
  stockIds: number[];
  eventType: string;
  severity: "high" | "medium" | "low";
  startTime: string;
  endTime: string;
  summary: string;
}

export interface Report {
  id: number;
  stockId: number;
  reportType: "quick" | "snapshot" | "deep_research";
  title: string;
  contentMarkdown: string;
  dataSnapshot: string;
  modelUsed: string;
  tokensUsed: number;
  createdAt: string;
}

export interface Alert {
  id: number;
  stockId: number;
  alertType: "financial" | "sentiment" | "correlation";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  relatedData: string;
  isRead: boolean;
  dismissed: boolean;
  createdAt: string;
}

export interface AppSettings {
  llmProvider: "deepseek" | "zhipu" | "openai";
  llmApiKey: string;
  llmModel: string;
  dataRefreshInterval: number;
  pythonPort: number;
}
