import { Database as SqlJsDatabase } from 'sql.js';
export declare function initDatabase(): Promise<void>;
export declare function getDb(): SqlJsDatabase;
export declare function save(): void;
export declare function queryAll(sql: string, params?: any[]): any[];
export declare function queryOne(sql: string, params?: any[]): any | null;
export declare function execute(sql: string, params?: any[]): void;
//# sourceMappingURL=index.d.ts.map