import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    // Users table
    users: defineTable({
        id: v.string(), // Ext mapping to Supabase/Auth ID (UUID)
        email: v.string(),
        name: v.optional(v.string()),
        tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
        api_quota_used: v.number(),
        avatar_url: v.optional(v.string()),
        created_at: v.optional(v.string()), // ISO string
        updated_at: v.optional(v.string()), // ISO string
    })
        .index("by_email", ["email"])
        .index("by_external_id", ["id"]),

    // Projects table
    projects: defineTable({
        userId: v.string(),
        name: v.string(),
        description: v.optional(v.string()),
        config: v.optional(v.any()), // JSONB in Postgres
        status: v.union(
            v.literal("pending"),
            v.literal("generating"),
            v.literal("active"), // Added active based on migration file
            v.literal("completed"),
            v.literal("failed"),
            v.literal("archived") // Added archived based on inferrence
        ),
        framework: v.optional(v.string()),
        language: v.optional(v.string()),
        githubUrl: v.optional(v.string()),
        created_at: v.optional(v.string()),
        updated_at: v.optional(v.string()),
    })
        .index("by_user", ["userId"])
        .index("by_status", ["status"]),

    // Tasks table (Job Queue)
    tasks: defineTable({
        projectId: v.optional(v.id("projects")), // Make optional since some might not link
        userId: v.optional(v.string()),
        prompt: v.string(),
        status: v.union(
            v.literal("queued"),
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        progress: v.number(),
        result: v.optional(v.any()), // JSONB
        error: v.optional(v.string()),
        agents_used: v.optional(v.array(v.string())),
        started_at: v.optional(v.string()),
        completed_at: v.optional(v.string()),
        created_at: v.optional(v.string()),
    })
        .index("by_project", ["projectId"])
        .index("by_user", ["userId"])
        .index("by_status", ["status"]),

    // Generated Files
    generated_files: defineTable({
        taskId: v.id("tasks"),
        projectId: v.optional(v.id("projects")),
        path: v.string(),
        content: v.string(),
        language: v.optional(v.string()),
        created_at: v.optional(v.string()),
    })
        .index("by_task", ["taskId"])
        .index("by_project", ["projectId"]),

    // Audit Logs
    audit_logs: defineTable({
        userId: v.optional(v.string()),
        action: v.string(),
        resourceType: v.optional(v.string()),
        resourceId: v.optional(v.string()), // Can be UUID or ID
        ipAddress: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        metadata: v.optional(v.any()),
        success: v.optional(v.boolean()),
        errorMessage: v.optional(v.string()),
        created_at: v.optional(v.string()),
    })
        .index("by_user", ["userId"])
        .index("by_action", ["action"]),

    // API Keys
    api_keys: defineTable({
        userId: v.string(),
        name: v.string(),
        keyHash: v.string(),
        keyPrefix: v.string(),
        scopes: v.array(v.string()),
        expiresAt: v.optional(v.string()),
        lastUsedAt: v.optional(v.string()),
        created_at: v.optional(v.string()),
    })
        .index("by_user", ["userId"])
        .index("by_key_hash", ["keyHash"]), // For lookup

    // Knowledge Embeddings (Vector Store)
    knowledge_embeddings: defineTable({
        content: v.string(),
        embedding: v.array(v.number()), // Vector
        metadata: v.optional(v.any()),
        created_at: v.optional(v.string()),
    })
        .vectorIndex("by_embedding", {
            vectorField: "embedding",
            dimensions: 1536,
        }),

    // Connections (OAuth)
    connections: defineTable({
        userId: v.string(),
        provider: v.string(),
        credentials: v.optional(v.any()), // Sensitive, handle with care
        accessToken: v.optional(v.string()),
        refreshToken: v.optional(v.string()),
        expiresIn: v.optional(v.number()),
        created_at: v.optional(v.string()),
        updated_at: v.optional(v.string()),
    })
        .index("by_user_provider", ["userId", "provider"]),

    // Deployments
    deployments: defineTable({
        projectId: v.id("projects"),
        userId: v.optional(v.string()),
        provider: v.string(),
        deploymentId: v.string(),
        url: v.optional(v.string()),
        status: v.string(),
        created_at: v.optional(v.string()),
        updated_at: v.optional(v.string()),
    })
        .index("by_project", ["projectId"]),

    // Learning Contexts
    learning_contexts: defineTable({
        projectId: v.id("projects"),
        contextType: v.optional(v.string()),
        contextData: v.optional(v.any()),
        embeddings: v.optional(v.array(v.number())),
        created_at: v.optional(v.string()),
    })
        .index("by_project", ["projectId"]),

    // Benchmarks
    benchmarks: defineTable({
        projectId: v.optional(v.id("projects")),
        userId: v.optional(v.string()),
        taskType: v.optional(v.string()),
        model: v.string(),
        promptTokens: v.optional(v.number()),
        completionTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        cost: v.optional(v.number()),
        durationMs: v.optional(v.number()),
        qualityScore: v.optional(v.number()),
        created_at: v.optional(v.string()),
    })
        .index("by_project", ["projectId"])
        .index("by_model", ["model"]),

    // MFA User Settings
    user_mfa: defineTable({
        userId: v.string(),
        mfa_enabled: v.boolean(),
        totp_secret_encrypted: v.optional(v.string()),
        backup_codes_hashed: v.optional(v.array(v.string())),
        recovery_email: v.optional(v.string()),
        verified_at: v.optional(v.string()),
        created_at: v.optional(v.string()),
        updated_at: v.optional(v.string()),
    })
        .index("by_user", ["userId"]),

    // Code Embeddings (for Learning System)
    code_embeddings: defineTable({
        projectId: v.optional(v.string()),
        filePath: v.string(),
        content: v.string(),
        language: v.string(),
        metadata: v.optional(v.any()), // framework, etc.
        similarity: v.optional(v.number()), // transient usage
        embedding: v.array(v.number()),
        created_at: v.optional(v.string()),
    })
        .vectorIndex("by_embedding", {
            vectorField: "embedding",
            dimensions: 1536,
        })
        .index("by_project", ["projectId"]),

    // Learned Patterns (for Learning System)
    learned_patterns: defineTable({
        pattern: v.optional(v.string()),
        description: v.optional(v.string()),
        pattern_type: v.optional(v.string()), // success, failure, anti-pattern
        category: v.optional(v.string()),
        context: v.optional(v.string()),
        confidence: v.optional(v.number()),
        frequency: v.optional(v.number()),
        created_at: v.optional(v.string()),
    })
        .index("by_type", ["pattern_type"]),

    // Generation Iterations (History for Learning System)
    generation_iterations: defineTable({
        projectId: v.optional(v.string()),
        taskId: v.optional(v.string()),
        prompt: v.string(),
        config: v.optional(v.any()),
        generated_code: v.optional(v.string()),
        success: v.boolean(),
        status: v.optional(v.string()),
        task_description: v.optional(v.string()),
        created_at: v.optional(v.string()),
    })
        .index("by_project", ["projectId"])
        .index("by_success", ["success"]),

});
