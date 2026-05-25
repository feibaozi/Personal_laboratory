export interface CreateRecordDTO {
    date: string;
    outfitId?: string;
    garmentIds?: string[];
    occasion?: string;
    temperature?: number;
    weatherCondition?: string;
    mood?: string;
    rating?: number;
    photoUrl?: string;
    notes?: string;
}
export declare function getAllRecords(): any[];
export declare function getRecordByDate(date: string): any;
export declare function getRecordsByWeek(startDate: string, endDate: string): any[];
export declare function createRecord(data: CreateRecordDTO): any;
export declare function updateRecord(id: string, patch: Record<string, unknown>): any;
export declare function deleteRecord(id: string): void;
//# sourceMappingURL=daily-record.d.ts.map