export declare function importImage(sourcePath: string): Promise<{
    original: string;
    thumbnail: string;
    sticker: string | null;
    colors: string[];
}>;
export declare function removeBackground(imagePath: string): Promise<string | null>;
export declare function getTemplatePath(templateId: string): string;
export declare function getTemplateList(): string[];
//# sourceMappingURL=image-service.d.ts.map