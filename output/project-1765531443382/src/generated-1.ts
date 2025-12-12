/**
 * Generated for: Design database schema for users and tasks
 * Agent: auth-agent
 * 
 * This is a complete database schema implementation for users and tasks using TypeORM with SQLite. The code includes User and Task entities with proper relationships, database configuration, and a Fastify server setup. The User entity has authentication fields and timestamps, while the Task entity includes status and priority fields with a foreign key relationship to users.
 */

// src/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Task } from './task.entity';

/**
 * User entity representing application users
 */
@Entity('users')
export class User {
  /**
   * Unique identifier for the user
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User's email address (must be unique)
   */
  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: false,
  })
  email: string;

  /**
   * Hashed password for authentication
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
    select: false, // Exclude from queries by default
  })
  password: string;

  /**
   * User's display name
   */
  @Column({
    type: 'varchar',
    length: 100,
    nullable: false,
  })
  name: string;

  /**
   * User's role in the system
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'user',
    nullable: false,
  })
  role: 'admin' | 'user';

  /**
   * Whether the user account is active
   */
  @Column({
    type: 'boolean',
    default: true,
    nullable: false,
  })
  isActive: boolean;

  /**
   * Timestamp when user was created
   */
  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  /**
   * Timestamp when user was last updated
   */
  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  /**
   * One-to-many relationship with tasks
   */
  @OneToMany(() => Task, (task) => task.user, {
    cascade: true,
    eager: false,
  })
  tasks: Task[];
}


// src/entities/task.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Task entity representing user tasks
 */
@Entity('tasks')
export class Task {
  /**
   * Unique identifier for the task
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Task title
   */
  @Column({
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  title: string;

  /**
   * Detailed task description
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  description: string;

  /**
   * Current status of the task
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    nullable: false,
  })
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';

  /**
   * Priority level of the task
   */
  @Column({
    type: 'varchar',
    length: 10,
    default: 'medium',
    nullable: false,
  })
  priority: 'low' | 'medium' | 'high' | 'urgent';

  /**
   * Due date for the task
   */
  @Column({
    type: 'timestamp',
    nullable: true,
  })
  dueDate: Date;

  /**
   * Foreign key referencing the user who owns this task
   */
  @Column({
    type: 'uuid',
    nullable: false,
  })
  userId: string;

  /**
   * Many-to-one relationship with user
   */
  @ManyToOne(() => User, (user) => user.tasks, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Timestamp when task was created
   */
  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  /**
   * Timestamp when task was last updated
   */
  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}


// src/config/database.ts
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { Task } from '../entities/task.entity';

/**
 * Database configuration and connection management
 */
export class DatabaseConfig {
  private static instance: DataSource;

  /**
   * Get the singleton database connection instance
   * @returns {DataSource} TypeORM DataSource instance
   */
  public static getInstance(): DataSource {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DataSource({
        type: 'sqlite',
        database: process.env.DB_PATH || './database.sqlite',
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV !== 'production',
        entities: [User, Task],
        migrations: [],
        subscribers: [],
        // SQLite specific options
        driverOptions: {
          // Enable foreign key constraints
          foreignKeys: true,
        },
      });
    }
    return DatabaseConfig.instance;
  }

  /**
   * Initialize database connection
   * @returns {Promise<DataSource>} Initialized DataSource
   * @throws {Error} If connection fails
   */
  public static async initialize(): Promise<DataSource> {
    const dataSource = DatabaseConfig.getInstance();
    
    if (!dataSource.isInitialized) {
      try {
        await dataSource.initialize();
        console.log('Database connection established successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
      }
    }
    
    return dataSource;
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  public static async close(): Promise<void> {
    if (DatabaseConfig.instance && DatabaseConfig.instance.isInitialized) {
      await DatabaseConfig.instance.destroy();
      console.log('Database connection closed');
    }
  }
}


// src/server.ts
import fastify from 'fastify';
import { DatabaseConfig } from './config/database';

/**
 * Application server setup and configuration
 */
async function buildServer() {
  const server = fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      prettyPrint: process.env.NODE_ENV !== 'production',
    },
  });

  // Initialize database connection
  try {
    await DatabaseConfig.initialize();
    server.log.info('Database connection established successfully');
  } catch (error) {
    server.log.error('Failed to initialize database:', error);
    throw error;
  }

  // Health check endpoint
  server.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Database status endpoint
  server.get('/db-status', async () => {
    const dataSource = DatabaseConfig.getInstance();
    return {
      connected: dataSource.isInitialized,
      type: dataSource.options.type,
      database: dataSource.options.database,
    };
  });

  // Graceful shutdown handler
  const gracefulShutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, starting graceful shutdown`);
    
    try {
      await DatabaseConfig.close();
      await server.close();
      server.log.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      server.log.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    server.log.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    server.log.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  return server;
}

// Start server if this file is run directly
if (require.main === module) {
  buildServer().then((server) => {
    server.listen({ 
      port: parseInt(process.env.PORT || '3000'), 
      host: process.env.HOST || '0.0.0.0' 
    }, (err, address) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      console.log(`Server listening at ${address}`);
    });
  });
}

export { buildServer };


// package.json
{
  "name": "user-task-schema",
  "version": "1.0.0",
  "description": "Database schema for users and tasks with Fastify",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^4.24.3",
    "typeorm": "^0.3.17",
    "sqlite3": "^5.1.6",
    "@types/node": "^20.8.0"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "ts-node-dev": "^2.0.0",
    "@types/fastify": "^0.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}


// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": false,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.spec.ts"]
}


// .env.example
# Database configuration
DB_PATH=./database.sqlite

# Server configuration
PORT=3000
HOST=0.0.0.0

# Environment
NODE_ENV=development
LOG_LEVEL=info
