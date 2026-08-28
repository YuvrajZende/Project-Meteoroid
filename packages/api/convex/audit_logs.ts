import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
    args: {
        userId: v.optional(v.string()),
        action: v.string(),
        resourceType: v.optional(v.string()),
        resourceId: v.optional(v.string()),
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        metadata: v.optional(v.any()),
        success: v.optional(v.boolean()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("audit_logs", {
            ...args,
            created_at: new Date().toISOString(),
        });
    },
});

export const listByUser = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("audit_logs")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(100);
    },
});

export const listByResource = query({
    args: { resourceType: v.string(), resourceId: v.string() },
    handler: async (ctx, args) => {
        // Since we don't have a specific index for resourceType+resourceId,
        // we might need to rely on full scan or add an index.
        // For now, let's assume we might filtering in memory or just filter by one?
        // Wait, schema.ts did NOT define an index for resource.
        // I should stick to just filtering for now or add index later.
        // Given constraints, I'll filter.
        return await ctx.db
            .query("audit_logs")
            .filter(q => q.and(
                q.eq(q.field("resourceType"), args.resourceType),
                q.eq(q.field("resourceId"), args.resourceId)
            ))
            .order("desc")
            .take(100);
    }
});

export const listSecurityEvents = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const securityActions = [
            'user.login',
            'user.logout',
            'api_key.create',
            'api_key.revoke',
            'admin.action',
        ];

        // This is inefficient without specific index, but okay for limited scale.
        return await ctx.db
            .query("audit_logs")
            .filter(q =>
                q.or(
                    q.eq(q.field("action"), 'user.login'),
                    q.eq(q.field("action"), 'user.logout'),
                    q.eq(q.field("action"), 'api_key.create'),
                    q.eq(q.field("action"), 'api_key.revoke'),
                    q.eq(q.field("action"), 'admin.action')
                )
            )
            .order("desc")
            .take(args.limit || 100);
    }
});
