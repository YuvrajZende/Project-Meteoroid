import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Create audit log
 */
export const create = mutation({
    args: {
        userId: v.optional(v.string()),
        action: v.string(),
        resourceType: v.optional(v.string()),
        resourceId: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        success: v.optional(v.boolean()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = new Date().toISOString();

        const logId = await ctx.db.insert("audit_logs", {
            user_id: args.userId,
            action: args.action,
            resource_type: args.resourceType,
            resource_id: args.resourceId,
            ip_address: args.ipAddress,
            user_agent: args.userAgent,
            success: args.success ?? true,
            error_message: args.errorMessage,
            timestamp: now,
        });

        return logId;
    },
});
