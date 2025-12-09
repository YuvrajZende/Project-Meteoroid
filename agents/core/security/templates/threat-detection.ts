/**
 * ============================================
 * THREAT DETECTION TEMPLATES
 * ============================================
 * 
 * Advanced threat detection including anomaly detection,
 * intrusion prevention, and threat intelligence.
 */

// ============================================
// ANOMALY DETECTION TEMPLATE
// ============================================

export const ANOMALY_DETECTION_TEMPLATE = `/**
 * ============================================
 * ANOMALY DETECTION ENGINE
 * ============================================
 * 
 * Statistical anomaly detection for:
 * - Traffic patterns
 * - Request behavior
 * - User activity
 * - API usage
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// TYPES
// ============================================

export interface AnomalyConfig {
    /** Enable anomaly detection */
    enabled: boolean;
    /** Time window for analysis (ms) */
    windowMs: number;
    /** Standard deviation threshold for anomaly */
    stdDevThreshold: number;
    /** Minimum samples before detection */
    minSamples: number;
    /** Metrics to track */
    metrics: AnomalyMetric[];
}

export interface AnomalyMetric {
    name: string;
    type: "count" | "rate" | "latency" | "size";
    threshold?: number;
    enabled: boolean;
}

export interface AnomalyAlert {
    timestamp: Date;
    metric: string;
    currentValue: number;
    expectedValue: number;
    deviation: number;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
}

export interface MetricSample {
    timestamp: number;
    value: number;
}

// ============================================
// CONFIGURATION
// ============================================

const defaultConfig: AnomalyConfig = {
    enabled: true,
    windowMs: 5 * 60 * 1000, // 5 minutes
    stdDevThreshold: 3,
    minSamples: 30,
    metrics: [
        { name: "requests_per_minute", type: "rate", enabled: true },
        { name: "error_rate", type: "rate", enabled: true },
        { name: "response_latency", type: "latency", enabled: true },
        { name: "request_size", type: "size", enabled: true },
        { name: "unique_ips", type: "count", enabled: true },
    ],
};

// ============================================
// METRIC STORAGE
// ============================================

class MetricStore {
    private samples = new Map<string, MetricSample[]>();
    private alerts: AnomalyAlert[] = [];
    private config: AnomalyConfig;

    constructor(config: AnomalyConfig = defaultConfig) {
        this.config = config;
    }

    /**
     * Add a sample for a metric
     */
    addSample(metric: string, value: number): void {
        const now = Date.now();
        const samples = this.samples.get(metric) || [];
        
        samples.push({ timestamp: now, value });
        
        // Remove old samples outside window
        const cutoff = now - this.config.windowMs;
        const filtered = samples.filter(s => s.timestamp >= cutoff);
        
        this.samples.set(metric, filtered);
    }

    /**
     * Calculate statistics for a metric
     */
    getStats(metric: string): { mean: number; stdDev: number; count: number } | null {
        const samples = this.samples.get(metric);
        if (!samples || samples.length < this.config.minSamples) {
            return null;
        }

        const values = samples.map(s => s.value);
        const n = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        return { mean, stdDev, count: n };
    }

    /**
     * Check if value is anomalous
     */
    checkAnomaly(metric: string, value: number): AnomalyAlert | null {
        const stats = this.getStats(metric);
        if (!stats) return null;

        const deviation = Math.abs(value - stats.mean) / (stats.stdDev || 1);
        
        if (deviation > this.config.stdDevThreshold) {
            const severity = this.getSeverity(deviation);
            
            const alert: AnomalyAlert = {
                timestamp: new Date(),
                metric,
                currentValue: value,
                expectedValue: stats.mean,
                deviation,
                severity,
                description: \`\${metric} is \${deviation.toFixed(1)} standard deviations from normal\`,
            };

            this.alerts.push(alert);
            
            // Keep only recent alerts
            if (this.alerts.length > 1000) {
                this.alerts = this.alerts.slice(-500);
            }

            return alert;
        }

        return null;
    }

    private getSeverity(deviation: number): AnomalyAlert["severity"] {
        if (deviation > 6) return "critical";
        if (deviation > 4.5) return "high";
        if (deviation > 3.5) return "medium";
        return "low";
    }

    /**
     * Get recent alerts
     */
    getAlerts(since?: Date): AnomalyAlert[] {
        if (!since) return this.alerts;
        return this.alerts.filter(a => a.timestamp >= since);
    }

    /**
     * Get all metric stats
     */
    getAllStats(): Record<string, ReturnType<typeof this.getStats>> {
        const result: Record<string, ReturnType<typeof this.getStats>> = {};
        for (const [metric] of this.samples) {
            result[metric] = this.getStats(metric);
        }
        return result;
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

const metricStore = new MetricStore();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Anomaly detection middleware
 */
export function anomalyMiddleware(config?: Partial<AnomalyConfig>) {
    const finalConfig = { ...defaultConfig, ...config };
    
    // Track requests per minute
    let requestCount = 0;
    let lastMinute = Math.floor(Date.now() / 60000);
    
    // Track unique IPs
    const uniqueIPs = new Set<string>();
    let lastIPCount = 0;

    return (req: Request, res: Response, next: NextFunction) => {
        if (!finalConfig.enabled) return next();

        const startTime = Date.now();
        const currentMinute = Math.floor(startTime / 60000);
        
        // Reset counters on new minute
        if (currentMinute !== lastMinute) {
            // Record metrics from last minute
            metricStore.addSample("requests_per_minute", requestCount);
            metricStore.addSample("unique_ips", uniqueIPs.size);
            
            // Check for anomalies
            const rpmAlert = metricStore.checkAnomaly("requests_per_minute", requestCount);
            const ipAlert = metricStore.checkAnomaly("unique_ips", uniqueIPs.size);
            
            if (rpmAlert) {
                console.warn(\`[Anomaly] \${rpmAlert.description}\`);
            }
            if (ipAlert) {
                console.warn(\`[Anomaly] \${ipAlert.description}\`);
            }
            
            requestCount = 0;
            lastIPCount = uniqueIPs.size;
            uniqueIPs.clear();
            lastMinute = currentMinute;
        }

        // Track request
        requestCount++;
        if (req.ip) {
            uniqueIPs.add(req.ip);
        }

        // Track request size
        const contentLength = parseInt(req.headers["content-length"] || "0");
        metricStore.addSample("request_size", contentLength);
        metricStore.checkAnomaly("request_size", contentLength);

        // Track response latency
        res.on("finish", () => {
            const latency = Date.now() - startTime;
            metricStore.addSample("response_latency", latency);
            metricStore.checkAnomaly("response_latency", latency);

            // Track error rate
            if (res.statusCode >= 400) {
                metricStore.addSample("error_rate", 1);
            } else {
                metricStore.addSample("error_rate", 0);
            }
        });

        next();
    };
}

// ============================================
// API
// ============================================

/**
 * Get anomaly detection status
 */
export function getAnomalyStatus() {
    return {
        stats: metricStore.getAllStats(),
        recentAlerts: metricStore.getAlerts(new Date(Date.now() - 3600000)), // Last hour
    };
}

/**
 * Export metric store for external use
 */
export { metricStore };
`;

// ============================================
// INTRUSION DETECTION TEMPLATE
// ============================================

export const INTRUSION_DETECTION_TEMPLATE = `/**
 * ============================================
 * INTRUSION DETECTION SYSTEM (IDS)
 * ============================================
 * 
 * Network and application layer intrusion detection
 * with signature and behavior-based detection.
 */

import { Request, Response, NextFunction } from "express";
import { EventEmitter } from "events";

// ============================================
// TYPES
// ============================================

export type ThreatLevel = "info" | "low" | "medium" | "high" | "critical";
export type DetectionType = "signature" | "behavioral" | "reputation" | "heuristic";

export interface IntrusionEvent {
    id: string;
    timestamp: Date;
    sourceIP: string;
    targetPath: string;
    threatLevel: ThreatLevel;
    detectionType: DetectionType;
    signature?: string;
    description: string;
    payload?: string;
    blocked: boolean;
}

export interface IDSConfig {
    enabled: boolean;
    mode: "detect" | "prevent";
    logLevel: ThreatLevel;
    signatures: AttackSignature[];
    ipReputation: IPReputationConfig;
    alertWebhook?: string;
}

export interface AttackSignature {
    id: string;
    name: string;
    pattern: RegExp;
    locations: ("uri" | "query" | "body" | "headers")[];
    threatLevel: ThreatLevel;
    description: string;
}

export interface IPReputationConfig {
    enabled: boolean;
    blockThreshold: number; // 0-100
    providers: string[];
}

// ============================================
// ATTACK SIGNATURES
// ============================================

const DEFAULT_SIGNATURES: AttackSignature[] = [
    // Web Shells
    {
        id: "WEBSHELL-001",
        name: "PHP Web Shell Detection",
        pattern: /(eval\\s*\\(|base64_decode|shell_exec|system\\s*\\(|passthru)/i,
        locations: ["body", "query"],
        threatLevel: "critical",
        description: "Possible PHP web shell detected",
    },
    // Remote File Inclusion
    {
        id: "RFI-001",
        name: "Remote File Inclusion",
        pattern: /(https?|ftp|php):\\/\\//i,
        locations: ["query"],
        threatLevel: "high",
        description: "Possible remote file inclusion attempt",
    },
    // XXE
    {
        id: "XXE-001",
        name: "XML External Entity",
        pattern: /<!ENTITY|SYSTEM\\s+["'][^"']+["']/i,
        locations: ["body"],
        threatLevel: "critical",
        description: "Possible XXE attack detected",
    },
    // SSRF
    {
        id: "SSRF-001",
        name: "Server-Side Request Forgery",
        pattern: /(127\\.0\\.0\\.1|localhost|0\\.0\\.0\\.0|::1|169\\.254)/i,
        locations: ["query", "body"],
        threatLevel: "high",
        description: "Possible SSRF attempt to internal resources",
    },
    // Serialization Attacks
    {
        id: "DESER-001",
        name: "Unsafe Deserialization",
        pattern: /(O:\\d+:"|rO0|YTo|Tzo)/,
        locations: ["body", "headers"],
        threatLevel: "critical",
        description: "Possible unsafe deserialization payload",
    },
    // Log Injection
    {
        id: "LOG-001",
        name: "Log Injection",
        pattern: /(\\r\\n|\\n).*\\[(DEBUG|INFO|WARN|ERROR)\\]/i,
        locations: ["query", "body"],
        threatLevel: "medium",
        description: "Possible log injection attempt",
    },
    // LDAP Injection
    {
        id: "LDAP-001",
        name: "LDAP Injection",
        pattern: /[)(|*\\\\].*[)(|*\\\\]/,
        locations: ["query", "body"],
        threatLevel: "high",
        description: "Possible LDAP injection attempt",
    },
];

// ============================================
// IDS ENGINE
// ============================================

class IDSEngine extends EventEmitter {
    private config: IDSConfig;
    private events: IntrusionEvent[] = [];
    private eventId = 0;

    constructor(config?: Partial<IDSConfig>) {
        super();
        this.config = {
            enabled: true,
            mode: "prevent",
            logLevel: "low",
            signatures: DEFAULT_SIGNATURES,
            ipReputation: {
                enabled: false,
                blockThreshold: 80,
                providers: [],
            },
            ...config,
        };
    }

    /**
     * Analyze request for intrusion attempts
     */
    analyze(req: Request): IntrusionEvent | null {
        if (!this.config.enabled) return null;

        // Check signatures
        for (const sig of this.config.signatures) {
            const match = this.checkSignature(req, sig);
            if (match) {
                const event = this.createEvent(req, sig, match);
                this.recordEvent(event);
                return event;
            }
        }

        return null;
    }

    private checkSignature(req: Request, sig: AttackSignature): string | null {
        for (const location of sig.locations) {
            let content = "";
            switch (location) {
                case "uri":
                    content = req.path;
                    break;
                case "query":
                    content = JSON.stringify(req.query);
                    break;
                case "body":
                    content = JSON.stringify(req.body || {});
                    break;
                case "headers":
                    content = JSON.stringify(req.headers);
                    break;
            }

            const match = content.match(sig.pattern);
            if (match) {
                return match[0];
            }
        }
        return null;
    }

    private createEvent(req: Request, sig: AttackSignature, match: string): IntrusionEvent {
        return {
            id: \`IDS-\${++this.eventId}\`,
            timestamp: new Date(),
            sourceIP: req.ip || "unknown",
            targetPath: req.path,
            threatLevel: sig.threatLevel,
            detectionType: "signature",
            signature: sig.id,
            description: sig.description,
            payload: match.substring(0, 100),
            blocked: this.config.mode === "prevent",
        };
    }

    private recordEvent(event: IntrusionEvent): void {
        // Store event
        this.events.push(event);
        
        // Keep only last 10000 events
        if (this.events.length > 10000) {
            this.events = this.events.slice(-5000);
        }

        // Log based on threat level
        const levelOrder: ThreatLevel[] = ["info", "low", "medium", "high", "critical"];
        if (levelOrder.indexOf(event.threatLevel) >= levelOrder.indexOf(this.config.logLevel)) {
            console.warn(\`[IDS] \${event.threatLevel.toUpperCase()}: \${event.description} from \${event.sourceIP}\`);
        }

        // Emit event for external handlers
        this.emit("intrusion", event);
    }

    /**
     * Get intrusion events
     */
    getEvents(options?: {
        since?: Date;
        threatLevel?: ThreatLevel;
        sourceIP?: string;
        limit?: number;
    }): IntrusionEvent[] {
        let filtered = this.events;

        if (options?.since) {
            filtered = filtered.filter(e => e.timestamp >= options.since!);
        }
        if (options?.threatLevel) {
            filtered = filtered.filter(e => e.threatLevel === options.threatLevel);
        }
        if (options?.sourceIP) {
            filtered = filtered.filter(e => e.sourceIP === options.sourceIP);
        }
        if (options?.limit) {
            filtered = filtered.slice(-options.limit);
        }

        return filtered;
    }

    /**
     * Get event statistics
     */
    getStats(): Record<string, number> {
        return {
            total: this.events.length,
            critical: this.events.filter(e => e.threatLevel === "critical").length,
            high: this.events.filter(e => e.threatLevel === "high").length,
            medium: this.events.filter(e => e.threatLevel === "medium").length,
            low: this.events.filter(e => e.threatLevel === "low").length,
            blocked: this.events.filter(e => e.blocked).length,
        };
    }

    /**
     * Add custom signature
     */
    addSignature(signature: AttackSignature): void {
        this.config.signatures.push(signature);
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

export const idsEngine = new IDSEngine();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * IDS middleware
 */
export function idsMiddleware(config?: Partial<IDSConfig>) {
    const engine = config ? new IDSEngine(config) : idsEngine;

    return (req: Request, res: Response, next: NextFunction) => {
        const event = engine.analyze(req);

        if (event) {
            // Attach event to request
            (req as any).intrusionEvent = event;

            // Block if in prevent mode
            if (event.blocked) {
                return res.status(403).json({
                    error: "Access denied",
                    message: "Request blocked by intrusion detection system",
                    eventId: event.id,
                });
            }
        }

        next();
    };
}

// ============================================
// EVENT HANDLERS
// ============================================

// Example: Send alerts for critical events
idsEngine.on("intrusion", (event: IntrusionEvent) => {
    if (event.threatLevel === "critical") {
        // Send alert (implement your alerting logic)
        console.error(\`[IDS ALERT] CRITICAL: \${event.description}\`);
        // Could send to Slack, PagerDuty, email, etc.
    }
});
`;

// ============================================
// THREAT INTELLIGENCE TEMPLATE
// ============================================

export const THREAT_INTELLIGENCE_TEMPLATE = `/**
 * ============================================
 * THREAT INTELLIGENCE
 * ============================================
 * 
 * Integration with threat intelligence feeds
 * for IP reputation and IOC checking.
 */

import { Request, Response, NextFunction } from "express";

// ============================================
// TYPES
// ============================================

export interface IPReputationInfo {
    ip: string;
    score: number; // 0-100, higher = worse
    categories: string[];
    lastSeen?: Date;
    source: string;
    isMalicious: boolean;
}

export interface IOC {
    type: "ip" | "domain" | "hash" | "url" | "email";
    value: string;
    threat: string;
    confidence: number;
    source: string;
    lastUpdated: Date;
}

export interface ThreatIntelConfig {
    enabled: boolean;
    feeds: ThreatFeed[];
    cacheMinutes: number;
    blockScore: number; // Block if reputation score >= this
}

export interface ThreatFeed {
    name: string;
    type: "ip" | "domain" | "hash";
    url?: string;
    apiKey?: string;
    enabled: boolean;
}

// ============================================
// IP REPUTATION CACHE
// ============================================

class ReputationCache {
    private cache = new Map<string, { info: IPReputationInfo; expires: number }>();
    private iocCache = new Map<string, IOC>();
    private cacheMinutes: number;

    constructor(cacheMinutes: number = 60) {
        this.cacheMinutes = cacheMinutes;
    }

    get(ip: string): IPReputationInfo | null {
        const entry = this.cache.get(ip);
        if (!entry) return null;
        if (Date.now() > entry.expires) {
            this.cache.delete(ip);
            return null;
        }
        return entry.info;
    }

    set(info: IPReputationInfo): void {
        this.cache.set(info.ip, {
            info,
            expires: Date.now() + this.cacheMinutes * 60 * 1000,
        });
    }

    addIOC(ioc: IOC): void {
        this.iocCache.set(\`\${ioc.type}:\${ioc.value}\`, ioc);
    }

    checkIOC(type: IOC["type"], value: string): IOC | null {
        return this.iocCache.get(\`\${type}:\${value}\`) || null;
    }
}

// ============================================
// BUILT-IN THREAT LISTS
// ============================================

// Known malicious IP ranges (example - in production use threat feeds)
const KNOWN_BAD_RANGES = [
    // Tor exit nodes (example ranges)
    // "185.220.100.0/24",
    // Known botnet C2 (example)
    // "45.33.32.0/24",
];

// Known bad user agents
const KNOWN_BAD_USER_AGENTS = [
    /masscan/i,
    /nmap/i,
    /nikto/i,
    /sqlmap/i,
    /dirbuster/i,
    /gobuster/i,
    /nuclei/i,
];

// ============================================
// THREAT INTEL ENGINE
// ============================================

class ThreatIntelEngine {
    private cache: ReputationCache;
    private config: ThreatIntelConfig;

    constructor(config?: Partial<ThreatIntelConfig>) {
        this.config = {
            enabled: true,
            feeds: [],
            cacheMinutes: 60,
            blockScore: 80,
            ...config,
        };
        this.cache = new ReputationCache(this.config.cacheMinutes);
    }

    /**
     * Check IP reputation
     */
    async checkIP(ip: string): Promise<IPReputationInfo> {
        // Check cache first
        const cached = this.cache.get(ip);
        if (cached) return cached;

        // Calculate local reputation score
        let score = 0;
        const categories: string[] = [];

        // Check against known bad ranges
        for (const range of KNOWN_BAD_RANGES) {
            if (this.isIPInRange(ip, range)) {
                score += 50;
                categories.push("known_bad_range");
            }
        }

        // In production, query external threat feeds here
        // const externalScore = await this.queryThreatFeeds(ip);
        // score += externalScore;

        const info: IPReputationInfo = {
            ip,
            score: Math.min(100, score),
            categories,
            source: "internal",
            isMalicious: score >= this.config.blockScore,
        };

        this.cache.set(info);
        return info;
    }

    /**
     * Check user agent against threat list
     */
    checkUserAgent(ua: string): { isMalicious: boolean; tool?: string } {
        for (const pattern of KNOWN_BAD_USER_AGENTS) {
            if (pattern.test(ua)) {
                return {
                    isMalicious: true,
                    tool: pattern.source,
                };
            }
        }
        return { isMalicious: false };
    }

    /**
     * Add IOC to local database
     */
    addIOC(ioc: IOC): void {
        this.cache.addIOC(ioc);
    }

    /**
     * Check value against IOC database
     */
    checkIOC(type: IOC["type"], value: string): IOC | null {
        return this.cache.checkIOC(type, value);
    }

    private isIPInRange(ip: string, cidr: string): boolean {
        const [range, bits] = cidr.split("/");
        if (!bits) return ip === range;

        const mask = ~(2 ** (32 - parseInt(bits)) - 1);
        const ipNum = ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
        const rangeNum = range.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
        
        return (ipNum & mask) === (rangeNum & mask);
    }
}

// ============================================
// GLOBAL INSTANCE
// ============================================

export const threatIntel = new ThreatIntelEngine();

// ============================================
// MIDDLEWARE
// ============================================

export interface ThreatIntelMiddlewareOptions {
    blockMaliciousIPs?: boolean;
    blockMaliciousUserAgents?: boolean;
    logOnly?: boolean;
}

/**
 * Threat intelligence middleware
 */
export function threatIntelMiddleware(options: ThreatIntelMiddlewareOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const clientIP = req.ip || "";
        const userAgent = req.headers["user-agent"] || "";

        // Check IP reputation
        if (options.blockMaliciousIPs !== false) {
            const ipInfo = await threatIntel.checkIP(clientIP);
            
            (req as any).ipReputation = ipInfo;

            if (ipInfo.isMalicious && !options.logOnly) {
                console.warn(\`[ThreatIntel] Blocked malicious IP: \${clientIP}\`);
                return res.status(403).json({
                    error: "Access denied",
                    message: "Your IP has been flagged as malicious",
                });
            } else if (ipInfo.isMalicious) {
                console.warn(\`[ThreatIntel] Malicious IP detected (log only): \${clientIP}\`);
            }
        }

        // Check user agent
        if (options.blockMaliciousUserAgents !== false) {
            const uaCheck = threatIntel.checkUserAgent(userAgent);
            
            if (uaCheck.isMalicious && !options.logOnly) {
                console.warn(\`[ThreatIntel] Blocked malicious user agent: \${uaCheck.tool}\`);
                return res.status(403).json({
                    error: "Access denied",
                    message: "Security scanning tools are not allowed",
                });
            } else if (uaCheck.isMalicious) {
                console.warn(\`[ThreatIntel] Malicious user agent detected (log only): \${uaCheck.tool}\`);
            }
        }

        next();
    };
}
`;

// ============================================
// EXPORTS
// ============================================

export const THREAT_DETECTION_TEMPLATE_SETS = {
    anomaly: {
        name: "Anomaly Detection",
        template: ANOMALY_DETECTION_TEMPLATE,
        description: "Statistical anomaly detection for traffic patterns",
    },
    ids: {
        name: "Intrusion Detection",
        template: INTRUSION_DETECTION_TEMPLATE,
        description: "Signature-based intrusion detection system",
    },
    threatIntel: {
        name: "Threat Intelligence",
        template: THREAT_INTELLIGENCE_TEMPLATE,
        description: "IP reputation and IOC checking",
    },
};

export function getThreatDetectionTemplates(type: string): string | undefined {
    const templates: Record<string, string> = {
        anomaly: ANOMALY_DETECTION_TEMPLATE,
        ids: INTRUSION_DETECTION_TEMPLATE,
        threatIntel: THREAT_INTELLIGENCE_TEMPLATE,
    };
    return templates[type];
}

export function getAvailableThreatDetectionTypes(): string[] {
    return ["anomaly", "ids", "threatIntel"];
}
