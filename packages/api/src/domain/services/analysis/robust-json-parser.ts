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
     * Enhanced for Phase 23: Better handling of LLM malformed responses
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
        } catch { }

        // Strategy 7: Fix unquoted property names (new for Phase 23)
        cleaned = this.fixUnquotedPropertyNames(cleaned);
        try {
            const data = JSON.parse(cleaned) as T;
            return { success: true, data, repairAttempted: true };
        } catch { }

        // Strategy 8: Try to extract files array from malformed response (for code generation)
        const extractedData = this.extractFilesFromMalformed<T>(input);
        if (extractedData) {
            return { success: true, data: extractedData, repairAttempted: true };
        }

        // Strategy 9: Deep search for any valid JSON object
        const deepExtracted = this.deepExtractJSON<T>(input);
        if (deepExtracted) {
            return { success: true, data: deepExtracted, repairAttempted: true };
        }

        return {
            success: false,
            error: 'All repair strategies failed',
            originalLength,
        };
    }

    /**
     * Fix unquoted property names (common LLM mistake)
     */
    private fixUnquotedPropertyNames(text: string): string {
        // Match patterns like { path: "..." } and convert to { "path": "..." }
        return text.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    }

    /**
     * Extract files array from malformed response (for code generation specifically)
     */
    private extractFilesFromMalformed<T>(input: string): T | null {
        try {
            // Try to find "files" array pattern
            const filesMatch = input.match(/"files"\s*:\s*\[([\s\S]*)/);
            if (filesMatch) {
                let filesContent = filesMatch[1];

                // Find all file objects
                const files: Array<{ path: string; content: string }> = [];
                const filePattern = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
                let match;

                while ((match = filePattern.exec(filesContent)) !== null) {
                    files.push({
                        path: match[1],
                        content: match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
                    });
                }

                if (files.length > 0) {
                    // Try to extract code and explanation too
                    const codeMatch = input.match(/"code"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
                    const explanationMatch = input.match(/"explanation"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);

                    const result = {
                        code: codeMatch ? codeMatch[1] : 'Generated code',
                        explanation: explanationMatch ? explanationMatch[1] : 'Generated code',
                        files,
                    };

                    return result as T;
                }
            }
        } catch {
            // Extraction failed, return null
        }
        return null;
    }

    /**
     * Deep search for any valid JSON object in the input
     */
    private deepExtractJSON<T>(input: string): T | null {
        // Try multiple bracket positions
        const possibleStarts = [];
        let idx = 0;
        while ((idx = input.indexOf('{', idx)) !== -1) {
            possibleStarts.push(idx);
            idx++;
        }

        // Try each starting position
        for (const start of possibleStarts) {
            let depth = 0;
            let inString = false;
            let escaped = false;

            for (let i = start; i < input.length; i++) {
                const char = input[i];

                if (escaped) {
                    escaped = false;
                    continue;
                }

                if (char === '\\' && inString) {
                    escaped = true;
                    continue;
                }

                if (char === '"') {
                    inString = !inString;
                    continue;
                }

                if (!inString) {
                    if (char === '{') depth++;
                    if (char === '}') depth--;

                    if (depth === 0) {
                        // Found a balanced object
                        const candidate = input.substring(start, i + 1);
                        try {
                            const parsed = JSON.parse(candidate) as T;
                            // Only return if it looks like a valid response (has expected properties)
                            if (typeof parsed === 'object' && parsed !== null) {
                                const hasValidProps = 'files' in parsed || 'code' in parsed ||
                                    'complexity' in parsed || 'intent' in parsed;
                                if (hasValidProps) {
                                    return parsed;
                                }
                            }
                        } catch {
                            // Not valid JSON, try next
                        }
                        break;
                    }
                }
            }
        }

        return null;
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
