import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api.js";
import * as dotenv from "dotenv";

dotenv.config();

let convexClient: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
    if (!convexClient) {
        const url = process.env.CONVEX_URL;
        if (!url) {
            throw new Error("CONVEX_URL environment variable is not set");
        }
        convexClient = new ConvexHttpClient(url);
    }
    return convexClient;
}

export async function closeConvexClient(): Promise<void> {
    if (convexClient) {
        convexClient.clearAuth();
        convexClient = null;
    }
}

// Export api object for easy access
export { api };
