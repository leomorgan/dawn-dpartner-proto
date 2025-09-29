export interface CaptureResult {
    runId: string;
    artifacts: {
        html: string;
        styles: ComputedStyleNode[];
        cssRules: CSSRuleData[];
        buttonHoverStates: ButtonHoverState[];
        screenshot: string;
        meta: CaptureMetadata;
    };
}
export interface CSSRuleData {
    selector: string;
    styles: Record<string, string>;
}
export interface ButtonHoverState {
    selector: string;
    className: string;
    normalStyles: {
        backgroundColor: string;
        color: string;
        opacity: string;
        transform: string;
        borderColor: string;
        boxShadow: string;
        scale: string;
        filter: string;
        transition: string;
        cursor: string;
    };
    hoverStyles: {
        backgroundColor: string;
        color: string;
        opacity: string;
        transform: string;
        borderColor: string;
        boxShadow: string;
        scale: string;
        filter: string;
        transition: string;
        cursor: string;
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
        fontWeight: string;
        lineHeight: string;
        borderRadius: string;
        border: string;
        boxShadow: string;
        margin: string;
        padding: string;
        display: string;
        alignItems: string;
        justifyContent: string;
        textAlign: string;
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
export declare function capture(url: string, outputDir?: string, runId?: string): Promise<CaptureResult>;
//# sourceMappingURL=index.d.ts.map