import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredModelPair, getModel, isGatewayEnabled, isModelConfigured } from '../model-registry.js';
import { callRegisteredModel } from '../../../infrastructure/ai-client.js';

const KEYS = ['OPENROUTER_API_KEY', 'AI_GATEWAY', 'GROQ_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY',
    'FAST_MODEL_NAME', 'POWER_MODEL_NAME', 'OPENROUTER_FAST_MODEL', 'OPENROUTER_POWER_MODEL'];
let saved: Record<string, string | undefined>;

beforeEach(() => {
    saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
});

afterEach(() => {
    for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
    vi.unstubAllGlobals();
});

describe('OpenRouter gateway', () => {
    it('routes every registry model through OpenRouter when only OPENROUTER_API_KEY is set', () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test';
        expect(isGatewayEnabled()).toBe(true);

        const sonnet = getModel('claude-sonnet-5-5')!;
        expect(sonnet.provider).toBe('openrouter');
        expect(sonnet.apiModelId).toBe('anthropic/claude-sonnet-5.5');
        expect(sonnet.apiKeyEnvVar).toBe('OPENROUTER_API_KEY');
        expect(isModelConfigured(sonnet)).toBe(true);

        const [fast, power] = getConfiguredModelPair();
        expect(isModelConfigured(fast)).toBe(true);
        expect(isModelConfigured(power)).toBe(true);
        expect(fast.provider).toBe('openrouter');
        expect(power.provider).toBe('openrouter');
    });

    it('accepts any OpenRouter model id via OPENROUTER_*_MODEL', () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test';
        process.env.OPENROUTER_FAST_MODEL = 'google/gemini-3-flash-preview';
        process.env.OPENROUTER_POWER_MODEL = 'moonshotai/kimi-k2.7-code';
        const [fast, power] = getConfiguredModelPair();
        expect(fast.apiModelId).toBe('google/gemini-3-flash-preview');
        expect(power.apiModelId).toBe('moonshotai/kimi-k2.7-code');
    });

    it('uses native providers when AI_GATEWAY=direct', () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test';
        process.env.AI_GATEWAY = 'direct';
        expect(isGatewayEnabled()).toBe(false);
        expect(getModel('claude-sonnet-5-5')!.provider).toBe('anthropic');
        expect(getModel('vendor/not-registered')).toBeNull();
    });

    it('sends the OpenRouter model id and key on the wire', async () => {
        process.env.OPENROUTER_API_KEY = 'sk-or-test';
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const reply = await callRegisteredModel('claude-haiku-4-5-20251001', [{ role: 'user', content: 'hi' }], { timeoutMs: 5000 });

        expect(reply).toBe('ok');
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-test');
        expect(JSON.parse(init.body as string).model).toBe('anthropic/claude-haiku-4.5');
    });
});
