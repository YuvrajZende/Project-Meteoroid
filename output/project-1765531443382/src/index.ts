/**
 * Generated Project Entry Point
 * Created by Loveable Backend Orchestrator
 */

import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/', async () => {
    return { message: 'Generated API is running!' };
});

const start = async () => {
    try {
        await app.listen({ port: 3001, host: '0.0.0.0' });
        console.log('Server running on http://localhost:3001');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
