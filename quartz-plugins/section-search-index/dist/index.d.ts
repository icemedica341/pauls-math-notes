export default function SectionSearchIndex(opts?: {
    enableSiteMap?: boolean;
    enableRSS?: boolean;
}): {
    name: string;
    emit(ctx: any, content: any, resources: any): Promise<string[]>;
    partialEmit(ctx: any, content: any, resources: any): Promise<string[]>;
};
