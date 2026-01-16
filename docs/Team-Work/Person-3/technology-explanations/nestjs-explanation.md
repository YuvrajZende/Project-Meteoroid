# NestJS - Complete Guide

## 🌟 What Is NestJS?

NestJS is a progressive Node.js framework for building efficient, reliable, and scalable server-side applications. Think of it as **Angular for backend development** - it provides structure, organization, and powerful tools out of the box.

### **The Restaurant Analogy**
Imagine building a restaurant:
- **Express.js** gives you raw ingredients and a kitchen (you decide everything)
- **NestJS** gives you a complete restaurant management system with organized kitchen stations, staff roles, and service workflows

### **Core Philosophy**
- **Modularity**: Organize code into logical modules
- **Dependency Injection**: Automatic management of component dependencies
- **TypeScript First**: Built-in TypeScript support for type safety
- **Architecture Patterns**: Encourages clean, maintainable code structure

## 🎯 Why We Use NestJS in This Project

### **Perfect for API Generation**
NestJS's modular structure makes it ideal for generating APIs:
- **Modules** map naturally to API features
- **Controllers** handle HTTP requests elegantly
- **Services** contain business logic
- **Guards** handle authentication and authorization

### **Developer Experience Benefits**
- **Code Generation**: Built-in CLI for rapid development
- **Type Safety**: Full TypeScript integration
- **Testing**: Comprehensive testing utilities
- **Documentation**: Automatic API documentation with Swagger

### **Enterprise-Ready Features**
- **Scalability**: Microservices architecture support
- **Performance**: Optimized for high-throughput applications
- **Security**: Built-in security best practices
- **Monitoring**: Integration with monitoring tools

## 🏗️ Key Features & Concepts

### **1. Modules**
Modules are the basic building blocks of a NestJS application.

```typescript
// Basic module structure
@Module({
  imports: [OtherModule],        // Import dependencies
  controllers: [AppController],  // Define controllers
  providers: [AppService],       // Define services
  exports: [AppService],         // Export for other modules
})
export class AppModule {}
```

**Why Modules Matter:**
- **Organization**: Group related functionality
- **Encapsulation**: Hide implementation details
- **Reusability**: Share modules across applications
- **Lazy Loading**: Load modules only when needed

### **2. Controllers**
Controllers handle incoming HTTP requests and return responses.

```typescript
@Controller('users')  // Route prefix: /users
export class UserController {
  @Get()             // GET /users
  getUsers(): User[] {
    return this.userService.getUsers();
  }

  @Get(':id')        // GET /users/:id
  getUser(@Param('id') id: string): User {
    return this.userService.getUser(id);
  }

  @Post()            // POST /users
  createUser(@Body() createUserDto: CreateUserDto): User {
    return this.userService.createUser(createUserDto);
  }
}
```

**Controller Features:**
- **Routing**: Define HTTP methods and paths
- **Parameters**: Extract data from requests
- **Validation**: Automatic DTO validation
- **Documentation**: Auto-generate API docs

### **3. Services**
Services contain business logic and are injectable throughout the application.

```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly emailService: EmailService,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user = new this.userModel(createUserDto);
    await user.save();
    
    await this.emailService.sendWelcomeEmail(user.email);
    return user;
  }
}
```

**Service Benefits:**
- **Business Logic**: Separate from HTTP handling
- **Dependency Injection**: Automatic dependency management
- **Testability**: Easy to unit test
- **Reusability**: Use across multiple controllers

### **4. Dependency Injection (DI)**
NestJS uses DI to manage component dependencies automatically.

```typescript
// Service that depends on other services
@Injectable()
export class OrderService {
  constructor(
    private readonly userService: UserService,
    private readonly paymentService: PaymentService,
    private readonly notificationService: NotificationService,
  ) {}
}

// NestJS automatically provides the dependencies
```

**DI Advantages:**
- **Loose Coupling**: Components don't create their dependencies
- **Testability**: Easy to mock dependencies
- **Maintainability**: Centralized dependency management
- **Flexibility**: Easy to swap implementations

### **5. Guards**
Guards implement authentication and authorization logic.

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    
    return this.validateToken(token);
  }
}

// Apply to routes
@UseGuards(AuthGuard)
@Controller('protected')
export class ProtectedController {
  @Get('data')
  getProtectedData() {
    return { message: 'This is protected data' };
  }
}
```

### **6. Interceptors**
Interceptors transform requests and responses.

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    console.log(`Incoming request: ${request.method} ${request.url}`);
    
    const now = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`Response sent in ${Date.now() - now}ms`)),
    );
  }
}
```

## 🚀 Deep Dive: Technical Implementation

### **Application Lifecycle**
Understanding how NestJS applications start and run:

```typescript
// main.ts - Application bootstrap
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global configurations
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  // Enable CORS
  app.enableCors();
  
  // Start listening
  await app.listen(3000);
}
```

**Bootstrap Process:**
1. **Module Resolution**: Scan and register all modules
2. **Dependency Graph**: Build dependency injection graph
3. **Instance Creation**: Create all providers and controllers
4. **Server Setup**: Configure HTTP server
5. **Listen**: Start accepting requests

### **Advanced Module Patterns**

#### **Dynamic Modules**
Modules that accept configuration:

```typescript
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: 'DATABASE_OPTIONS',
          useValue: options,
        },
        DatabaseService,
      ],
      exports: [DatabaseService],
      global: true,
    };
  }
}

// Usage
@Module({
  imports: [
    DatabaseModule.forRoot({
      host: 'localhost',
      port: 5432,
      database: 'myapp',
    }),
  ],
})
export class AppModule {}
```

#### **Circular Dependencies**
Handling circular dependencies with forward reference:

```typescript
@Injectable()
export class ServiceA {
  constructor(
    @Inject(forwardRef(() => ServiceB))
    private readonly serviceB: ServiceB,
  ) {}
}

@Injectable()
export class ServiceB {
  constructor(
    @Inject(forwardRef(() => ServiceA))
    private readonly serviceA: ServiceA,
  ) {}
}
```

### **Performance Optimization**

#### **Lazy Loading Modules**
Load modules only when needed:

```typescript
// In app.module.ts
@Module({
  imports: [
    // Eager loading
    CoreModule,
    
    // Lazy loading
    {
      path: 'admin',
      loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    },
  ],
})
export class AppModule {}
```

#### **Caching with Redis**
Implement caching for better performance:

```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getUser(id: string): Promise<User> {
    // Check cache first
    const cacheKey = `user_${id}`;
    let user = await this.cacheManager.get<User>(cacheKey);
    
    if (!user) {
      // Fetch from database
      user = await this.userModel.findById(id).exec();
      
      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, user, { ttl: 3600 });
    }
    
    return user;
  }
}
```

### **Testing Strategies**

#### **Unit Testing Services**
```typescript
describe('UserService', () => {
  let service: UserService;
  let userModel: Model<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userModel = module.get<Model<User>>(getModelToken(User.name));
  });

  it('should return user when found', async () => {
    const user = { id: '1', name: 'John Doe' };
    jest.spyOn(userModel, 'findById').mockResolvedValue(user as any);

    const result = await service.getUser('1');
    expect(result).toEqual(user);
  });
});
```

#### **Integration Testing Controllers**
```typescript
describe('UserController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users (GET)', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
```

## 💻 Code Examples

### **Complete CRUD Module**
```typescript
// user.module.ts
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}

// user.controller.ts
@Controller('users')
@ApiTags('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.createUser(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(): Promise<User[]> {
    return this.userService.getUsers();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  async getUser(@Param('id') id: string): Promise<User> {
    return this.userService.getUser(id);
  }
}

// user.service.ts
@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const user = new this.userModel(createUserDto);
    return user.save();
  }

  async getUsers(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  async getUser(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
```

### **Custom Decorators**
```typescript
// Create custom decorator for user extraction
export const User = createParamDecorator(
  (data: string, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    return data ? user?.[data] : user;
  },
);

// Usage in controller
@Get('profile')
getProfile(@User() user: User): User {
  return user;
}

@Get('profile/email')
getEmail(@User('email') email: string): { email: string } {
  return { email };
}
```

## 🔗 Integration with Our Stack

### **With TypeScript**
NestJS is built with TypeScript first:
- **Type Safety**: Full compile-time type checking
- **Decorators**: Metadata for dependency injection
- **Interfaces**: Strong contracts between components
- **Generics**: Type-safe generic components

### **With MongoDB/Mongoose**
```typescript
// Database configuration
@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
})
export class DatabaseModule {}
```

### **With GraphQL**
```typescript
// GraphQL module setup
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      playground: true,
      context: ({ req }) => ({ user: req.user }),
    }),
  ],
})
export class GraphQLModule {}
```

### **With Swagger/OpenAPI**
```typescript
// Swagger configuration
const config = new DocumentBuilder()
  .setTitle('API Documentation')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

## 📚 Additional Resources

### **Official Documentation**
- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS CLI](https://docs.nestjs.com/cli/overview)
- [NestJS Recipes](https://docs.nestjs.com/recipes)

### **Community Resources**
- [NestJS Discord](https://discord.gg/G7Qnnhy)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/nestjs)
- [GitHub Discussions](https://github.com/nestjs/nest/discussions)

### **Learning Path**
1. **Start with**: Official documentation - Getting Started
2. **Practice**: Build a simple CRUD API
3. **Advanced**: Learn about microservices and GraphQL
4. **Production**: Study deployment and monitoring

---

**🎯 NestJS provides the perfect foundation for our API generation platform with its modular architecture, TypeScript support, and extensive ecosystem.**