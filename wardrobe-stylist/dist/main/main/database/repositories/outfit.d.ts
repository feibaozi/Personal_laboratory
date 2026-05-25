export interface CreateOutfitDTO {
    name: string;
    garments: {
        garmentId: string;
        layer: number;
        position?: {
            x: number;
            y: number;
            width: number;
            height: number;
            zIndex: number;
        };
    }[];
    occasions?: string[];
    seasons?: string[];
    style?: string;
    rating?: number;
    tags?: string[];
}
export declare function getAllOutfits(): any[];
export declare function getOutfit(id: string): any;
export declare function createOutfit(data: CreateOutfitDTO): any;
export declare function updateOutfit(id: string, patch: Record<string, unknown>): any;
export declare function deleteOutfit(id: string): void;
//# sourceMappingURL=outfit.d.ts.map