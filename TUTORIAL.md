# YAMLScript Tutorial - Getting Started

## What is YAMLScript?

YAMLScript brings TypeScript language features to YAML files! You can now write TypeScript code in YAML files and get:
- Real-time error checking
- Type validation
- IntelliSense support
- All the power of the TypeScript language server

## Quick Start

### Step 1: Install the Extension

1. Clone this repository
2. Open in VS Code
3. Press `F5` to launch Extension Development Host
4. Or package and install: `pnpm run package`

### Step 2: Create a YAML File

Create a file called `config.yaml`:

```yaml
name: My App Configuration

# Add your TypeScript code in any string value
startup:
  code: |
    interface Config {
      port: number;
      host: string;
    }
    
    const config: Config = {
      port: 3000,
      host: 'localhost'
    };
```

### Step 3: See TypeScript Errors

Try adding an error:

```yaml
validation:
  script: |
    // This will show an error - type mismatch
    const port: number = "3000";
    
    // This will show an error - missing property
    interface User {
      id: number;
      name: string;
      email: string;
    }
    
    const user: User = {
      id: 1,
      name: "John"
      // Missing 'email' - TypeScript will catch this!
    };
```

You'll see red squiggly lines under the errors, just like in a `.ts` file!

## Common Use Cases

### 1. Configuration with Type Safety

```yaml
database:
  connection: |
    type DatabaseConfig = {
      host: string;
      port: number;
      credentials: {
        username: string;
        password: string;
      };
    };
    
    const dbConfig: DatabaseConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      credentials: {
        username: 'admin',
        password: 'secret'
      }
    };
```

### 2. Event Handlers

```yaml
components:
  button:
    onClick: |
      const handleClick = (event: MouseEvent): void => {
        event.preventDefault();
        console.log('Button clicked!');
      };
    
  form:
    onSubmit: |
      interface FormData {
        email: string;
        password: string;
      }
      
      const handleSubmit = (data: FormData): Promise<void> => {
        return fetch('/api/login', {
          method: 'POST',
          body: JSON.stringify(data)
        }).then(res => res.json());
      };
```

### 3. Data Transformations

```yaml
transformers:
  userTransform: |
    interface RawUser {
      id: number;
      first_name: string;
      last_name: string;
    }
    
    interface User {
      id: number;
      fullName: string;
    }
    
    const transform = (raw: RawUser): User => ({
      id: raw.id,
      fullName: `${raw.first_name} ${raw.last_name}`
    });
```

### 4. API Definitions

```yaml
api:
  endpoints:
    getUser: |
      type UserId = number;
      
      interface UserResponse {
        id: UserId;
        name: string;
        email: string;
        createdAt: Date;
      }
      
      async function getUser(id: UserId): Promise<UserResponse> {
        const response = await fetch(`/api/users/${id}`);
        return response.json();
      }
```

### 5. Validation Rules

```yaml
validators:
  email: |
    const validateEmail = (email: string): boolean => {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    };
    
    // Type error if wrong type passed
    const result = validateEmail(123); // Error!
  
  password: |
    interface PasswordRequirements {
      minLength: number;
      requiresUppercase: boolean;
      requiresNumber: boolean;
    }
    
    const validatePassword = (
      password: string,
      requirements: PasswordRequirements
    ): boolean => {
      if (password.length < requirements.minLength) return false;
      if (requirements.requiresUppercase && !/[A-Z]/.test(password)) return false;
      if (requirements.requiresNumber && !/\d/.test(password)) return false;
      return true;
    };
```

## Tips & Best Practices

### 1. Use Descriptive Keys

Use keys that indicate code content:
- `code`, `script`, `handler`, `function`
- `transform`, `validator`, `processor`
- `logic`, `implementation`, `algorithm`

### 2. Keep Code Blocks Focused

Each code block should be self-contained:

```yaml
# Good - focused and clear
auth:
  validateToken: |
    const validate = (token: string): boolean => {
      return token.length > 0;
    };

# Avoid - too much in one block
auth:
  everything: |
    // Lots of unrelated code...
    // Hard to maintain
```

### 3. Use TypeScript Features

Take advantage of TypeScript:

```yaml
helpers:
  typed: |
    // Generics
    function identity<T>(value: T): T {
      return value;
    }
    
    // Union types
    type Status = 'loading' | 'success' | 'error';
    
    // Type guards
    function isString(value: unknown): value is string {
      return typeof value === 'string';
    }
    
    // Mapped types
    type Readonly<T> = {
      readonly [P in keyof T]: T[P];
    };
```

### 4. Document Your Code

```yaml
utilities:
  documentation: |
    /**
     * Calculates the factorial of a number
     * @param n - The number to calculate factorial for
     * @returns The factorial result
     */
    function factorial(n: number): number {
      if (n <= 1) return 1;
      return n * factorial(n - 1);
    }
```

## Troubleshooting

### Code Not Detected?

Make sure your code contains TypeScript-specific syntax:
- Type annotations: `: string`, `: number`
- Keywords: `interface`, `type`, `enum`
- Modern JavaScript: `const`, `let`, arrow functions

```yaml
# Will be detected
handler: |
  const x: number = 1;

# Might not be detected (plain JavaScript)
handler: |
  var x = 1;
```

### Errors Not Showing?

1. Make sure the extension is active (check Output panel)
2. Verify TypeScript is installed in your workspace
3. Try closing and reopening the YAML file
4. Check that the YAML is valid (extension falls back to regex if parsing fails)

### Wrong Line Numbers?

This can happen with complex indentation. The extension tries its best to map lines correctly, but may be off by a line or two in deeply nested structures.

## Advanced Usage

### Multiple Code Blocks

You can have multiple TypeScript blocks in one file:

```yaml
helpers:
  validation: |
    const isValid = (x: number) => x > 0;
  
  formatting: |
    const format = (s: string) => s.trim();
  
  calculation: |
    const calculate = (a: number, b: number) => a + b;
```

Each block is analyzed independently!

### Nested Structures

The extension works with nested YAML:

```yaml
components:
  forms:
    login:
      validation: |
        type LoginForm = {
          email: string;
          password: string;
        };
```

### Explicit Markers

For better detection, use comment markers:

```yaml
# typescript:
utils: |
  const helper = () => true;
```

## What's Next?

The extension currently provides:
- ✅ Error detection
- ✅ Type checking
- ✅ Basic diagnostics

Future enhancements could include:
- 🚧 IntelliSense completions
- 🚧 Go to definition
- 🚧 Refactoring support
- 🚧 Import resolution
- 🚧 JSDoc hover information

## Examples Repository

Check out `example.yaml` in the extension folder for more examples!

---

Happy coding with TypeScript in YAML! 🎉

