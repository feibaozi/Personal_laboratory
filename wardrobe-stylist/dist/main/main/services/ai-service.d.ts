export declare function configureAI(config: {
    enabled?: boolean;
    qwenApiKey?: string;
    qwenModel?: string;
    deepseekApiKey?: string;
    deepseekModel?: string;
}): void;
export declare function analyzeGarment(imageBase64: string): Promise<Record<string, unknown> | null>;
export declare function getRecommendations(context: {
    garments: {
        id: string;
        name: string;
        category: string;
        colors: string;
        style: string | null;
        seasons: string;
        occasions: string;
    }[];
    occasion?: string;
    weather?: string;
    styleDescription?: string;
}): Promise<{
    outfits: {
        garmentIds: string[];
        reason: string;
        score: number;
    }[];
    overallTip?: string;
} | null>;
export declare function isAIEnabled(): boolean;
//# sourceMappingURL=ai-service.d.ts.map