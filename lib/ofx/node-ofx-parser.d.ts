/**
 * Type definitions for node-ofx-parser
 * Package: node-ofx-parser (v0.5.1)
 * 
 * This package doesn't include TypeScript definitions,
 * so we provide minimal types for our usage.
 */

declare module "node-ofx-parser" {
    /**
     * Parse OFX string content
     * @param ofxContent - Raw OFX file content as string
     * @returns Parsed OFX data structure
     */
    export function parse(ofxContent: string): any;

    /**
     * Serialize OFX object to string
     * @param ofxObject - OFX data object
     * @returns OFX string content
     */
    export function serialize(ofxObject: any): string;
}
