/**
 * ============================================
 * LANGUAGE CONFIGURATIONS
 * ============================================
 * 
 * Comprehensive configurations for multi-language code generation:
 * - TypeScript (npm)
 * - Python (pip/poetry)
 * - Go (go mod)
 * - Rust (cargo)
 * - Java (maven/gradle)
 * - C++ (cmake)
 * - C# (dotnet)
 * - Ruby (bundler)
 * - PHP (composer)
 * - Kotlin (gradle)
 * - Swift (swift package manager)
 */

// ============================================
// TYPES
// ============================================

export type SupportedLanguage =
    | 'typescript' | 'python' | 'go' | 'rust' | 'java'
    | 'cpp' | 'csharp' | 'ruby' | 'php' | 'kotlin' | 'swift';

export type SupportedFramework =
    // TypeScript
    | 'express' | 'fastify' | 'nestjs' | 'nextjs'
    // Python
    | 'fastapi' | 'django' | 'flask'
    // Go
    | 'gin' | 'echo' | 'fiber'
    // Rust
    | 'actix' | 'rocket' | 'axum'
    // Java
    | 'spring' | 'quarkus' | 'micronaut'
    // C++
    | 'drogon' | 'crow'
    // C#
    | 'aspnet'
    // Ruby
    | 'rails' | 'sinatra'
    // PHP
    | 'laravel' | 'symfony'
    // Kotlin
    | 'ktor' | 'spring-kotlin'
    // Swift
    | 'vapor';

export interface DatabaseORMConfig {
    name: string;
    id: string;
    dependencies: string[];
    modelPattern: string;
    migrationPattern: string;
    connectionPattern: string;
}

export interface LanguageConfig {
    name: string;
    extensions: string[];
    packageManager: string;
    installCommand: string;
    devCommand: string;
    buildCommand: string;
    testCommand: string;
    configFiles: string[];
    frameworks: FrameworkConfig[];
    databaseORMs: DatabaseORMConfig[];
    commentSyntax: { single: string; multiStart: string; multiEnd: string };
}

export interface FrameworkConfig {
    name: string;
    id: SupportedFramework;
    directories: string[];
    entryPoint: string;
    dependencies: string[];
    devDependencies?: string[];
    routePattern: string;
    middlewarePattern: string;
}

// ============================================
// LANGUAGE CONFIGURATIONS
// ============================================

export const LANGUAGE_CONFIGS: Record<SupportedLanguage, LanguageConfig> = {
    typescript: {
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        packageManager: 'npm',
        installCommand: 'npm install',
        devCommand: 'npm run dev',
        buildCommand: 'npm run build',
        testCommand: 'npm test',
        configFiles: ['package.json', 'tsconfig.json'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Express',
                id: 'express',
                directories: ['src', 'src/routes', 'src/controllers', 'src/services', 'src/middleware'],
                entryPoint: 'src/index.ts',
                dependencies: ['express', 'cors', 'helmet', 'dotenv'],
                devDependencies: ['typescript', '@types/node', '@types/express', 'ts-node', 'nodemon'],
                routePattern: `app.get('/path', (req, res) => { res.json({ data: 'value' }); });`,
                middlewarePattern: `app.use((req, res, next) => { next(); });`,
            },
            {
                name: 'Fastify',
                id: 'fastify',
                directories: ['src', 'src/routes', 'src/plugins'],
                entryPoint: 'src/index.ts',
                dependencies: ['fastify', '@fastify/cors', 'dotenv'],
                devDependencies: ['typescript', '@types/node', 'ts-node'],
                routePattern: `app.get('/path', async (request, reply) => { return { data: 'value' }; });`,
                middlewarePattern: `app.addHook('onRequest', async (request, reply) => { });`,
            },
            {
                name: 'NestJS',
                id: 'nestjs',
                directories: ['src', 'src/modules', 'src/common'],
                entryPoint: 'src/main.ts',
                dependencies: ['@nestjs/core', '@nestjs/common', '@nestjs/platform-express', 'reflect-metadata'],
                devDependencies: ['typescript', '@types/node', '@nestjs/cli'],
                routePattern: `@Get('path') async getData(): Promise<{ data: string }> { return { data: 'value' }; }`,
                middlewarePattern: `@Injectable() export class LoggingMiddleware implements NestMiddleware { use(req, res, next) { next(); } }`,
            },
        ],
        databaseORMs: [
            {
                name: 'Prisma',
                id: 'prisma',
                dependencies: ['prisma', '@prisma/client'],
                modelPattern: `model User {\n  id        Int      @id @default(autoincrement())\n  email     String   @unique\n  name      String?\n  createdAt DateTime @default(now())\n}`,
                migrationPattern: 'prisma/migrations/{timestamp}_{name}/migration.sql',
                connectionPattern: `import { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();`,
            },
            {
                name: 'Drizzle',
                id: 'drizzle',
                dependencies: ['drizzle-orm', 'drizzle-kit'],
                modelPattern: `export const users = pgTable('users', {\n  id: serial('id').primaryKey(),\n  email: varchar('email', { length: 256 }).notNull().unique(),\n});`,
                migrationPattern: 'drizzle/{timestamp}_{name}.sql',
                connectionPattern: `import { drizzle } from 'drizzle-orm/node-postgres';\nconst db = drizzle(pool);`,
            },
        ],
    },
    python: {
        name: 'Python',
        extensions: ['.py'],
        packageManager: 'pip',
        installCommand: 'pip install -r requirements.txt',
        devCommand: 'python -m uvicorn main:app --reload',
        buildCommand: 'python -m build',
        testCommand: 'pytest',
        configFiles: ['requirements.txt', 'pyproject.toml'],
        commentSyntax: { single: '#', multiStart: '"""', multiEnd: '"""' },
        frameworks: [
            {
                name: 'FastAPI',
                id: 'fastapi',
                directories: ['app', 'app/routers', 'app/models', 'app/schemas', 'tests'],
                entryPoint: 'app/main.py',
                dependencies: ['fastapi', 'uvicorn[standard]', 'pydantic', 'python-dotenv'],
                routePattern: `@app.get("/path")\nasync def get_data():\n    return {"data": "value"}`,
                middlewarePattern: `@app.middleware("http")\nasync def middleware(request, call_next):\n    response = await call_next(request)\n    return response`,
            },
            {
                name: 'Django',
                id: 'django',
                directories: ['project', 'project/apps', 'templates', 'static'],
                entryPoint: 'manage.py',
                dependencies: ['django', 'djangorestframework', 'python-dotenv'],
                routePattern: `class DataView(APIView):\n    def get(self, request):\n        return Response({"data": "value"})`,
                middlewarePattern: `class CustomMiddleware:\n    def __init__(self, get_response):\n        self.get_response = get_response`,
            },
            {
                name: 'Flask',
                id: 'flask',
                directories: ['app', 'app/routes', 'app/models', 'templates'],
                entryPoint: 'app/__init__.py',
                dependencies: ['flask', 'flask-cors', 'python-dotenv'],
                routePattern: `@app.route("/path", methods=["GET"])\ndef get_data():\n    return jsonify({"data": "value"})`,
                middlewarePattern: `@app.before_request\ndef before_request():\n    pass`,
            },
        ],
        databaseORMs: [
            {
                name: 'SQLAlchemy',
                id: 'sqlalchemy',
                dependencies: ['SQLAlchemy', 'alembic', 'psycopg2-binary'],
                modelPattern: `class User(Base):\n    __tablename__ = "users"\n    id = Column(Integer, primary_key=True)\n    email = Column(String, unique=True, nullable=False)\n    created_at = Column(DateTime, default=datetime.utcnow)`,
                migrationPattern: 'migrations/versions/{revision}_{message}.py',
                connectionPattern: `from sqlalchemy import create_engine\nengine = create_engine(DATABASE_URL)`,
            },
        ],
    },
    go: {
        name: 'Go',
        extensions: ['.go'],
        packageManager: 'go',
        installCommand: 'go mod download',
        devCommand: 'go run .',
        buildCommand: 'go build -o bin/app',
        testCommand: 'go test ./...',
        configFiles: ['go.mod', 'go.sum'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Gin',
                id: 'gin',
                directories: ['cmd', 'internal', 'internal/handlers', 'internal/models', 'pkg'],
                entryPoint: 'cmd/main.go',
                dependencies: ['github.com/gin-gonic/gin', 'github.com/joho/godotenv'],
                routePattern: `r.GET("/path", func(c *gin.Context) {\n    c.JSON(200, gin.H{"data": "value"})\n})`,
                middlewarePattern: `func MyMiddleware() gin.HandlerFunc {\n    return func(c *gin.Context) { c.Next() }\n}`,
            },
            {
                name: 'Echo',
                id: 'echo',
                directories: ['cmd', 'internal', 'internal/handlers', 'internal/models'],
                entryPoint: 'cmd/main.go',
                dependencies: ['github.com/labstack/echo/v4', 'github.com/joho/godotenv'],
                routePattern: `e.GET("/path", func(c echo.Context) error {\n    return c.JSON(http.StatusOK, map[string]string{"data": "value"})\n})`,
                middlewarePattern: `e.Use(middleware.Logger())`,
            },
            {
                name: 'Fiber',
                id: 'fiber',
                directories: ['cmd', 'internal', 'internal/handlers'],
                entryPoint: 'cmd/main.go',
                dependencies: ['github.com/gofiber/fiber/v2'],
                routePattern: `app.Get("/path", func(c *fiber.Ctx) error {\n    return c.JSON(fiber.Map{"data": "value"})\n})`,
                middlewarePattern: `app.Use(func(c *fiber.Ctx) error { return c.Next() })`,
            },
        ],
        databaseORMs: [
            {
                name: 'GORM',
                id: 'gorm',
                dependencies: ['gorm.io/gorm', 'gorm.io/driver/postgres'],
                modelPattern: `type User struct {\n    gorm.Model\n    Email string \`gorm:"uniqueIndex"\`\n    Name  string\n}`,
                migrationPattern: 'migrations/{name}.go',
                connectionPattern: `db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})`,
            },
        ],
    },
    rust: {
        name: 'Rust',
        extensions: ['.rs'],
        packageManager: 'cargo',
        installCommand: 'cargo build',
        devCommand: 'cargo run',
        buildCommand: 'cargo build --release',
        testCommand: 'cargo test',
        configFiles: ['Cargo.toml'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Actix',
                id: 'actix',
                directories: ['src', 'src/handlers', 'src/models'],
                entryPoint: 'src/main.rs',
                dependencies: ['actix-web', 'actix-rt', 'serde', 'serde_json', 'dotenv'],
                routePattern: `#[get("/path")]\nasync fn get_data() -> impl Responder {\n    HttpResponse::Ok().json(json!({"data": "value"}))\n}`,
                middlewarePattern: `pub struct Logger;\nimpl<S, B> Transform<S, ServiceRequest> for Logger {...}`,
            },
            {
                name: 'Rocket',
                id: 'rocket',
                directories: ['src', 'src/routes', 'src/models'],
                entryPoint: 'src/main.rs',
                dependencies: ['rocket', 'serde', 'serde_json'],
                routePattern: `#[get("/path")]\nfn get_data() -> Json<Value> {\n    Json(json!({"data": "value"}))\n}`,
                middlewarePattern: `impl Fairing for MyFairing {...}`,
            },
            {
                name: 'Axum',
                id: 'axum',
                directories: ['src', 'src/handlers', 'src/models'],
                entryPoint: 'src/main.rs',
                dependencies: ['axum', 'tokio', 'serde', 'serde_json'],
                routePattern: `async fn get_data() -> Json<Value> {\n    Json(json!({"data": "value"}))\n}`,
                middlewarePattern: `async fn my_middleware<B>(request: Request<B>, next: Next<B>) -> Response {...}`,
            },
        ],
        databaseORMs: [
            {
                name: 'Diesel',
                id: 'diesel',
                dependencies: ['diesel', 'diesel_migrations'],
                modelPattern: `#[derive(Queryable, Insertable)]\n#[diesel(table_name = users)]\npub struct User {\n    pub id: i32,\n    pub email: String,\n}`,
                migrationPattern: 'migrations/{timestamp}_{name}/up.sql',
                connectionPattern: `let connection = PgConnection::establish(&database_url)?;`,
            },
        ],
    },
    java: {
        name: 'Java',
        extensions: ['.java'],
        packageManager: 'maven',
        installCommand: 'mvn install',
        devCommand: 'mvn spring-boot:run',
        buildCommand: 'mvn package',
        testCommand: 'mvn test',
        configFiles: ['pom.xml'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Spring Boot',
                id: 'spring',
                directories: ['src/main/java', 'src/main/resources', 'src/test/java'],
                entryPoint: 'src/main/java/Application.java',
                dependencies: ['spring-boot-starter-web', 'spring-boot-starter-data-jpa'],
                routePattern: `@GetMapping("/path")\npublic ResponseEntity<Map<String, Object>> getData() {\n    return ResponseEntity.ok(Map.of("data", "value"));\n}`,
                middlewarePattern: `@Component\npublic class LoggingInterceptor implements HandlerInterceptor {...}`,
            },
            {
                name: 'Quarkus',
                id: 'quarkus',
                directories: ['src/main/java', 'src/main/resources', 'src/test/java'],
                entryPoint: 'src/main/java/Application.java',
                dependencies: ['quarkus-resteasy', 'quarkus-arc'],
                routePattern: `@GET\n@Path("/path")\npublic Response getData() {\n    return Response.ok(Map.of("data", "value")).build();\n}`,
                middlewarePattern: `@Provider\npublic class LoggingFilter implements ContainerRequestFilter {...}`,
            },
        ],
        databaseORMs: [
            {
                name: 'Hibernate/JPA',
                id: 'hibernate',
                dependencies: ['spring-boot-starter-data-jpa', 'postgresql'],
                modelPattern: `@Entity\n@Table(name = "users")\npublic class User {\n    @Id @GeneratedValue\n    private Long id;\n    @Column(unique = true)\n    private String email;\n}`,
                migrationPattern: 'src/main/resources/db/migration/V{version}__{name}.sql',
                connectionPattern: `spring.datasource.url=jdbc:postgresql://localhost:5432/mydb`,
            },
        ],
    },
    cpp: {
        name: 'C++',
        extensions: ['.cpp', '.hpp', '.h', '.cc'],
        packageManager: 'cmake',
        installCommand: 'cmake -B build && cmake --build build',
        devCommand: './build/app',
        buildCommand: 'cmake --build build --config Release',
        testCommand: 'ctest --test-dir build',
        configFiles: ['CMakeLists.txt', 'conanfile.txt'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Drogon',
                id: 'drogon',
                directories: ['src', 'controllers', 'models', 'views'],
                entryPoint: 'main.cpp',
                dependencies: ['drogon', 'jsoncpp'],
                routePattern: `app().registerHandler("/path", [](const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {\n    auto resp = HttpResponse::newHttpJsonResponse(Json::objectValue);\n    callback(resp);\n});`,
                middlewarePattern: `app().registerFilter<MyFilter>();`,
            },
            {
                name: 'Crow',
                id: 'crow',
                directories: ['src', 'include'],
                entryPoint: 'main.cpp',
                dependencies: ['crow', 'boost'],
                routePattern: `CROW_ROUTE(app, "/path").methods("GET"_method)([](){ return crow::response(200, "{}"); });`,
                middlewarePattern: `app.use_websocket()`,
            },
        ],
        databaseORMs: [
            {
                name: 'SQLite/Raw SQL',
                id: 'sqlite',
                dependencies: ['sqlite3'],
                modelPattern: `// CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE);`,
                migrationPattern: 'migrations/{version}.sql',
                connectionPattern: `sqlite3* db;\nsqlite3_open("app.db", &db);`,
            },
        ],
    },
    csharp: {
        name: 'C#',
        extensions: ['.cs'],
        packageManager: 'dotnet',
        installCommand: 'dotnet restore',
        devCommand: 'dotnet run',
        buildCommand: 'dotnet build',
        testCommand: 'dotnet test',
        configFiles: ['*.csproj', 'appsettings.json'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'ASP.NET Core',
                id: 'aspnet',
                directories: ['Controllers', 'Models', 'Services', 'Data'],
                entryPoint: 'Program.cs',
                dependencies: ['Microsoft.AspNetCore.App'],
                routePattern: `[HttpGet("path")]\npublic IActionResult GetData() => Ok(new { data = "value" });`,
                middlewarePattern: `app.UseMiddleware<CustomMiddleware>();`,
            },
        ],
        databaseORMs: [
            {
                name: 'Entity Framework Core',
                id: 'efcore',
                dependencies: ['Microsoft.EntityFrameworkCore', 'Npgsql.EntityFrameworkCore.PostgreSQL'],
                modelPattern: `public class User {\n    public int Id { get; set; }\n    public string Email { get; set; }\n}`,
                migrationPattern: 'Migrations/{timestamp}_{name}.cs',
                connectionPattern: `services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));`,
            },
        ],
    },
    ruby: {
        name: 'Ruby',
        extensions: ['.rb'],
        packageManager: 'bundler',
        installCommand: 'bundle install',
        devCommand: 'rails server',
        buildCommand: 'rake build',
        testCommand: 'rspec',
        configFiles: ['Gemfile', 'Gemfile.lock'],
        commentSyntax: { single: '#', multiStart: '=begin', multiEnd: '=end' },
        frameworks: [
            {
                name: 'Ruby on Rails',
                id: 'rails',
                directories: ['app', 'app/controllers', 'app/models', 'config', 'db'],
                entryPoint: 'config/application.rb',
                dependencies: ['rails', 'pg'],
                routePattern: `get '/path', to: 'controller#action'`,
                middlewarePattern: `class MyMiddleware\n  def call(env)\n    @app.call(env)\n  end\nend`,
            },
            {
                name: 'Sinatra',
                id: 'sinatra',
                directories: ['lib', 'views'],
                entryPoint: 'app.rb',
                dependencies: ['sinatra', 'sinatra-contrib'],
                routePattern: `get '/path' do\n  { data: 'value' }.to_json\nend`,
                middlewarePattern: `use Rack::Logger`,
            },
        ],
        databaseORMs: [
            {
                name: 'ActiveRecord',
                id: 'activerecord',
                dependencies: ['activerecord', 'pg'],
                modelPattern: `class User < ApplicationRecord\n  validates :email, presence: true, uniqueness: true\nend`,
                migrationPattern: 'db/migrate/{timestamp}_{name}.rb',
                connectionPattern: `ActiveRecord::Base.establish_connection(adapter: 'postgresql', database: 'mydb')`,
            },
        ],
    },
    php: {
        name: 'PHP',
        extensions: ['.php'],
        packageManager: 'composer',
        installCommand: 'composer install',
        devCommand: 'php artisan serve',
        buildCommand: 'composer build',
        testCommand: 'php artisan test',
        configFiles: ['composer.json', '.env'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Laravel',
                id: 'laravel',
                directories: ['app', 'app/Http/Controllers', 'app/Models', 'routes', 'database/migrations'],
                entryPoint: 'public/index.php',
                dependencies: ['laravel/framework'],
                routePattern: `Route::get('/path', function () {\n    return response()->json(['data' => 'value']);\n});`,
                middlewarePattern: `public function handle($request, Closure $next) { return $next($request); }`,
            },
            {
                name: 'Symfony',
                id: 'symfony',
                directories: ['src', 'src/Controller', 'src/Entity', 'config'],
                entryPoint: 'public/index.php',
                dependencies: ['symfony/framework-bundle'],
                routePattern: `#[Route('/path', methods: ['GET'])]\npublic function getData(): JsonResponse {\n    return $this->json(['data' => 'value']);\n}`,
                middlewarePattern: `public function onKernelRequest(RequestEvent $event) {...}`,
            },
        ],
        databaseORMs: [
            {
                name: 'Eloquent',
                id: 'eloquent',
                dependencies: ['illuminate/database'],
                modelPattern: `class User extends Model {\n    protected $fillable = ['email', 'name'];\n}`,
                migrationPattern: 'database/migrations/{timestamp}_{name}.php',
                connectionPattern: `'default' => env('DB_CONNECTION', 'pgsql')`,
            },
        ],
    },
    kotlin: {
        name: 'Kotlin',
        extensions: ['.kt', '.kts'],
        packageManager: 'gradle',
        installCommand: 'gradle build',
        devCommand: 'gradle run',
        buildCommand: 'gradle build',
        testCommand: 'gradle test',
        configFiles: ['build.gradle.kts', 'settings.gradle.kts'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Ktor',
                id: 'ktor',
                directories: ['src/main/kotlin', 'src/main/resources'],
                entryPoint: 'src/main/kotlin/Application.kt',
                dependencies: ['io.ktor:ktor-server-core', 'io.ktor:ktor-server-netty'],
                routePattern: `get("/path") {\n    call.respond(mapOf("data" to "value"))\n}`,
                middlewarePattern: `install(CallLogging) { level = Level.INFO }`,
            },
        ],
        databaseORMs: [
            {
                name: 'Exposed',
                id: 'exposed',
                dependencies: ['org.jetbrains.exposed:exposed-core', 'org.jetbrains.exposed:exposed-dao'],
                modelPattern: `object Users : Table() {\n    val id = integer("id").autoIncrement()\n    val email = varchar("email", 255).uniqueIndex()\n    override val primaryKey = PrimaryKey(id)\n}`,
                migrationPattern: 'migrations/{version}.sql',
                connectionPattern: `Database.connect("jdbc:postgresql://localhost:5432/mydb", driver = "org.postgresql.Driver")`,
            },
        ],
    },
    swift: {
        name: 'Swift',
        extensions: ['.swift'],
        packageManager: 'swift',
        installCommand: 'swift package resolve',
        devCommand: 'swift run',
        buildCommand: 'swift build -c release',
        testCommand: 'swift test',
        configFiles: ['Package.swift'],
        commentSyntax: { single: '//', multiStart: '/*', multiEnd: '*/' },
        frameworks: [
            {
                name: 'Vapor',
                id: 'vapor',
                directories: ['Sources/App', 'Sources/App/Controllers', 'Sources/App/Models'],
                entryPoint: 'Sources/App/entrypoint.swift',
                dependencies: ['vapor'],
                routePattern: `app.get("path") { req in\n    return ["data": "value"]\n}`,
                middlewarePattern: `struct MyMiddleware: Middleware { func respond(to request: Request, chainingTo next: Responder) -> EventLoopFuture<Response> { return next.respond(to: request) } }`,
            },
        ],
        databaseORMs: [
            {
                name: 'Fluent',
                id: 'fluent',
                dependencies: ['vapor', 'fluent', 'fluent-postgres-driver'],
                modelPattern: `final class User: Model, Content {\n    static let schema = "users"\n    @ID(key: .id) var id: UUID?\n    @Field(key: "email") var email: String\n}`,
                migrationPattern: 'Sources/App/Migrations/{Name}.swift',
                connectionPattern: `app.databases.use(.postgres(hostname: "localhost", database: "mydb"), as: .psql)`,
            },
        ],
    },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getLanguageConfig(language: SupportedLanguage): LanguageConfig {
    return LANGUAGE_CONFIGS[language];
}

export function getFrameworkConfig(language: SupportedLanguage, framework: SupportedFramework): FrameworkConfig | undefined {
    const langConfig = LANGUAGE_CONFIGS[language];
    return langConfig?.frameworks.find(f => f.id === framework);
}

export function getORMConfig(language: SupportedLanguage, ormId: string): DatabaseORMConfig | undefined {
    const langConfig = LANGUAGE_CONFIGS[language];
    return langConfig?.databaseORMs.find(o => o.id === ormId);
}

export function getSupportedLanguages(): SupportedLanguage[] {
    return Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[];
}

export function getSupportedFrameworks(language: SupportedLanguage): SupportedFramework[] {
    return LANGUAGE_CONFIGS[language]?.frameworks.map(f => f.id) || [];
}

export function getDefaultFramework(language: SupportedLanguage): SupportedFramework {
    return LANGUAGE_CONFIGS[language]?.frameworks[0]?.id || 'express';
}

export function getDefaultORM(language: SupportedLanguage): DatabaseORMConfig | undefined {
    return LANGUAGE_CONFIGS[language]?.databaseORMs[0];
}

export function detectLanguageFromFile(filename: string): SupportedLanguage | null {
    const ext = filename.substring(filename.lastIndexOf('.'));

    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
        if (config.extensions.includes(ext)) {
            return lang as SupportedLanguage;
        }
    }
    return null;
}

/**
 * Generate language-specific context for AI prompts
 */
export function generateLanguagePromptContext(language: SupportedLanguage, framework?: SupportedFramework): string {
    const langConfig = LANGUAGE_CONFIGS[language];
    if (!langConfig) return '';

    const fw = framework
        ? langConfig.frameworks.find(f => f.id === framework)
        : langConfig.frameworks[0];
    const orm = langConfig.databaseORMs[0];

    return `
LANGUAGE: ${langConfig.name}
File Extension: ${langConfig.extensions[0]}
Package Manager: ${langConfig.packageManager}
Dependency File: ${langConfig.configFiles[0]}

FRAMEWORK: ${fw?.name || 'Standard'}
- Entry Point: ${fw?.entryPoint || 'main file'}
- Route Pattern:
${fw?.routePattern || 'N/A'}

DATABASE ORM: ${orm?.name || 'Raw SQL'}
- Model Pattern:
${orm?.modelPattern || 'N/A'}
- Migration Pattern: ${orm?.migrationPattern || 'N/A'}
- Connection:
${orm?.connectionPattern || 'N/A'}

PROJECT STRUCTURE:
${fw?.directories.map(d => `📁 ${d}/`).join('\n') || 'Standard structure'}
`;
}

