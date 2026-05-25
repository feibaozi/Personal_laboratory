export declare function getAllBodyProfiles(): any[];
export declare function getBodyProfile(id: string): any;
export declare function createBodyProfile(data: {
    name: string;
    gender: string;
    height: number;
    weight?: number;
    measurements?: Record<string, number>;
    bodyType?: string;
    templateId: string;
}): any;
export declare function updateBodyProfile(id: string, patch: Record<string, unknown>): any;
export declare function deleteBodyProfile(id: string): void;
//# sourceMappingURL=body-profile.d.ts.map