/**
 * Generated for: Implement user authentication and authorization
 * Agent: database-agent
 * 
 * This is a complete authentication and authorization system for Fastify that includes user registration, login, JWT token management, and role-based access control. The system uses bcrypt for password hashing, JWT for tokens, and @fastify/auth for middleware integration. It provides endpoints for registration, login, profile access, and role-protected routes with proper error handling and TypeScript types.
 */

// src/auth.ts
// Complete authentication and authorization system for Fastify
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { FastifyAuthFunction } from '@fastify/auth';

// Type definitions
export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RegisterBody {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JWTPayload;
}

// In-memory user store (replace with database in production)
const users: Map<string, User> = new Map();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 12;

/**
 * Hashes a password using bcrypt
 * @param password - Plain text password
 * @returns Promise resolving to hashed password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compares a plain text password with a hash
 * @param password - Plain text password
 * @param hash - Hashed password
 * @returns Promise resolving to boolean indicating match
 */
async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a JWT token for a user
 * @param user - User object
 * @returns JWT token string
 */
function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verifies a JWT token
 * @param token - JWT token string
 * @returns Promise resolving to JWT payload
 */
async function verifyToken(token: string): Promise<JWTPayload> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JWTPayload);
      }
    });
  });
}

/**
 * Authentication middleware function
 * @param request - Fastify request object
 * @param reply - Fastify reply object
 */
const authenticate: FastifyAuthFunction = async (request: AuthenticatedRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);
    request.user = payload;
  } catch (error) {
    reply.code(401).send({ error: 'Invalid or expired token' });
  }
};

/**
 * Role-based authorization middleware factory
 * @param allowedRoles - Array of allowed user roles
 * @returns Fastify auth function
 */
function authorize(allowedRoles: UserRole[]): FastifyAuthFunction {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.code(403).send({ error: 'Insufficient permissions' });
      return;
    }
  };
}

/**
 * Registers authentication and authorization routes
 * @param fastify - Fastify instance
 */
async function authRoutes(fastify: FastifyInstance) {
  // Register user
  fastify.post<{ Body: RegisterBody }>('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: Object.values(UserRole) }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, role = UserRole.USER } = request.body;

    // Check if user already exists
    const existingUser = Array.from(users.values()).find(u => u.email === email);
    if (existingUser) {
      reply.code(409).send({ error: 'User already exists' });
      return;
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user: User = {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    users.set(user.id, user);

    // Generate token
    const token = generateToken(user);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    
    reply.code(201).send({
      message: 'User registered successfully',
      user: userWithoutPassword,
      token
    });
  });

  // Login user
  fastify.post<{ Body: LoginBody }>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    // Find user by email
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      reply.code(401).send({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = generateToken(user);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    reply.send({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });
  });

  // Get current user profile
  fastify.get('/profile', {
    preHandler: [authenticate]
  }, async (request: AuthenticatedRequest, reply) => {
    const user = Array.from(users.values()).find(u => u.id === request.user?.userId);
    if (!user) {
      reply.code(404).send({ error: 'User not found' });
      return;
    }

    const { password: _, ...userWithoutPassword } = user;
    reply.send({ user: userWithoutPassword });
  });

  // Admin-only route example
  fastify.get('/admin/users', {
    preHandler: [authenticate, authorize([UserRole.ADMIN])]
  }, async (request, reply) => {
    const allUsers = Array.from(users.values()).map(({ password: _, ...user }) => user);
    reply.send({ users: allUsers });
  });

  // Moderator and Admin route example
  fastify.get('/moderator/dashboard', {
    preHandler: [authenticate, authorize([UserRole.MODERATOR, UserRole.ADMIN])]
  }, async (request, reply) => {
    reply.send({ message: 'Welcome to moderator dashboard' });
  });
}

/**
 * Authentication plugin for Fastify
 * @param fastify - Fastify instance
 * @param options - Plugin options
 */
async function authPlugin(fastify: FastifyInstance, options: any) {
  // Register @fastify/auth
  await fastify.register(import('@fastify/auth'));

  // Register auth routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Decorate fastify instance with auth utilities
  fastify.decorate('authenticate', authenticate);
  fastify.decorate('authorize', authorize);
  fastify.decorate('verifyToken', verifyToken);
}

// Export types and plugin
export { authPlugin, authenticate, authorize, UserRole, User, JWTPayload, AuthenticatedRequest };

// Example usage
if (require.main === module) {
  const fastify = Fastify({ logger: true });

  // Register auth plugin
  fastify.register(authPlugin);

  // Example protected route
  fastify.get('/protected', {
    preHandler: [authenticate]
  }, async (request: AuthenticatedRequest) => {
    return { message: 'This is a protected route', user: request.user };
  });

  // Start server
  const start = async () => {
    try {
      await fastify.listen({ port: 3000, host: '0.0.0.0' });
      console.log('Server listening on http://localhost:3000');
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };

  start();
}

// src/types.ts
export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RegisterBody {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JWTPayload;
}

// package.json
{
  "name": "fastify-auth-system",
  "version": "1.0.0",
  "description": "Complete authentication and authorization system for Fastify",
  "main": "src/auth.ts",
  "scripts": {
    "start": "tsx src/auth.ts",
    "dev": "tsx watch src/auth.ts",
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "@fastify/auth": "^4.3.0",
    "bcryptjs": "^2.4.3",
    "fastify": "^4.21.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.4",
    "@types/jsonwebtoken": "^9.0.3",
    "@types/node": "^20.6.0",
    "tsx": "^3.12.10",
    "typescript": "^5.2.2"
  },
  "keywords": [
    "fastify",
    "authentication",
    "authorization",
    "jwt",
    "bcrypt",
    "typescript"
  ],
  "author": "Your Name",
  "license": "MIT"
}

// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}

// .env.example
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Database (if using external database)
# DATABASE_URL=postgresql://user:password@localhost:5432/authdb