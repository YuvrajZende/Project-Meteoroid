import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getStatus = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userMfa = await ctx.db
            .query("user_mfa")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();
        return userMfa;
    },
});

export const setup = mutation({
    args: {
        userId: v.string(),
        recoveryEmail: v.string(),
        secretEncrypted: v.string(),
        backupCodesHashed: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("user_mfa")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();

        if (existing) {
            // Update if exists but not enabled? Or error?
            // Logic in service handles check. Use upsert logic here.
            await ctx.db.patch(existing._id, {
                totp_secret_encrypted: args.secretEncrypted,
                backup_codes_hashed: args.backupCodesHashed,
                recovery_email: args.recoveryEmail,
                mfa_enabled: false,
                updated_at: new Date().toISOString(),
            });
        } else {
            await ctx.db.insert("user_mfa", {
                userId: args.userId,
                mfa_enabled: false,
                totp_secret_encrypted: args.secretEncrypted,
                backup_codes_hashed: args.backupCodesHashed,
                recovery_email: args.recoveryEmail,
                created_at: new Date().toISOString(),
            });
        }
    },
});

export const enable = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("user_mfa")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();

        if (!existing) throw new Error("MFA not set up");

        await ctx.db.patch(existing._id, {
            mfa_enabled: true,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
    },
});

export const disable = mutation({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("user_mfa")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();

        if (!existing) return;

        await ctx.db.patch(existing._id, {
            mfa_enabled: false,
            totp_secret_encrypted: undefined,
            backup_codes_hashed: undefined,
            verified_at: undefined,
            updated_at: new Date().toISOString(),
        });
    },
});

export const updateBackupCodes = mutation({
    args: { userId: v.string(), backupCodesHashed: v.array(v.string()) },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("user_mfa")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();

        if (existing) {
            await ctx.db.patch(existing._id, {
                backup_codes_hashed: args.backupCodesHashed,
                updated_at: new Date().toISOString(),
            });
        }
    },
});

// Helper for internal service use to fetch secrets securely
export const getSecretsInternal = query({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        const userMfa = await ctx.db
            .query("user_mfa")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .unique();
        return userMfa;
    },
});
