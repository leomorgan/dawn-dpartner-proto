export interface CaptureResult {
    runId: string;
    artifacts: {
        html: string;
        styles: ComputedStyleNode[];
        screenshot: string;
        meta: CaptureMetadata;
    };
}
export interface ComputedStyleNode {
    id: string;
    tag: string;
    bbox: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    styles: {
        color: string;
        backgroundColor: string;
        fontFamily: string;
        fontSize: string;
        lineHeight: string;
        borderRadius: string;
        boxShadow: string;
        margin: string;
        padding: string;
    };
    role?: string;
    className?: string;
    textContent?: string;
}
export interface CaptureMetadata {
    url: string;
    viewport: {
        width: number;
        height: number;
    };
    timestamp: string;
    userAgent: string;
    title: string;
}
export declare function capture(url: string, outputDir?: string): Promise<CaptureResult>;
//# sourceMappingURL=index.d.ts.map