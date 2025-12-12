/**
 * ============================================
 * ABAC WITH CERBOS TEMPLATES
 * ============================================
 * 
 * Attribute-Based Access Control using Cerbos.
 * Cerbos is an open-source authorization layer that
 * implements scalable, programmable access control.
 * 
 * @see https://cerbos.dev
 */

// ============================================
// CERBOS CLIENT SETUP TEMPLATE
// ============================================

export const CERBOS_CLIENT_TEMPLATE = `/**
 * ============================================
 * CERBOS CLIENT SETUP
 * ============================================
 * 
 * Cerbos client configuration for ABAC authorization.
 * Supports gRPC and HTTP transports.
 */

import { GRPC as Cerbos } from "@cerbos/grpc";
import { HTTP as CerbosHTTP } from "@cerbos/http";

// ============================================
// CONFIGURATION
// ============================================

export interface CerbosConfig {
    /** Cerbos server host */
    host: string;
    /** Cerbos server port */
    port: number;
    /** Use TLS */
    tls: boolean;
    /** Transport type */
    transport: "grpc" | "http";
    /** Playground instance ID (for testing) */
    playgroundInstance?: string;
}

const defaultConfig: CerbosConfig = {
    host: process.env.CERBOS_HOST || "localhost",
    port: parseInt(process.env.CERBOS_PORT || "3593"),
    tls: process.env.CERBOS_TLS === "true",
    transport: (process.env.CERBOS_TRANSPORT as "grpc" | "http") || "grpc",
    playgroundInstance: process.env.CERBOS_PLAYGROUND_INSTANCE,
};

// ============================================
// CERBOS CLIENT SINGLETON
// ============================================

let cerbosClient: Cerbos | CerbosHTTP | null = null;

/**
 * Get or create Cerbos client
 */
export function getCerbosClient(config: CerbosConfig = defaultConfig): Cerbos | CerbosHTTP {
    if (cerbosClient) {
        return cerbosClient;
    }

    const address = \`\${config.host}:\${config.port}\`;

    if (config.transport === "http") {
        cerbosClient = new CerbosHTTP(\`http\${config.tls ? "s" : ""}://\${address}\`, {
            playgroundInstance: config.playgroundInstance,
        });
    } else {
        cerbosClient = new Cerbos(address, {
            tls: config.tls,
            playgroundInstance: config.playgroundInstance,
        });
    }

    console.log(\`[Cerbos] Connected to \${address} via \${config.transport}\`);
    return cerbosClient;
}

// ============================================
// PRINCIPAL (USER) HELPER
// ============================================

export interface CerbosPrincipal {
    id: string;
    roles: string[];
    attributes?: Record<string, unknown>;
}

export interface CerbosResource {
    kind: string;
    id: string;
    attributes?: Record<string, unknown>;
}

/**
 * Build a Cerbos principal from user data
 */
export function buildPrincipal(user: {
    id: string;
    roles?: string[];
    email?: string;
    department?: string;
    [key: string]: unknown;
}): CerbosPrincipal {
    return {
        id: user.id,
        roles: user.roles || ["user"],
        attributes: {
            email: user.email,
            department: user.department,
            ...user,
        },
    };
}

/**
 * Build a Cerbos resource
 */
export function buildResource(
    kind: string,
    id: string,
    attributes?: Record<string, unknown>
): CerbosResource {
    return {
        kind,
        id,
        attributes: attributes || {},
    };
}

// ============================================
// AUTHORIZATION CHECK
// ============================================

/**
 * Check if a principal can perform an action on a resource
 */
export async function checkPermission(
    principal: CerbosPrincipal,
    resource: CerbosResource,
    action: string
): Promise<boolean> {
    const client = getCerbosClient();

    try {
        const result = await client.checkResource({
            principal: {
                id: principal.id,
                roles: principal.roles,
                attr: principal.attributes || {},
            },
            resource: {
                kind: resource.kind,
                id: resource.id,
                attr: resource.attributes || {},
            },
            actions: [action],
        });

        return result.isAllowed(action);
    } catch (error) {
        console.error("[Cerbos] Permission check failed:", error);
        return false;
    }
}

/**
 * Check multiple permissions at once
 */
export async function checkPermissions(
    principal: CerbosPrincipal,
    resource: CerbosResource,
    actions: string[]
): Promise<Map<string, boolean>> {
    const client = getCerbosClient();
    const results = new Map<string, boolean>();

    try {
        const result = await client.checkResource({
            principal: {
                id: principal.id,
                roles: principal.roles,
                attr: principal.attributes || {},
            },
            resource: {
                kind: resource.kind,
                id: resource.id,
                attr: resource.attributes || {},
            },
            actions,
        });

        for (const action of actions) {
            results.set(action, result.isAllowed(action));
        }
    } catch (error) {
        console.error("[Cerbos] Permissions check failed:", error);
        for (const action of actions) {
            results.set(action, false);
        }
    }

    return results;
}

/**
 * Get all allowed actions for a resource
 */
export async function getAllowedActions(
    principal: CerbosPrincipal,
    resource: CerbosResource,
    possibleActions: string[]
): Promise<string[]> {
    const permissions = await checkPermissions(principal, resource, possibleActions);
    return [...permissions.entries()]
        .filter(([, allowed]) => allowed)
        .map(([action]) => action);
}
`;

// ============================================
// CERBOS POLICY YAML TEMPLATE
// ============================================

export const CERBOS_POLICY_TEMPLATE = `/**
 * ============================================
 * CERBOS POLICY YAML TEMPLATES
 * ============================================
 * 
 * Example policy files for Cerbos.
 * Place these in your policies/ directory.
 */

// ============================================
// USER RESOURCE POLICY
// ============================================

export const USER_POLICY_YAML = \`# policies/user.yaml
---
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: "default"
  resource: "user"
  
  rules:
    # Admins can do everything
    - actions: ["*"]
      roles: ["admin"]
      effect: EFFECT_ALLOW
    
    # Users can view their own profile
    - actions: ["read", "update"]
      roles: ["user"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.resource.id == request.principal.id
    
    # Users can view other public profiles
    - actions: ["read"]
      roles: ["user"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.resource.attr.isPublic == true
    
    # Managers can view users in their department
    - actions: ["read"]
      roles: ["manager"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.resource.attr.department == request.principal.attr.department

  schemas:
    principalSchema:
      ref: cerbos:///principal.json
    resourceSchema:
      ref: cerbos:///user.json
\`;

// ============================================
// DOCUMENT RESOURCE POLICY
// ============================================

export const DOCUMENT_POLICY_YAML = \`# policies/document.yaml
---
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: "default"
  resource: "document"
  
  rules:
    # Admins can do everything
    - actions: ["*"]
      roles: ["admin"]
      effect: EFFECT_ALLOW
    
    # Document owners can do everything
    - actions: ["read", "update", "delete", "share"]
      roles: ["user"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.resource.attr.ownerId == request.principal.id
    
    # Users can read documents shared with them
    - actions: ["read"]
      roles: ["user"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.principal.id in request.resource.attr.sharedWith
    
    # Users can read public documents
    - actions: ["read"]
      roles: ["user"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.resource.attr.visibility == "public"
    
    # Editors can update documents they have access to
    - actions: ["update"]
      roles: ["editor"]
      effect: EFFECT_ALLOW
      condition:
        match:
          all:
            of:
              - expr: request.principal.id in request.resource.attr.editors
              - expr: request.resource.attr.status != "locked"
\`;

// ============================================
// PRINCIPAL POLICY (DERIVED ROLES)
// ============================================

export const PRINCIPAL_POLICY_YAML = \`# policies/_principal.yaml
---
apiVersion: api.cerbos.dev/v1
derivedRoles:
  name: common_roles
  definitions:
    # Document owner derived role
    - name: document_owner
      parentRoles: ["user"]
      condition:
        match:
          expr: request.resource.attr.ownerId == request.principal.id
    
    # Document editor derived role
    - name: document_editor
      parentRoles: ["user"]
      condition:
        match:
          expr: request.principal.id in request.resource.attr.editors
    
    # Same department derived role
    - name: same_department
      parentRoles: ["user", "manager"]
      condition:
        match:
          expr: request.resource.attr.department == request.principal.attr.department
    
    # Premium user derived role
    - name: premium_user
      parentRoles: ["user"]
      condition:
        match:
          expr: request.principal.attr.subscriptionTier == "premium"
\`;

// ============================================
// API RESOURCE POLICY
// ============================================

export const API_POLICY_YAML = \`# policies/api.yaml
---
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: "default"
  resource: "api"
  
  rules:
    # Rate limit rules based on tier
    - actions: ["access"]
      roles: ["user"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.principal.attr.apiCallsToday < 100
    
    - actions: ["access"]
      roles: ["premium"]
      effect: EFFECT_ALLOW
      condition:
        match:
          expr: request.principal.attr.apiCallsToday < 10000
    
    # Admin bypass
    - actions: ["access"]
      roles: ["admin"]
      effect: EFFECT_ALLOW
\`;

/**
 * Get all policy templates
 */
export function getPolicyTemplates(): Record<string, string> {
    return {
        user: USER_POLICY_YAML,
        document: DOCUMENT_POLICY_YAML,
        principal: PRINCIPAL_POLICY_YAML,
        api: API_POLICY_YAML,
    };
}

/**
 * Generate policy file content
 */
export function generatePolicyFile(
    resourceName: string,
    actions: string[],
    rules: Array<{
        roles: string[];
        actions: string[];
        condition?: string;
    }>
): string {
    const yaml = \`# policies/\${resourceName}.yaml
---
apiVersion: api.cerbos.dev/v1
resourcePolicy:
  version: "default"
  resource: "\${resourceName}"
  
  rules:
\${rules.map(rule => \`    - actions: [\${rule.actions.map(a => \`"\${a}"\`).join(", ")}]
      roles: [\${rule.roles.map(r => \`"\${r}"\`).join(", ")}]
      effect: EFFECT_ALLOW\${rule.condition ? \`
      condition:
        match:
          expr: \${rule.condition}\` : ""}\`).join("\\n\\n")}
\`;
    return yaml;
}
`;

// ============================================
// CERBOS GUARD MIDDLEWARE TEMPLATE
// ============================================

export const CERBOS_GUARD_TEMPLATE = `/**
 * ============================================
 * CERBOS GUARD MIDDLEWARE
 * ============================================
 * 
 * Express middleware for Cerbos authorization.
 */

import { Request, Response, NextFunction } from "express";
import { getCerbosClient, buildPrincipal, buildResource } from "./cerbos-client";

// ============================================
// TYPES
// ============================================

export interface CerbosGuardOptions {
    /** Resource kind (e.g., "document", "user") */
    resource: string;
    /** Actions to check (e.g., ["read", "update"]) */
    actions: string[];
    /** Function to extract resource ID from request */
    getResourceId?: (req: Request) => string;
    /** Function to extract resource attributes from request */
    getResourceAttrs?: (req: Request) => Record<string, unknown>;
    /** Custom error handler */
    onDenied?: (req: Request, res: Response) => void;
}

// ============================================
// MIDDLEWARE FACTORY
// ============================================

/**
 * Create a Cerbos authorization guard middleware
 * 
 * @example
 * app.get("/documents/:id", 
 *   authenticate,
 *   CerbosGuard({ resource: "document", actions: ["read"] }),
 *   getDocument
 * );
 */
export function CerbosGuard(options: CerbosGuardOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const client = getCerbosClient();

        // Extract user from request (set by auth middleware)
        const user = (req as any).user;
        if (!user) {
            return res.status(401).json({
                error: "Unauthorized",
                message: "Authentication required",
            });
        }

        // Build principal
        const principal = buildPrincipal(user);

        // Get resource ID
        const resourceId = options.getResourceId 
            ? options.getResourceId(req)
            : req.params.id || "unknown";

        // Get resource attributes
        const resourceAttrs = options.getResourceAttrs
            ? options.getResourceAttrs(req)
            : {};

        // Build resource
        const resource = buildResource(options.resource, resourceId, resourceAttrs);

        try {
            // Check permissions
            const result = await client.checkResource({
                principal: {
                    id: principal.id,
                    roles: principal.roles,
                    attr: principal.attributes || {},
                },
                resource: {
                    kind: resource.kind,
                    id: resource.id,
                    attr: resource.attributes || {},
                },
                actions: options.actions,
            });

            // Check if all actions are allowed
            const allAllowed = options.actions.every(action => result.isAllowed(action));

            if (!allAllowed) {
                // Get denied actions for error message
                const deniedActions = options.actions.filter(action => !result.isAllowed(action));
                
                console.warn(\`[Cerbos] Access denied for user \${user.id} on \${options.resource}:\${resourceId} - actions: \${deniedActions.join(", ")}\`);

                if (options.onDenied) {
                    return options.onDenied(req, res);
                }

                return res.status(403).json({
                    error: "Forbidden",
                    message: "You do not have permission to perform this action",
                    resource: options.resource,
                    deniedActions,
                });
            }

            // Attach permissions to request for use in handlers
            (req as any).permissions = {
                resource: options.resource,
                resourceId,
                allowedActions: options.actions,
            };

            next();
        } catch (error) {
            console.error("[Cerbos] Authorization error:", error);
            return res.status(500).json({
                error: "Authorization error",
                message: "Failed to check permissions",
            });
        }
    };
}

/**
 * Create a guard that checks if user can perform ANY of the actions
 */
export function CerbosGuardAny(options: CerbosGuardOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const client = getCerbosClient();
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const principal = buildPrincipal(user);
        const resourceId = options.getResourceId?.(req) || req.params.id || "unknown";
        const resourceAttrs = options.getResourceAttrs?.(req) || {};
        const resource = buildResource(options.resource, resourceId, resourceAttrs);

        try {
            const result = await client.checkResource({
                principal: { id: principal.id, roles: principal.roles, attr: principal.attributes || {} },
                resource: { kind: resource.kind, id: resource.id, attr: resource.attributes || {} },
                actions: options.actions,
            });

            // Check if ANY action is allowed
            const anyAllowed = options.actions.some(action => result.isAllowed(action));

            if (!anyAllowed) {
                return res.status(403).json({
                    error: "Forbidden",
                    message: "You do not have permission to perform this action",
                });
            }

            next();
        } catch (error) {
            console.error("[Cerbos] Authorization error:", error);
            return res.status(500).json({ error: "Authorization error" });
        }
    };
}

/**
 * Middleware to load resource and attach to request before authorization
 */
export function withResource<T>(
    loader: (req: Request) => Promise<T>,
    attachAs: string = "resource"
) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const resource = await loader(req);
            if (!resource) {
                return res.status(404).json({
                    error: "Not found",
                    message: "Resource not found",
                });
            }
            (req as any)[attachAs] = resource;
            next();
        } catch (error) {
            console.error("[withResource] Load error:", error);
            return res.status(500).json({
                error: "Failed to load resource",
            });
        }
    };
}
`;

// ============================================
// PERMISSIONS DECORATOR TEMPLATE
// ============================================

export const PERMISSIONS_DECORATOR_TEMPLATE = `/**
 * ============================================
 * PERMISSIONS DECORATOR
 * ============================================
 * 
 * TypeScript decorators for Cerbos authorization.
 * Use with class-based controllers (NestJS-style).
 */

import "reflect-metadata";
import { Request, Response, NextFunction } from "express";
import { getCerbosClient, buildPrincipal, buildResource } from "./cerbos-client";

// ============================================
// METADATA KEYS
// ============================================

const PERMISSIONS_KEY = Symbol("permissions");
const RESOURCE_KEY = Symbol("resource");

// ============================================
// TYPES
// ============================================

export interface PermissionMetadata {
    actions: string[];
    resource?: string;
    resourceIdParam?: string;
}

// ============================================
// DECORATOR: @Permissions
// ============================================

/**
 * Decorator to specify required permissions for a method
 * 
 * @example
 * class DocumentController {
 *   @Permissions(["read", "update"])
 *   async updateDocument(req, res) { ... }
 * }
 */
export function Permissions(actions: string[], resourceIdParam?: string): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        const metadata: PermissionMetadata = {
            actions,
            resourceIdParam: resourceIdParam || "id",
        };
        Reflect.defineMetadata(PERMISSIONS_KEY, metadata, target, propertyKey);
        return descriptor;
    };
}

/**
 * Decorator to specify the resource type for a class
 * 
 * @example
 * @Resource("document")
 * class DocumentController { ... }
 */
export function Resource(resourceType: string): ClassDecorator {
    return (target) => {
        Reflect.defineMetadata(RESOURCE_KEY, resourceType, target);
    };
}

// ============================================
// GET METADATA HELPERS
// ============================================

/**
 * Get permissions metadata from a method
 */
export function getPermissions(target: any, propertyKey: string | symbol): PermissionMetadata | undefined {
    return Reflect.getMetadata(PERMISSIONS_KEY, target, propertyKey);
}

/**
 * Get resource type from a class
 */
export function getResource(target: any): string | undefined {
    return Reflect.getMetadata(RESOURCE_KEY, target.constructor || target);
}

// ============================================
// AUTHORIZATION WRAPPER
// ============================================

/**
 * Wrap a controller method with authorization
 * 
 * @example
 * const authorizedMethod = authorize(controller, "updateDocument");
 */
export function authorize(
    controller: any,
    methodName: string
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    const method = controller[methodName].bind(controller);
    const permissions = getPermissions(controller, methodName);
    const resource = getResource(controller);

    if (!permissions || !resource) {
        // No permissions defined, just call the method
        return method;
    }

    return async (req: Request, res: Response, next: NextFunction) => {
        const client = getCerbosClient();
        const user = (req as any).user;

        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const principal = buildPrincipal(user);
        const resourceId = req.params[permissions.resourceIdParam || "id"] || "unknown";

        try {
            const result = await client.checkResource({
                principal: { id: principal.id, roles: principal.roles, attr: principal.attributes || {} },
                resource: { kind: resource, id: resourceId, attr: {} },
                actions: permissions.actions,
            });

            const allAllowed = permissions.actions.every(action => result.isAllowed(action));

            if (!allAllowed) {
                return res.status(403).json({
                    error: "Forbidden",
                    message: "Insufficient permissions",
                });
            }

            // Call the original method
            return method(req, res, next);
        } catch (error) {
            console.error("[Authorize] Error:", error);
            return res.status(500).json({ error: "Authorization error" });
        }
    };
}

// ============================================
// ROUTE BUILDER WITH AUTHORIZATION
// ============================================

/**
 * Build authorized routes from a controller class
 * 
 * @example
 * const routes = buildAuthorizedRoutes(new DocumentController());
 */
export function buildAuthorizedRoutes(controller: any) {
    const routes: Array<{
        method: string;
        path: string;
        handler: any;
    }> = [];

    const prototype = Object.getPrototypeOf(controller);
    const methodNames = Object.getOwnPropertyNames(prototype)
        .filter(name => name !== "constructor" && typeof prototype[name] === "function");

    for (const methodName of methodNames) {
        const permissions = getPermissions(prototype, methodName);
        if (permissions) {
            routes.push({
                method: methodName,
                path: \`/\${methodName}\`,
                handler: authorize(controller, methodName),
            });
        }
    }

    return routes;
}
`;

// ============================================
// POLICY VALIDATION HELPERS TEMPLATE
// ============================================

export const POLICY_VALIDATION_TEMPLATE = `/**
 * ============================================
 * CERBOS POLICY VALIDATION HELPERS
 * ============================================
 * 
 * Utilities for validating Cerbos policies.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ============================================
// TYPES
// ============================================

export interface PolicyValidationResult {
    isValid: boolean;
    errors: PolicyError[];
    warnings: PolicyWarning[];
    policies: ParsedPolicy[];
}

export interface PolicyError {
    file: string;
    line?: number;
    message: string;
    severity: "error";
}

export interface PolicyWarning {
    file: string;
    line?: number;
    message: string;
    severity: "warning";
}

export interface ParsedPolicy {
    file: string;
    type: "resourcePolicy" | "principalPolicy" | "derivedRoles" | "exportVariables";
    resource?: string;
    version?: string;
    rulesCount?: number;
}

// ============================================
// POLICY VALIDATION
// ============================================

/**
 * Validate a single policy file
 */
export function validatePolicyFile(filePath: string): PolicyValidationResult {
    const errors: PolicyError[] = [];
    const warnings: PolicyWarning[] = [];
    const policies: ParsedPolicy[] = [];

    try {
        const content = fs.readFileSync(filePath, "utf-8");
        const docs = yaml.loadAll(content);

        for (const doc of docs) {
            if (!doc || typeof doc !== "object") continue;

            const result = validatePolicyDocument(doc as Record<string, unknown>, filePath);
            errors.push(...result.errors);
            warnings.push(...result.warnings);
            if (result.policy) {
                policies.push(result.policy);
            }
        }
    } catch (error) {
        errors.push({
            file: filePath,
            message: \`Failed to parse YAML: \${error instanceof Error ? error.message : "Unknown error"}\`,
            severity: "error",
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        policies,
    };
}

/**
 * Validate all policies in a directory
 */
export function validatePoliciesDirectory(dirPath: string): PolicyValidationResult {
    const allErrors: PolicyError[] = [];
    const allWarnings: PolicyWarning[] = [];
    const allPolicies: ParsedPolicy[] = [];

    const files = fs.readdirSync(dirPath)
        .filter(f => f.endsWith(".yaml") || f.endsWith(".yml"));

    for (const file of files) {
        const filePath = path.join(dirPath, file);
        const result = validatePolicyFile(filePath);
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
        allPolicies.push(...result.policies);
    }

    return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        policies: allPolicies,
    };
}

/**
 * Validate a parsed policy document
 */
function validatePolicyDocument(
    doc: Record<string, unknown>,
    filePath: string
): { errors: PolicyError[]; warnings: PolicyWarning[]; policy: ParsedPolicy | null } {
    const errors: PolicyError[] = [];
    const warnings: PolicyWarning[] = [];
    let policy: ParsedPolicy | null = null;

    // Check API version
    const apiVersion = doc.apiVersion as string;
    if (!apiVersion) {
        errors.push({
            file: filePath,
            message: "Missing required field: apiVersion",
            severity: "error",
        });
    } else if (!apiVersion.startsWith("api.cerbos.dev/")) {
        warnings.push({
            file: filePath,
            message: \`Unusual apiVersion: \${apiVersion}\`,
            severity: "warning",
        });
    }

    // Determine policy type
    if (doc.resourcePolicy) {
        policy = validateResourcePolicy(doc.resourcePolicy as Record<string, unknown>, filePath, errors, warnings);
    } else if (doc.principalPolicy) {
        policy = validatePrincipalPolicy(doc.principalPolicy as Record<string, unknown>, filePath, errors, warnings);
    } else if (doc.derivedRoles) {
        policy = validateDerivedRoles(doc.derivedRoles as Record<string, unknown>, filePath, errors, warnings);
    } else {
        errors.push({
            file: filePath,
            message: "Unknown policy type. Expected resourcePolicy, principalPolicy, or derivedRoles",
            severity: "error",
        });
    }

    return { errors, warnings, policy };
}

/**
 * Validate resource policy
 */
function validateResourcePolicy(
    policy: Record<string, unknown>,
    filePath: string,
    errors: PolicyError[],
    warnings: PolicyWarning[]
): ParsedPolicy {
    const resource = policy.resource as string;
    const version = policy.version as string;
    const rules = policy.rules as unknown[];

    if (!resource) {
        errors.push({ file: filePath, message: "resourcePolicy missing required field: resource", severity: "error" });
    }
    if (!version) {
        errors.push({ file: filePath, message: "resourcePolicy missing required field: version", severity: "error" });
    }
    if (!rules || !Array.isArray(rules)) {
        errors.push({ file: filePath, message: "resourcePolicy missing required field: rules", severity: "error" });
    }

    // Validate rules
    if (rules && Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
            const rule = rules[i] as Record<string, unknown>;
            validateRule(rule, i, filePath, errors, warnings);
        }
    }

    return {
        file: filePath,
        type: "resourcePolicy",
        resource,
        version,
        rulesCount: rules?.length || 0,
    };
}

/**
 * Validate principal policy
 */
function validatePrincipalPolicy(
    policy: Record<string, unknown>,
    filePath: string,
    errors: PolicyError[],
    warnings: PolicyWarning[]
): ParsedPolicy {
    const principal = policy.principal as string;
    const version = policy.version as string;

    if (!principal) {
        errors.push({ file: filePath, message: "principalPolicy missing required field: principal", severity: "error" });
    }
    if (!version) {
        errors.push({ file: filePath, message: "principalPolicy missing required field: version", severity: "error" });
    }

    return {
        file: filePath,
        type: "principalPolicy",
        version,
    };
}

/**
 * Validate derived roles
 */
function validateDerivedRoles(
    roles: Record<string, unknown>,
    filePath: string,
    errors: PolicyError[],
    warnings: PolicyWarning[]
): ParsedPolicy {
    const name = roles.name as string;
    const definitions = roles.definitions as unknown[];

    if (!name) {
        errors.push({ file: filePath, message: "derivedRoles missing required field: name", severity: "error" });
    }
    if (!definitions || !Array.isArray(definitions)) {
        errors.push({ file: filePath, message: "derivedRoles missing required field: definitions", severity: "error" });
    }

    return {
        file: filePath,
        type: "derivedRoles",
    };
}

/**
 * Validate a single rule
 */
function validateRule(
    rule: Record<string, unknown>,
    index: number,
    filePath: string,
    errors: PolicyError[],
    warnings: PolicyWarning[]
): void {
    const actions = rule.actions as unknown[];
    const roles = rule.roles as unknown[];
    const effect = rule.effect as string;

    if (!actions || !Array.isArray(actions)) {
        errors.push({ file: filePath, message: \`Rule \${index}: missing required field: actions\`, severity: "error" });
    }
    if (!roles || !Array.isArray(roles)) {
        errors.push({ file: filePath, message: \`Rule \${index}: missing required field: roles\`, severity: "error" });
    }
    if (!effect) {
        errors.push({ file: filePath, message: \`Rule \${index}: missing required field: effect\`, severity: "error" });
    } else if (!["EFFECT_ALLOW", "EFFECT_DENY"].includes(effect)) {
        errors.push({ file: filePath, message: \`Rule \${index}: invalid effect value: \${effect}\`, severity: "error" });
    }
}

/**
 * Print validation report
 */
export function printValidationReport(result: PolicyValidationResult): void {
    console.log("\\n=== Cerbos Policy Validation Report ===\\n");
    console.log(\`Policies found: \${result.policies.length}\`);
    console.log(\`Errors: \${result.errors.length}\`);
    console.log(\`Warnings: \${result.warnings.length}\`);
    console.log(\`Status: \${result.isValid ? "✅ VALID" : "❌ INVALID"}\`);

    if (result.errors.length > 0) {
        console.log("\\n--- Errors ---");
        for (const error of result.errors) {
            console.log(\`  ❌ \${error.file}: \${error.message}\`);
        }
    }

    if (result.warnings.length > 0) {
        console.log("\\n--- Warnings ---");
        for (const warning of result.warnings) {
            console.log(\`  ⚠️ \${warning.file}: \${warning.message}\`);
        }
    }

    console.log("\\n");
}
`;

// ============================================
// EXPORTS
// ============================================

export const CERBOS_TEMPLATE_SETS = {
    client: {
        name: "Cerbos Client",
        template: CERBOS_CLIENT_TEMPLATE,
        description: "Cerbos client setup and authorization helpers",
    },
    policies: {
        name: "Cerbos Policies",
        template: CERBOS_POLICY_TEMPLATE,
        description: "Example YAML policy templates",
    },
    guard: {
        name: "Cerbos Guard",
        template: CERBOS_GUARD_TEMPLATE,
        description: "Express middleware for authorization",
    },
    decorators: {
        name: "Permissions Decorators",
        template: PERMISSIONS_DECORATOR_TEMPLATE,
        description: "TypeScript decorators for class-based controllers",
    },
    validation: {
        name: "Policy Validation",
        template: POLICY_VALIDATION_TEMPLATE,
        description: "Policy file validation utilities",
    },
};

export function getCerbosTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        client: CERBOS_CLIENT_TEMPLATE,
        policies: CERBOS_POLICY_TEMPLATE,
        guard: CERBOS_GUARD_TEMPLATE,
        decorators: PERMISSIONS_DECORATOR_TEMPLATE,
        validation: POLICY_VALIDATION_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableCerbosTypes(): string[] {
    return ["client", "policies", "guard", "decorators", "validation"];
}
