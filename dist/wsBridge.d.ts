import { KioskWSPayload } from "./types.js";
/**
 * Fire a structured payload to the WS bridge.
 * Returns true if the bridge acknowledged within timeout, false otherwise.
 * Never throws — errors surface as { confirmed: false }.
 */
export declare function dispatch(payload: KioskWSPayload): Promise<{
    confirmed: boolean;
    error?: string;
}>;
//# sourceMappingURL=wsBridge.d.ts.map