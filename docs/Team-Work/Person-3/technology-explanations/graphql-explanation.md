# GraphQL - Complete Guide

## 🌟 What Is GraphQL?

GraphQL is a query language and runtime for APIs that gives clients the power to ask for exactly what they need and nothing more. Think of it as **a smart restaurant where you can order exactly the dishes you want, in the portions you want, instead of getting a fixed menu**.

### **The Restaurant Analogy**
- **REST API**: Fixed menu - you order "Combo #1" and get everything included
- **GraphQL**: À la carte - you order exactly what you want, how you want it

### **Core Philosophy**
- **Declarative Data Fetching**: Clients specify exactly what data they need
- **Single Endpoint**: One URL for all data operations
- **Strong Typing**: Schema defines the contract between client and server
- **Introspection**: Clients can discover the API structure

## 🎯 Why We Use GraphQL in This Project

### **Perfect for API Generation**
GraphQL's schema-first approach makes it ideal for generating APIs:
- **Schema Definition**: Clear contract for generated APIs
- **Type Safety**: Automatic TypeScript generation
- **Flexible Queries**: Clients can request exactly what they need
- **Single Endpoint**: Simplifies API management

### **Developer Experience Benefits**
- **No Over/Under Fetching**: Get exactly the data you need
- **Strong Typing**: Compile-time error checking
- **Auto Documentation**: Schema serves as documentation
- **Tooling**: Excellent developer tools and ecosystem

### **Enterprise-Ready Features**
- **Performance**: Efficient data loading with batching
- **Scalability**: Handles complex data relationships
- **Real-time**: Built-in subscription support
- **Versioning**: Schema evolution without breaking changes

## 🏗️ Key Features & Concepts

### **1. Schema Definition**
The schema defines the contract between client and server.

```graphql
# Basic schema definition
type User {
  id: ID!
  email: String!
  name: String!
  posts: [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  comments: [Comment!]!
  createdAt: DateTime!
}

type Comment {
  id: ID!
  content: String!
  author: User!
  post: Post!
  createdAt: DateTime!
}

type Query {
  users: [User!]!
  user(id: ID!): User
  posts: [Post!]!
  post(id: ID!): Post
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  createPost(input: CreatePostInput!): Post!
  createComment(input: CreateCommentInput!): Comment!
}

type Subscription {
  postCreated: Post!
  commentAdded(postId: ID!): Comment!
}

# Input types for mutations
input CreateUserInput {
  email: String!
  name: String!
}

input CreatePostInput {
  title: String!
  content: String!
  authorId: ID!
}

input CreateCommentInput {
  content: String!
  postId: ID!
  authorId: ID!
}

# Custom scalar types
scalar DateTime
```

**Schema Benefits:**
- **Type Safety**: All data types are explicitly defined
- **Self-Documenting**: Schema serves as API documentation
- **Tooling Support**: Auto-generated types and documentation
- **Validation**: Built-in type validation

### **2. Queries**
Queries allow clients to request exactly the data they need.

```graphql
# Basic query
query GetUser {
  user(id: "123") {
    id
    name
    email
  }
}

# Query with nested data
query GetUserWithPosts {
  user(id: "123") {
    id
    name
    email
    posts {
      id
      title
      content
      createdAt
    }
  }
}

# Query with arguments and variables
query GetUsers($limit: Int, $offset: Int) {
  users(limit: $limit, offset: $offset) {
    id
    name
    email
    posts {
      id
      title
    }
  }
}

# Query with fragments for reusable selections
fragment UserFields on User {
  id
  name
  email
}

query GetUsers {
  users {
    ...UserFields
    posts {
      id
      title
    }
  }
}
```

### **3. Mutations**
Mutations are used for data modifications.

```graphql
# Create a new user
mutation CreateUser {
  createUser(input: {
    email: "john@example.com"
    name: "John Doe"
  }) {
    id
    email
    name
    createdAt
  }
}

# Create a post with nested user creation
mutation CreatePostWithUser {
  createUser(input: {
    email: "jane@example.com"
    name: "Jane Doe"
  }) {
    id
    name
  }
  
  createPost(input: {
    title: "My First Post"
    content: "Hello, world!"
    authorId: "new-user-id"
  }) {
    id
    title
    author {
      name
    }
  }
}

# Multiple mutations in one request
mutation CreateMultiple {
  createUser(input: { email: "bob@example.com", name: "Bob" }) {
    id
    name
  }
  
  createPost(input: {
    title: "Another Post"
    content: "More content"
    authorId: "user-id"
  }) {
    id
    title
  }
}
```

### **4. Subscriptions**
Subscriptions enable real-time data updates.

```graphql
# Subscribe to new posts
subscription PostCreated {
  postCreated {
    id
    title
    author {
      name
    }
    createdAt
  }
}

# Subscribe to comments on a specific post
subscription CommentAdded($postId: ID!) {
  commentAdded(postId: $postId) {
    id
    content
    author {
      name
    }
    createdAt
  }
}

# Subscribe to user updates
subscription UserUpdated($userId: ID!) {
  userUpdated(userId: $userId) {
    id
    name
    email
    updatedAt
  }
}
```

### **5. Resolvers**
Resolvers are functions that implement the schema operations.

```typescript
// User resolver
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly postService: PostService,
  ) {}

  // Query resolvers
  @Query(() => [User])
  async users(): Promise<User[]> {
    return this.userService.findAll();
  }

  @Query(() => User, { nullable: true })
  async user(@Args('id') id: string): Promise<User | null> {
    return this.userService.findById(id);
  }

  // Mutation resolvers
  @Mutation(() => User)
  async createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.userService.create(input);
  }

  // Field resolvers for nested data
  @ResolveField(() => [Post])
  async posts(@Parent() user: User): Promise<Post[]> {
    return this.postService.findByAuthorId(user.id);
  }
}

// Post resolver
@Resolver(() => Post)
export class PostResolver {
  constructor(
    private readonly postService: PostService,
    private readonly userService: UserService,
  ) {}

  @Query(() => [Post])
  async posts(): Promise<Post[]> {
    return this.postService.findAll();
  }

  @Query(() => Post, { nullable: true })
  async post(@Args('id') id: string): Promise<Post | null> {
    return this.postService.findById(id);
  }

  @Mutation(() => Post)
  async createPost(@Args('input') input: CreatePostInput): Promise<Post> {
    return this.postService.create(input);
  }

  @ResolveField(() => User)
  async author(@Parent() post: Post): Promise<User> {
    return this.userService.findById(post.authorId);
  }
}

// Subscription resolver
@Resolver(() => Post)
export class PostSubscriptionResolver {
  constructor(private readonly pubSub: PubSub) {}

  @Subscription(() => Post)
  postCreated() {
    return this.pubSub.asyncIterator('postCreated');
  }
}
```

## 🚀 Deep Dive: Technical Implementation

### **Apollo Server Integration**
```typescript
// GraphQL module configuration
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req, res }) => ({
        req,
        res,
        user: req.user, // From authentication middleware
      }),
      plugins: [
        // Logging plugin
        new ApolloServerPluginLandingPageLocalDefault(),
        // Performance monitoring
        new ApolloServerPluginUsageReporting(),
      ],
      validationRules: [
        // Custom validation rules
        NoDeactivatedRule,
        QueryComplexity({
          maximumComplexity: 100,
          variables: {},
          onComplete: (complexity: number) => {
            console.log(`Query Complexity: ${complexity}`);
          },
        }),
      ],
      formatError: (error: GraphQLError) => {
        // Custom error formatting
        return {
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          path: error.path,
          locations: error.locations,
        };
      },
    }),
  ],
})
export class GraphQLModule {}
```

### **Data Loader for N+1 Problem**
```typescript
// DataLoader implementation to solve N+1 queries
@Injectable()
export class DataLoaderService {
  private readonly userLoader = new DataLoader<string, User>(
    async (ids: string[]) => {
      const users = await this.userService.findByIds(ids);
      return ids.map(id => users.find(user => user.id === id));
    },
  );

  private readonly postLoader = new DataLoader<string, Post>(
    async (ids: string[]) => {
      const posts = await this.postService.findByIds(ids);
      return ids.map(id => posts.find(post => post.id === id));
    },
  );

  getUserById(id: string): Promise<User> {
    return this.userLoader.load(id);
  }

  getPostById(id: string): Promise<Post> {
    return this.postLoader.load(id);
  }

  // Batch loading for relationships
  getPostsByAuthorIds(authorIds: string[]): Promise<Post[][]> {
    return this.postLoader.loadMany(authorIds);
  }
}

// Updated resolver with DataLoader
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly dataLoaderService: DataLoaderService,
  ) {}

  @ResolveField(() => [Post])
  async posts(@Parent() user: User): Promise<Post[]> {
    return this.dataLoaderService.getPostsByAuthorIds([user.id]);
  }
}
```

### **Custom Directives**
```typescript
// Custom directive for authentication
@Directive(() => GraphQLString)
export class UpperCaseDirective {
  transform(value: string): string {
    return value.toUpperCase();
  }
}

// Custom directive for authorization
@Directive(() => GraphQLBoolean)
export class AuthDirective {
  constructor(private readonly reflector: Reflector) {}

  transform(value: any, args: any, context: any): boolean {
    const requiredRoles = args.roles;
    const user = context.user;
    
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    
    return requiredRoles.includes(user.role);
  }
}

// Usage in schema
type User {
  id: ID!
  email: String! @uppercase
  name: String! @auth(roles: ["admin", "user"])
  secretData: String! @auth(roles: ["admin"])
}
```

### **Query Complexity Analysis**
```typescript
// Query complexity configuration
const complexityRule = QueryComplexity({
  maximumComplexity: 100,
  variables: {},
  onCreateCostEstimator: (type: string, complexity: number) => {
    // Custom cost estimation
    if (type === 'User') return complexity + 1;
    if (type === 'Post') return complexity + 2;
    return complexity;
  },
  onComplete: (complexity: number) => {
    console.log(`Query completed with complexity: ${complexity}`);
  },
  onEstimateError: (error: Error) => {
    console.error('Complexity estimation error:', error);
  },
  onComplexityError: (error: Error) => {
    throw new Error(`Query is too complex: ${error.message}`);
  },
});
```

### **Caching Strategy**
```typescript
// Redis-based caching for GraphQL
@Injectable()
export class GraphQLCacheService {
  constructor(private readonly redis: Redis) {}

  // Cache resolver results
  async cacheResult(key: string, result: any, ttl: number = 300): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(result));
  }

  // Get cached result
  async getCachedResult(key: string): Promise<any | null> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  // Generate cache key
  generateCacheKey(operation: string, variables: any): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(variables))
      .digest('hex');
    return `graphql:${operation}:${hash}`;
  }

  // Clear cache for specific type
  async clearTypeCache(type: string): Promise<void> {
    const keys = await this.redis.keys(`graphql:*${type}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Cached resolver
@Resolver(() => User)
export class CachedUserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly cacheService: GraphQLCacheService,
  ) {}

  @Query(() => User, { nullable: true })
  async user(@Args('id') id: string): Promise<User | null> {
    const cacheKey = this.cacheService.generateCacheKey('user', { id });
    
    // Try cache first
    let user = await this.cacheService.getCachedResult(cacheKey);
    
    if (!user) {
      user = await this.userService.findById(id);
      if (user) {
        await this.cacheService.cacheResult(cacheKey, user, 300); // 5 minutes
      }
    }
    
    return user;
  }
}
```

## 💻 Code Examples

### **Complete GraphQL Module Setup**
```typescript
// graphql.module.ts
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      sortSchema: true,
      playground: {
        settings: {
          'request.credentials': 'include',
        },
      },
      context: ({ req, res }) => ({
        req,
        res,
        loaders: new DataLoaderService(),
        cache: new GraphQLCacheService(redis),
      }),
      plugins: [
        new ApolloServerPluginLandingPageLocalDefault(),
        new ApolloServerPluginUsageReporting({
          endpointUrl: '/graphql',
          headerName: 'x-apollo-reporting',
        }),
      ],
      validationRules: [
        NoDeactivatedRule,
        QueryComplexity({
          maximumComplexity: 100,
        }),
      ],
    }),
  ],
})
export class GraphQLModule {}
```

### **Advanced Query Examples**
```typescript
// Complex query with multiple relationships
const GET_USER_WITH_RELATIONSHIPS = `
  query GetUserWithRelationships($userId: ID!, $postLimit: Int) {
    user(id: $userId) {
      id
      name
      email
      avatar
      posts(limit: $postLimit) {
        id
        title
        content
        createdAt
        comments {
          id
          content
          author {
            name
            avatar
          }
          createdAt
        }
        likes {
          id
          user {
            name
          }
          createdAt
        }
      }
      followers {
        id
        name
        avatar
      }
      following {
        id
        name
        avatar
      }
    }
  }
`;

// Query with variables
const variables = {
  userId: '123',
  postLimit: 10,
};

// Execute query
const result = await apolloClient.query({
  query: GET_USER_WITH_RELATIONSHIPS,
  variables,
});
```

### **Real-time Subscription Implementation**
```typescript
// Subscription with filtering
const POST_CREATED_SUBSCRIPTION = `
  subscription PostCreated($filters: PostFilters) {
    postCreated(filters: $filters) {
      id
      title
      content
      author {
        id
        name
        avatar
      }
      createdAt
    }
  }
`;

// Subscribe with filters
const subscription = apolloClient.subscribe({
  query: POST_CREATED_SUBSCRIPTION,
  variables: {
    filters: {
      authorId: '123',
      categories: ['technology', 'programming'],
    },
  },
}).subscribe({
  next: (data) => {
    console.log('New post created:', data);
  },
  error: (error) => {
    console.error('Subscription error:', error);
  },
});
```

## 🔗 Integration with Our Stack

### **With NestJS**
```typescript
// GraphQL integration with NestJS modules
@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: 'schema.gql',
      context: ({ req }) => ({ user: req.user }),
    }),
    UserModule,
    PostModule,
  ],
})
export class AppModule {}
```

### **With TypeScript**
```typescript
// Auto-generated types from GraphQL schema
export interface User {
  id: string;
  email: string;
  name: string;
  posts?: Post[];
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  name: string;
}

// Typed GraphQL hooks
export const useUserQuery = (id: string) => {
  return useQuery<GetUser, GetUserVariables>(GET_USER, {
    variables: { id },
  });
};
```

### **With Database (Prisma)**
```typescript
// Prisma integration with GraphQL
@Resolver(() => User)
export class UserResolver {
  constructor(private readonly prisma: PrismaService) {}

  @Query(() => [User])
  async users(): Promise<User[]> {
    return this.prisma.user.findMany({
      include: {
        posts: true,
      },
    });
  }

  @Mutation(() => User)
  async createUser(@Args('input') input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: input,
    });
  }
}
```

## 📚 Additional Resources

### **Official Documentation**
- [GraphQL Specification](https://spec.graphql.org/)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [GraphQL Code Generator](https://www.graphql-code-generator.com/)

### **Tools & Libraries**
- [GraphQL Playground](https://github.com/graphql/graphql-playground)
- [GraphiQL](https://github.com/graphql/graphiql)
- [Apollo Client](https://www.apollographql.com/docs/react/)
- [Relay](https://relay.dev/)

### **Learning Resources**
- [GraphQL Tutorials](https://www.graphql.com/tutorials/)
- [How to GraphQL](https://www.howtographql.com/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)

---

**🎯 GraphQL provides powerful, flexible, and efficient API capabilities that perfectly complement our API generation platform, enabling clients to request exactly what they need while maintaining strong type safety and excellent developer experience.**