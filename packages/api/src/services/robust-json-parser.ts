/**
 * Robust JSON Parser
 * 
 * Handles malformed JSON responses from LLMs with intelligent extraction and repair
 */

export interface JSONParseResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    repairAttempted?: boolean;
    originalLength?: number;
}

export class RobustJSONParser {
    /**
     * Parse JSON with aggressive repair strategies
     */
    parse<T = any>(input: string): JSONParseResult<T> {
        if (!input || input.trim().length === 0) {
            return {
                success: false,
                error: 'Empty input',
            };
        }

        let cleaned = input.trim();
        const originalLength = cleaned.length;

        // Strategy 1: Try direct parse
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data };
        } catch (firstError) {
            // Continue to repair strategies
        }

        // Strategy 2: Remove markdown code blocks
        cleaned = this.removeMarkdownBlocks(cleaned);
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data, repairAttempted: true };
        } catch { }

        // Strategy 3: Extract JSON from surrounding text
        cleaned = this.extractJSON(input);
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data, repairAttempted: true };
        } catch { }

        // Strategy 4: Fix truncated JSON (common with streaming)
        cleaned = this.fixTruncatedJSON(cleaned);
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data, repairAttempted: true };
        } catch { }

        // Strategy 5: Fix common LLM mistakes
        cleaned = this.fixCommonMistakes(cleaned);
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data, repairAttempted: true };
        } catch { }

        // Strategy 6: Aggressive repair - fix unterminated strings
        cleaned = this.fixUnterminatedStrings(cleaned);
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data, repairAttempted: true };
        } catch (finalError) {
            return {
                success: false,
                error: finalError instanceof Error ? finalError.message : 'Unknown parse error',
                originalLength,
            };
        }
    }

    /**
     * Remove markdown code blocks
     */
    private removeMarkdownBlocks(text: string): string {
        // Remove ```json ... ``` or ``` ... ```
        return text
            .replace(/^```json?\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
    }

    /**
     * Extract JSON object from surrounding text
     */
    private extractJSON(text: string): string {
        // Find first { and last }
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return text.substring(firstBrace, lastBrace + 1);
        }

        return text;
    }

    /**
     * Fix truncated JSON (unterminated strings, arrays, objects)
     */
    private fixTruncatedJSON(text: string): string {
        let fixed = text.trim();

        // Count braces and brackets
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;

        // Add missing closing braces
        for (let i = 0; i < openBraces - closeBraces; i++) {
            fixed += '}';
        }

        // Add missing closing brackets
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
            fixed += ']';
        }

        // Fix unterminated string at end
        if (this.hasUnterminatedString(fixed)) {
            // Find the last unterminated string
            const lastQuote = fixed.lastIndexOf('"');
            if (lastQuote !== -1) {
                // Check if it's the opening quote of an unterminated string
                // Count quotes before this position
                const beforeQuotes = (fixed.substring(0, lastQuote).match(/"/g) || []).length;

                // If odd number of quotes, we need to close it
                if (beforeQuotes % 2 === 0) {
                    fixed += '"';
                }
            }
        }

        return fixed;
    }

    /**
     * Check if string has unterminated string literal
     */
    private hasUnterminatedString(text: string): boolean {
        let inString = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
            }
        }

        return inString;
    }

    /**
     * Fix common LLM mistakes in JSON
     */
    private fixCommonMistakes(text: string): string {
        let fixed = text;

        // Fix trailing commas
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

        // Fix single quotes to double quotes (basic, doesn't handle nested)
        fixed = fixed.replace(/'/g, '"');

        // Fix unescaped newlines in strings
        fixed = fixed.replace(/"([^"]*)\n([^"]*?)"/g, (_match, p1, p2) => {
            return `"${p1}\\n${p2}"`;
        });

        // Fix missing commas between properties
        fixed = fixed.replace(/}(\s*){/g, '},{');
        fixed = fixed.replace(/](\s*)\[/g, '],[');

        return fixed;
    }

    /**
     * Aggressively fix unterminated strings by finding the break point
     */
    private fixUnterminatedStrings(text: string): string {
        const lines = text.split('\n');
        let inString = false;
        let escaped = false;
        let repaired: string[] = [];
        let currentLine = '';

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            const line = lines[lineIdx];
            let chars = line.split('');

            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];

                if (escaped) {
                    currentLine += char;
                    escaped = false;
                    continue;
                }

                if (char === '\\' && inString) {
                    currentLine += char;
                    escaped = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                }

                currentLine += char;
            }

            repaired.push(currentLine);
            currentLine = '';
        }

        // If still in string at end, close it
        let result = repaired.join('\n');
        if (inString) {
            result += '"';
        }

        return result;
    }

    /**
     * Extract specific field from malformed JSON
     */
    extractField(input: string, fieldName: string): string | null {
        // Try to find the field even if JSON is malformed
        const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i');
        const match = input.match(pattern);

        if (match && match[1]) {
            return match[1];
        }

        // Try without quotes (for numbers, booleans)
        const pattern2 = new RegExp(`"${fieldName}"\\s*:\\s*([^,}\\]]+)`, 'i');
        const match2 = input.match(pattern2);

        if (match2 && match2[1]) {
            return match2[1].trim();
        }

        return null;
    }

    /**
     * Extract array field from malformed JSON
     */
    extractArrayField(input: string, fieldName: string): string[] {
        const pattern = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]*)]`, 'i');
        const match = input.match(pattern);

        if (match && match[1]) {
            // Extract items
            const items = match[1].match(/"([^"]*)"/g);
            if (items) {
                return items.map(item => item.replace(/"/g, ''));
            }
        }

        return [];
    }
}

// ============================================
// SINGLETON
// ============================================

let parserInstance: RobustJSONParser | null = null;

export function getRobustJSONParser(): RobustJSONParser {
    if (!parserInstance) {
        parserInstance = new RobustJSONParser();
    }
    return parserInstance;
}
