/**
 * Type declaration for autocannon module
 */
declare module 'autocannon' {
    interface AutocannonOptions {
        url: string;
        connections?: number;
        duration?: number;
        amount?: number;
        timeout?: number;
        pipelining?: number;
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
        headers?: Record<string, string>;
        body?: string;
        setupClient?: (client: any) => void;
    }

    interface AutocannonResult {
        title: string;
        url: string;
        requests: {
            average: number;
            mean: number;
            stddev: number;
            min: number;
            max: number;
            total: number;
            sent: number;
        };
        latency: {
            average: number;
            mean: number;
            stddev: number;
            min: number;
            max: number;
        };
        throughput: {
            average: number;
            mean: number;
            stddev: number;
            min: number;
            max: number;
            total: number;
        };
        errors: number;
        timeouts: number;
        duration: number;
        connections: number;
        pipelining: number;
    }

    function autocannon(options: AutocannonOptions, callback?: (err: Error | null, result: AutocannonResult) => void): any;

    export = autocannon;
}
