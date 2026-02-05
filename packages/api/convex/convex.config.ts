import { defineApp, defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Application
 * Matches the previous Supabase database structure
 */
export default defineApp({
  schema: defineSchema({
    // Users table
    users: defineTable({
      email: v.string(),
      name: v.optional(v.string()),
      avatar_url: v.optional(v.string()),
      tier: v.optional(v.string()),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
    })
      .index("by_email", ["email"])
      .index("by_tier", ["tier"]),

    // Projects table
    projects: defineTable({
      user_id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      framework: v.optional(v.string()),
      language: v.optional(v.string()),
      status: v.optional(v.string()),
      github_url: v.optional(v.string()),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
    })
      .index("by_user", ["user_id"])
      .index("by_status", ["status"]),

    // Tasks table
    tasks: defineTable({
      project_id: v.string(),
      user_id: v.optional(v.string()),
      prompt: v.string(),
      status: v.optional(v.string()),
      result: v.optional(v.any()),
      error: v.optional(v.string()),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
    })
      .index("by_project", ["project_id"])
      .index("by_user", ["user_id"])
      .index("by_status", ["status"]),

    // Generated files table
    generated_files: defineTable({
      task_id: v.string(),
      project_id: v.optional(v.string()),
      path: v.string(),
      content: v.string(),
      language: v.optional(v.string()),
      created_at: v.optional(v.string()),
    })
      .index("by_task", ["task_id"])
      .index("by_project", ["project_id"]),

    // Connections table (GitHub, Stripe, etc.)
    connections: defineTable({
      user_id: v.string(),
      provider: v.string(),
      credentials: v.optional(v.string()), // Encrypted credentials
      access_token: v.optional(v.string()),
      refresh_token: v.optional(v.string()),
      expires_at: v.optional(v.string()),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
    })
      .index("by_user_provider", ["user_id", "provider"])
      .index("by_user", ["user_id"]),

    // Deployments table
    deployments: defineTable({
      project_id: v.string(),
      user_id: v.optional(v.string()),
      provider: v.string(),
      deployment_id: v.string(),
      url: v.optional(v.string()),
      status: v.string(),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
    })
      .index("by_project", ["project_id"])
      .index("by_user", ["user_id"])
      .index("by_status", ["status"]),

    // Audit logs table
    audit_logs: defineTable({
      user_id: v.optional(v.string()),
      action: v.string(),
      resource_type: v.optional(v.string()),
      resource_id: v.optional(v.string()),
      ip_address: v.optional(v.string()),
      user_agent: v.optional(v.string()),
      success: v.optional(v.boolean()),
      error_message: v.optional(v.string()),
      timestamp: v.optional(v.string()),
    })
      .index("by_user", ["user_id"])
      .index("by_action", ["action"])
      .index("by_timestamp", ["timestamp"]),

    // Learning contexts table
    learning_contexts: defineTable({
      project_id: v.string(),
      context_type: v.optional(v.string()),
      context_data: v.optional(v.any()),
      embeddings: v.optional(v.any()),
      created_at: v.optional(v.string()),
      updated_at: v.optional(v.string()),
    })
      .index("by_project", ["project_id"])
      .index("by_type", ["context_type"]),

    // Benchmarks table
    benchmarks: defineTable({
      project_id: v.optional(v.string()),
      user_id: v.optional(v.string()),
      task_type: v.optional(v.string()),
      model: v.string(),
      prompt_tokens: v.optional(v.number()),
      completion_tokens: v.optional(v.number()),
      total_tokens: v.optional(v.number()),
      cost: v.optional(v.number()),
      duration_ms: v.optional(v.number()),
      quality_score: v.optional(v.number()),
      created_at: v.optional(v.string()),
    })
      .index("by_project", ["project_id"])
      .index("by_user", ["user_id"])
      .index("by_model", ["model"]),

    // Knowledge embeddings table (vector storage for AI semantic search)
    knowledge_embeddings: defineTable({
      content: v.string(),
      embedding: v.optional(v.any()), // Vector stored as array
      metadata: v.optional(v.any()),
      created_at: v.optional(v.string()),
    }),
  }),
});
