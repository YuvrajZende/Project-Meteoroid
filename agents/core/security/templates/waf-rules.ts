/**
 * ============================================
 * WAF (WEB APPLICATION FIREWALL) TEMPLATES
 * ============================================
 * 
 * Web Application Firewall rules for protecting
 * against common web attacks and malicious traffic.
 */

// ============================================
// WAF RULE ENGINE TEMPLATE
// ============================================

export const WAF_RULE_ENGINE_TEMPLATE = `/**
 * ============================================
 * WAF RULE ENGINE
 * ============================================
 * 
 * Core WAF engine for evaluating security rules
 * against incoming requests.
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// TYPES
// ============================================

export type RuleAction = "block" | "allow" | "log" | "challenge" | "rate_limit";
export type RuleSeverity = "critical" | "high" | "medium" | "low" | "info";
export type MatchLocation = "uri" | "query" | "headers" | "body" | "cookies" | "method" | "ip";

export interface WAFRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: RuleSeverity;
    action: RuleAction;
    match: RuleMatch;
    tags?: string[];
}

export interface RuleMatch {
    location: MatchLocation | MatchLocation[];
    type: "regex" | "contains" | "equals" | "starts_with" | "ends_with" | "ip_range";
    value: string | string[] | RegExp;
    negate?: boolean;
    transform?: ("lowercase" | "urldecode" | "base64decode" | "htmldecode")[];
}

export interface WAFConfig {
    enabled: boolean;
    mode: "blocking" | "detection" | "learning";
    defaultAction: RuleAction;
    rules: WAFRule[];
    ipWhitelist: string[];
    ipBlacklist: string[];
    rateLimit?: {
        enabled: boolean;
        requests: number;
        window: number;
    };
}

export interface WAFEvaluation {
    passed: boolean;
    triggered: WAFRule[];
    action: RuleAction;
    score: number;
    details: string[];
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export const defaultWAFConfig: WAFConfig = {
    enabled: true,
    mode: "blocking",
    defaultAction: "allow",
    rules: [],
    ipWhitelist: ["127.0.0.1", "::1"],
    ipBlacklist: [],
};

// ============================================
// RULE EVALUATION
// ============================================

/**
 * Extract value from request based on location
 */
function extractValue(req: Request, location: MatchLocation): string | string[] {
    switch (location) {
        case "uri":
            return req.path;
        case "query":
            return Object.values(req.query).flat().map(String);
        case "headers":
            return Object.values(req.headers).flat().filter(Boolean).map(String);
        case "body":
            return JSON.stringify(req.body || {});
        case "cookies":
            return Object.values(req.cookies || {}).map(String);
        case "method":
            return req.method;
        case "ip":
            return req.ip || "";
        default:
            return "";
    }
}

/**
 * Apply transformations to value
 */
function applyTransforms(value: string, transforms?: string[]): string {
    if (!transforms) return value;
    
    let result = value;
    for (const transform of transforms) {
        switch (transform) {
            case "lowercase":
                result = result.toLowerCase();
                break;
            case "urldecode":
                try { result = decodeURIComponent(result); } catch {}
                break;
            case "base64decode":
                try { result = Buffer.from(result, "base64").toString(); } catch {}
                break;
            case "htmldecode":
                result = result
                    .replace(/&amp;/g, "&")
                    .replace(/&lt;/g, "<")
                    .replace(/&gt;/g, ">")
                    .replace(/&quot;/g, '"');
                break;
        }
    }
    return result;
}

/**
 * Check if value matches rule
 */
function matchValue(value: string, match: RuleMatch): boolean {
    const transformed = applyTransforms(value, match.transform);
    let matched = false;

    const patterns = Array.isArray(match.value) ? match.value : [match.value];
    
    for (const pattern of patterns) {
        switch (match.type) {
            case "regex":
                const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern as string, "i");
                matched = regex.test(transformed);
                break;
            case "contains":
                matched = transformed.includes(pattern as string);
                break;
            case "equals":
                matched = transformed === pattern;
                break;
            case "starts_with":
                matched = transformed.startsWith(pattern as string);
                break;
            case "ends_with":
                matched = transformed.endsWith(pattern as string);
                break;
            case "ip_range":
                matched = isIPInRange(value, pattern as string);
                break;
        }
        if (matched) break;
    }

    return match.negate ? !matched : matched;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInRange(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split("/");
    if (!bits) return ip === range;

    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    
    return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Evaluate a single rule against request
 */
function evaluateRule(req: Request, rule: WAFRule): boolean {
    if (!rule.enabled) return false;

    const locations = Array.isArray(rule.match.location) 
        ? rule.match.location 
        : [rule.match.location];

    for (const location of locations) {
        const values = extractValue(req, location);
        const valueArray = Array.isArray(values) ? values : [values];

        for (const value of valueArray) {
            if (matchValue(value, rule.match)) {
                return true;
            }
        }
    }

    return false;
}

// ============================================
// WAF ENGINE
// ============================================

/**
 * Evaluate request against all WAF rules
 */
export function evaluateRequest(req: Request, config: WAFConfig): WAFEvaluation {
    const triggered: WAFRule[] = [];
    const details: string[] = [];
    let score = 0;

    // Check IP whitelist
    const clientIP = req.ip || "";
    if (config.ipWhitelist.some(ip => isIPInRange(clientIP, ip))) {
        return {
            passed: true,
            triggered: [],
            action: "allow",
            score: 0,
            details: ["IP whitelisted"],
        };
    }

    // Check IP blacklist
    if (config.ipBlacklist.some(ip => isIPInRange(clientIP, ip))) {
        return {
            passed: false,
            triggered: [],
            action: "block",
            score: 100,
            details: ["IP blacklisted"],
        };
    }

    // Evaluate each rule
    for (const rule of config.rules) {
        if (evaluateRule(req, rule)) {
            triggered.push(rule);
            details.push(\`Rule \${rule.id} matched: \${rule.name}\`);
            
            // Calculate score based on severity
            const severityScores = { critical: 40, high: 25, medium: 15, low: 5, info: 1 };
            score += severityScores[rule.severity];
        }
    }

    // Determine action
    let action: RuleAction = config.defaultAction;
    if (triggered.length > 0) {
        // Use highest severity rule's action
        const highestSeverity = triggered.reduce((prev, curr) => {
            const severities: RuleSeverity[] = ["critical", "high", "medium", "low", "info"];
            return severities.indexOf(curr.severity) < severities.indexOf(prev.severity) ? curr : prev;
        });
        action = highestSeverity.action;
    }

    return {
        passed: action === "allow" || action === "log",
        triggered,
        action,
        score,
        details,
    };
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * WAF middleware
 */
export function wafMiddleware(config: WAFConfig = defaultWAFConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!config.enabled) {
            return next();
        }

        const evaluation = evaluateRequest(req, config);

        // Attach evaluation to request
        (req as any).wafEvaluation = evaluation;

        // Log in detection mode
        if (config.mode === "detection" || config.mode === "learning") {
            if (evaluation.triggered.length > 0) {
                console.log(\`[WAF] Detected: \${evaluation.details.join(", ")}\`);
            }
            return next();
        }

        // Block if in blocking mode and not passed
        if (!evaluation.passed) {
            console.warn(\`[WAF] Blocked request from \${req.ip}: \${evaluation.details.join(", ")}\`);
            
            if (evaluation.action === "challenge") {
                return res.status(403).json({
                    error: "Challenge required",
                    message: "Please complete the security challenge",
                    code: "WAF_CHALLENGE",
                });
            }

            return res.status(403).json({
                error: "Forbidden",
                message: "Request blocked by security rules",
                code: "WAF_BLOCKED",
            });
        }

        next();
    };
}
`;

// ============================================
// OWASP CORE RULES TEMPLATE
// ============================================

export const OWASP_RULES_TEMPLATE = `/**
 * ============================================
 * OWASP CORE RULE SET (CRS) IMPLEMENTATION
 * ============================================
 * 
 * Based on OWASP ModSecurity Core Rule Set.
 * These rules protect against common web attacks.
 */

import { WAFRule } from "./waf-engine";

// ============================================
// SQL INJECTION RULES
// ============================================

export const SQL_INJECTION_RULES: WAFRule[] = [
    {
        id: "SQLI-001",
        name: "SQL Injection - Union Select",
        description: "Detects SQL UNION SELECT injection attempts",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["uri", "query", "body"],
            type: "regex",
            value: /union\\s+(all\\s+)?select/i,
            transform: ["lowercase", "urldecode"],
        },
        tags: ["sqli", "owasp-a03"],
    },
    {
        id: "SQLI-002",
        name: "SQL Injection - OR/AND Boolean",
        description: "Detects SQL boolean-based injection",
        enabled: true,
        severity: "high",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /'\\s*(or|and)\\s+['\\"\\d].*=/i,
            transform: ["urldecode"],
        },
        tags: ["sqli", "owasp-a03"],
    },
    {
        id: "SQLI-003",
        name: "SQL Injection - Comment Sequence",
        description: "Detects SQL comment injection",
        enabled: true,
        severity: "high",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /(--|#|\\/\\*).*('|")/i,
            transform: ["urldecode"],
        },
        tags: ["sqli", "owasp-a03"],
    },
    {
        id: "SQLI-004",
        name: "SQL Injection - Stacked Queries",
        description: "Detects SQL stacked query injection",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /;\\s*(drop|delete|insert|update|create|alter)\\s/i,
            transform: ["urldecode"],
        },
        tags: ["sqli", "owasp-a03"],
    },
];

// ============================================
// XSS RULES
// ============================================

export const XSS_RULES: WAFRule[] = [
    {
        id: "XSS-001",
        name: "XSS - Script Tag",
        description: "Detects script tag injection",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["query", "body", "headers"],
            type: "regex",
            value: /<script[^>]*>/i,
            transform: ["urldecode", "htmldecode"],
        },
        tags: ["xss", "owasp-a03"],
    },
    {
        id: "XSS-002",
        name: "XSS - Event Handler",
        description: "Detects event handler injection",
        enabled: true,
        severity: "high",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /\\bon\\w+\\s*=/i,
            transform: ["urldecode", "htmldecode"],
        },
        tags: ["xss", "owasp-a03"],
    },
    {
        id: "XSS-003",
        name: "XSS - JavaScript Protocol",
        description: "Detects javascript: protocol injection",
        enabled: true,
        severity: "high",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /javascript\\s*:/i,
            transform: ["urldecode", "htmldecode"],
        },
        tags: ["xss", "owasp-a03"],
    },
    {
        id: "XSS-004",
        name: "XSS - Data Protocol",
        description: "Detects data: protocol abuse",
        enabled: true,
        severity: "medium",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /data:\\s*text\\/html/i,
            transform: ["urldecode"],
        },
        tags: ["xss", "owasp-a03"],
    },
];

// ============================================
// PATH TRAVERSAL RULES
// ============================================

export const PATH_TRAVERSAL_RULES: WAFRule[] = [
    {
        id: "LFI-001",
        name: "Path Traversal - Dot Dot Slash",
        description: "Detects directory traversal attempts",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["uri", "query"],
            type: "regex",
            value: /(\\.\\.\\/|\\.\\.\\\\)/,
            transform: ["urldecode"],
        },
        tags: ["lfi", "owasp-a01"],
    },
    {
        id: "LFI-002",
        name: "Path Traversal - Null Byte",
        description: "Detects null byte injection",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["uri", "query"],
            type: "contains",
            value: "%00",
        },
        tags: ["lfi", "owasp-a01"],
    },
    {
        id: "LFI-003",
        name: "Path Traversal - Sensitive Files",
        description: "Blocks access to sensitive files",
        enabled: true,
        severity: "high",
        action: "block",
        match: {
            location: "uri",
            type: "regex",
            value: /(\\/etc\\/passwd|\\.env|\\.git|wp-config\\.php)/i,
        },
        tags: ["lfi", "owasp-a01"],
    },
];

// ============================================
// COMMAND INJECTION RULES
// ============================================

export const COMMAND_INJECTION_RULES: WAFRule[] = [
    {
        id: "RCE-001",
        name: "Command Injection - Shell Metacharacters",
        description: "Detects shell command injection",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /[;|&\$\`]\\s*(cat|ls|pwd|whoami|id|wget|curl|nc)/i,
            transform: ["urldecode"],
        },
        tags: ["rce", "owasp-a03"],
    },
    {
        id: "RCE-002",
        name: "Command Injection - Backticks",
        description: "Detects backtick command execution",
        enabled: true,
        severity: "critical",
        action: "block",
        match: {
            location: ["query", "body"],
            type: "regex",
            value: /\`[^\`]+\`/,
            transform: ["urldecode"],
        },
        tags: ["rce", "owasp-a03"],
    },
];

// ============================================
// COMBINED RULESET
// ============================================

export const OWASP_CORE_RULES: WAFRule[] = [
    ...SQL_INJECTION_RULES,
    ...XSS_RULES,
    ...PATH_TRAVERSAL_RULES,
    ...COMMAND_INJECTION_RULES,
];

/**
 * Get rules by category
 */
export function getRulesByTag(tag: string): WAFRule[] {
    return OWASP_CORE_RULES.filter(rule => rule.tags?.includes(tag));
}

/**
 * Get rules by severity
 */
export function getRulesBySeverity(severity: string): WAFRule[] {
    return OWASP_CORE_RULES.filter(rule => rule.severity === severity);
}
`;

// ============================================
// CUSTOM RULES BUILDER TEMPLATE
// ============================================

export const CUSTOM_RULES_TEMPLATE = `/**
 * ============================================
 * CUSTOM WAF RULES BUILDER
 * ============================================
 * 
 * Fluent API for building custom WAF rules.
 */

import { WAFRule, RuleAction, RuleSeverity, MatchLocation, RuleMatch } from "./waf-engine";

// ============================================
// RULE BUILDER
// ============================================

export class WAFRuleBuilder {
    private rule: Partial<WAFRule> = {
        enabled: true,
        tags: [],
    };

    /**
     * Set rule ID
     */
    id(id: string): this {
        this.rule.id = id;
        return this;
    }

    /**
     * Set rule name
     */
    name(name: string): this {
        this.rule.name = name;
        return this;
    }

    /**
     * Set description
     */
    description(desc: string): this {
        this.rule.description = desc;
        return this;
    }

    /**
     * Set severity
     */
    severity(level: RuleSeverity): this {
        this.rule.severity = level;
        return this;
    }

    /**
     * Set action
     */
    action(action: RuleAction): this {
        this.rule.action = action;
        return this;
    }

    /**
     * Add tag
     */
    tag(tag: string): this {
        this.rule.tags = this.rule.tags || [];
        this.rule.tags.push(tag);
        return this;
    }

    /**
     * Enable/disable rule
     */
    enabled(value: boolean): this {
        this.rule.enabled = value;
        return this;
    }

    /**
     * Match against URI
     */
    matchUri(pattern: string | RegExp, type: "regex" | "contains" = "regex"): this {
        this.rule.match = {
            location: "uri",
            type,
            value: pattern,
        };
        return this;
    }

    /**
     * Match against query parameters
     */
    matchQuery(pattern: string | RegExp, type: "regex" | "contains" = "regex"): this {
        this.rule.match = {
            location: "query",
            type,
            value: pattern,
        };
        return this;
    }

    /**
     * Match against request body
     */
    matchBody(pattern: string | RegExp, type: "regex" | "contains" = "regex"): this {
        this.rule.match = {
            location: "body",
            type,
            value: pattern,
        };
        return this;
    }

    /**
     * Match against headers
     */
    matchHeaders(pattern: string | RegExp, type: "regex" | "contains" = "regex"): this {
        this.rule.match = {
            location: "headers",
            type,
            value: pattern,
        };
        return this;
    }

    /**
     * Match multiple locations
     */
    matchAny(
        locations: MatchLocation[],
        pattern: string | RegExp,
        type: "regex" | "contains" = "regex"
    ): this {
        this.rule.match = {
            location: locations,
            type,
            value: pattern,
        };
        return this;
    }

    /**
     * Match IP range
     */
    matchIP(cidr: string | string[]): this {
        this.rule.match = {
            location: "ip",
            type: "ip_range",
            value: cidr,
        };
        return this;
    }

    /**
     * Negate the match
     */
    negate(): this {
        if (this.rule.match) {
            this.rule.match.negate = true;
        }
        return this;
    }

    /**
     * Add transforms
     */
    transform(...transforms: ("lowercase" | "urldecode" | "base64decode" | "htmldecode")[]): this {
        if (this.rule.match) {
            this.rule.match.transform = transforms;
        }
        return this;
    }

    /**
     * Build the rule
     */
    build(): WAFRule {
        if (!this.rule.id || !this.rule.name || !this.rule.match || !this.rule.severity || !this.rule.action) {
            throw new Error("Rule is incomplete. Required: id, name, match, severity, action");
        }
        return this.rule as WAFRule;
    }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

/**
 * Create a new rule builder
 */
export function createRule(): WAFRuleBuilder {
    return new WAFRuleBuilder();
}

/**
 * Quick rule creation helpers
 */
export const RuleTemplates = {
    /**
     * Block requests containing a pattern
     */
    blockPattern(id: string, name: string, pattern: RegExp): WAFRule {
        return createRule()
            .id(id)
            .name(name)
            .description(\`Block requests matching: \${pattern.source}\`)
            .severity("high")
            .action("block")
            .matchAny(["uri", "query", "body"], pattern)
            .transform("urldecode")
            .build();
    },

    /**
     * Block IP range
     */
    blockIP(id: string, name: string, cidr: string): WAFRule {
        return createRule()
            .id(id)
            .name(name)
            .description(\`Block IP range: \${cidr}\`)
            .severity("high")
            .action("block")
            .matchIP(cidr)
            .build();
    },

    /**
     * Rate limit path
     */
    rateLimit(id: string, name: string, path: string): WAFRule {
        return createRule()
            .id(id)
            .name(name)
            .description(\`Rate limit path: \${path}\`)
            .severity("medium")
            .action("rate_limit")
            .matchUri(path, "contains")
            .build();
    },

    /**
     * Log suspicious pattern
     */
    logSuspicious(id: string, name: string, pattern: RegExp): WAFRule {
        return createRule()
            .id(id)
            .name(name)
            .description(\`Log suspicious pattern: \${pattern.source}\`)
            .severity("low")
            .action("log")
            .matchAny(["uri", "query", "body"], pattern)
            .transform("urldecode")
            .build();
    },
};

// ============================================
// USAGE EXAMPLE
// ============================================

/*
const customRules = [
    // Block specific attack pattern
    createRule()
        .id("CUSTOM-001")
        .name("Block eval() in requests")
        .severity("critical")
        .action("block")
        .matchBody(/eval\\s*\\(/i)
        .transform("urldecode")
        .tag("custom")
        .build(),

    // Rate limit login attempts
    RuleTemplates.rateLimit("CUSTOM-002", "Rate limit login", "/api/auth/login"),

    // Block known bad actors
    RuleTemplates.blockIP("CUSTOM-003", "Block bad IP range", "192.168.100.0/24"),
];
*/
`;

// ============================================
// EXPORTS
// ============================================

export const WAF_TEMPLATE_SETS = {
    engine: {
        name: "WAF Rule Engine",
        template: WAF_RULE_ENGINE_TEMPLATE,
        description: "Core WAF engine for rule evaluation",
    },
    owasp: {
        name: "OWASP Core Rules",
        template: OWASP_RULES_TEMPLATE,
        description: "OWASP-based security rules",
    },
    custom: {
        name: "Custom Rules Builder",
        template: CUSTOM_RULES_TEMPLATE,
        description: "Fluent API for building custom rules",
    },
};

export function getWAFTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        engine: WAF_RULE_ENGINE_TEMPLATE,
        owasp: OWASP_RULES_TEMPLATE,
        custom: CUSTOM_RULES_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableWAFTypes(): string[] {
    return ["engine", "owasp", "custom"];
}
