export interface CreateGarmentDTO {
    name: string;
    imageUrl: string;
    thumbnailUrl: string;
    stickerUrl?: string | null;
    category: string;
    subcategory?: string;
    colors: string[];
    patterns?: string[];
    materials?: string[];
    seasons: string[];
    occasions: string[];
    style?: string;
    fit?: string;
    garmentLength?: string;
    brand?: string;
    purchaseDate?: string;
    price?: number;
    notes?: string;
}
export declare function getAllGarments(): any[];
export declare function getGarment(id: string): any;
export declare function createGarment(data: CreateGarmentDTO): any;
export declare function updateGarment(id: string, patch: Record<string, unknown>): any;
export declare function deleteGarment(id: string): void;
export declare function getGarmentStats(): {
    total: number;
    byCategory: Record<string, number>;
};
//# sourceMappingURL=garment.d.ts.map