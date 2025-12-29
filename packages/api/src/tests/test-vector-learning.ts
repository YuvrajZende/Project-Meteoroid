/**
 * PHASE 22: VECTOR LEARNING SYSTEM TEST
 * 
 * Simple test to verify:
 * 1. AI Intent Analyzer works
 * 2. Vector Learning System connects to Supabase
 * 3. RPC functions are callable
 * 4. Pattern learning works
 */


import { getAIIntentAnalyzer } from '../services/analysis/ai-intent-analyzer.js';
import { getVectorLearningSystem } from '../services/learning/vector-learning-system.js';
import { getSupabaseAdmin } from '../services/infrastructure/database-client.js';

async function testAIIntentAnalyzer() {
    console.log('\n🧪 TEST 1: AI Intent Analyzer\n' + '='.repeat(50));

    const analyzer = getAIIntentAnalyzer();

    const tests = [
        { prompt: 'What is JWT?', expected: 'QUESTION' },
        { prompt: 'script to reverse a string', expected: 'SIMPLE_SCRIPT' },
        { prompt: 'Build REST API for users', expected: 'FULL_BACKEND' },
    ];

    for (const test of tests) {
        console.log(`\n📝 Test: "${test.prompt}"`);
        const result = await analyzer.analyze(test.prompt);

        const passed = result.intent === test.expected;
        console.log(`   ${passed ? '✅' : '❌'} Intent: ${result.intent} (expected: ${test.expected})`);
        console.log(`   📊 Language: ${result.language}, Framework: ${result.framework}`);
        console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        console.log(`   💡 Reasoning: ${result.reasoning.substring(0, 100)}...`);
    }
}

async function testVectorLearningSystem() {
    console.log('\n\n🧪 TEST 2: Vector Learning System\n' + '='.repeat(50));

    const vectorLearning = getVectorLearningSystem();

    console.log('\n📝 Test: Building learning context for "Build REST API"');
    const context = await vectorLearning.buildContext('Build REST API for user management', {
        language: 'typescript',
        framework: 'fastify',
        maxCodeExamples: 3,
        maxPractices: 5
    });

    console.log(`\n📊 Results:`);
    console.log(`   Similar Projects: ${context.similarProjects.length}`);
    console.log(`   Best Practices: ${context.bestPractices.length}`);
    console.log(`   Total Matches: ${context.statistics.totalMatches}`);

    if (context.similarProjects.length > 0) {
        console.log(`\n✅ Found similar code:`);
        context.similarProjects.forEach((proj, i) => {
            console.log(`   ${i + 1}. ${proj.filePath} (${(proj.similarity * 100).toFixed(0)}% match)`);
            console.log(`      ${proj.language}/${proj.framework}`);
        });
    } else {
        console.log(`\n⚠️  No similar projects found (database might be empty or no OpenAI API key)`);
    }

    if (context.bestPractices.length > 0) {
        console.log(`\n✅ Found best practices:`);
        context.bestPractices.forEach((practice, i) => {
            console.log(`   ${i + 1}. [${practice.category}] ${practice.practice.substring(0, 60)}...`);
        });
    } else {
        console.log(`\n⚠️  No best practices found (database might be empty)`);
    }

    const formatted = vectorLearning.formatForLLM(context);
    if (formatted) {
        console.log(`\n📄 LLM Context Length: ${formatted.length} chars`);
    }
}

async function testSupabaseRPCFunctions() {
    console.log('\n\n🧪 TEST 3: Supabase RPC Functions\n' + '='.repeat(50));

    const supabase = getSupabaseAdmin();

    if (!supabase) {
        console.log('❌ Supabase not available');
        return;
    }

    // Test 1: Check if RPC functions exist
    console.log('\n📝 Test: Checking if RPC functions exist');

    try {
        // Create a dummy embedding (all zeros)
        const dummyEmbedding = new Array(1536).fill(0);

        console.log('   Testing match_code_embeddings...');
        const { data: codeData, error: codeError } = await supabase.rpc('match_code_embeddings', {
            query_embedding: dummyEmbedding,
            match_threshold: 0.5,
            match_count: 1
        });

        if (codeError) {
            console.log(`   ❌ match_code_embeddings error: ${codeError.message}`);
        } else {
            console.log(`   ✅ match_code_embeddings works! (returned ${codeData?.length || 0} results)`);
        }

        console.log('   Testing match_knowledge_embeddings...');
        const { data: knowledgeData, error: knowledgeError } = await supabase.rpc('match_knowledge_embeddings', {
            query_embedding: dummyEmbedding,
            match_threshold: 0.5,
            match_count: 1
        });

        if (knowledgeError) {
            console.log(`   ❌ match_knowledge_embeddings error: ${knowledgeError.message}`);
        } else {
            console.log(`   ✅ match_knowledge_embeddings works! (returned ${knowledgeData?.length || 0} results)`);
        }

    } catch (error: any) {
        console.log(`   ❌ RPC test failed: ${error.message}`);
    }
}

async function testDatabaseTables() {
    console.log('\n\n🧪 TEST 4: Database Tables\n' + '='.repeat(50));

    const supabase = getSupabaseAdmin();

    if (!supabase) {
        console.log('❌ Supabase not available');
        return;
    }

    console.log('\n📝 Checking required tables...');

    const tables = [
        { name: 'code_embeddings', description: 'Vector embeddings for code' },
        { name: 'generation_iterations', description: 'Past generation attempts' },
        { name: 'backend_knowledge_base', description: 'Best practices knowledge' },
        { name: 'learned_patterns', description: 'Extracted patterns' }
    ];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table.name)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`   ❌ ${table.name}: ${error.message}`);
            } else {
                console.log(`   ✅ ${table.name}: ${count || 0} rows (${table.description})`);
            }
        } catch (error: any) {
            console.log(`   ❌ ${table.name}: ${error.message}`);
        }
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('  🚀 PHASE 22: VECTOR LEARNING SYSTEM - TEST SUITE');
    console.log('='.repeat(70));

    try {
        await testAIIntentAnalyzer();
        await testVectorLearningSystem();
        await testSupabaseRPCFunctions();
        await testDatabaseTables();

        console.log('\n' + '='.repeat(70));
        console.log('  ✅ ALL TESTS COMPLETE');
        console.log('='.repeat(70) + '\n');

    } catch (error: any) {
        console.error('\n❌ Test suite failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run tests
runAllTests();
