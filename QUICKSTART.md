# 🚀 Quick Start - YAMLScript Extension

## What is this?

This extension brings **TypeScript language server features** to YAML files! Write TypeScript code in your YAML and get:
- ✅ Real-time error checking
- ✅ Type validation
- ✅ IntelliSense support
- ✅ Just like in `.ts` files!

## Try it NOW! (30 seconds)

### Step 1: Launch the Extension (10 sec)

```bash
# In VS Code, with this project open:
Press F5
```

This opens the "Extension Development Host" - a new VS Code window with the extension running.

### Step 2: Open Example File (10 sec)

In the new window:
```
File > Open File > example.yaml
```

### Step 3: See the Magic! (10 sec)

Look for red squiggly lines under:
- `const num: number = "not a number"` ← Type error!
- The incomplete `User` object ← Missing property!
- `const status: Status = "invalid"` ← Invalid value!

**🎉 Congratulations!** TypeScript is now working in your YAML file!

## How to Use in Your Own YAML Files

Create any `.yaml` file with TypeScript code:

```yaml
name: My Config

handler:
  code: |
    interface User {
      id: number;
      name: string;
      email: string;
    }
    
    const user: User = {
      id: 1,
      name: "Alice",
      email: "alice@example.com"
    };

validation:
  script: |
    const validateEmail = (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };
    
    // This will show an error - wrong type!
    const result = validateEmail(123);
```

## Common Patterns

### Configuration with Types

```yaml
database:
  setup: |
    type DbConfig = {
      host: string;
      port: number;
    };
    
    const config: DbConfig = {
      host: 'localhost',
      port: 5432
    };
```

### Event Handlers

```yaml
button:
  onClick: |
    const handleClick = (event: MouseEvent): void => {
      console.log('Clicked!', event);
    };
```

### Validators

```yaml
validators:
  email: |
    const isValid = (email: string): boolean => {
      return email.includes('@');
    };
```

## What Gets Detected?

The extension detects TypeScript code in:

1. **Values with code-related keys**: `code`, `script`, `handler`, `validator`, etc.
2. **Explicit markers**: Comments like `# typescript:`
3. **Heuristics**: Any multiline string with TypeScript syntax

### TypeScript Indicators:
- Keywords: `const`, `let`, `function`, `interface`, `type`, `class`
- Type annotations: `: string`, `: number`, etc.
- Arrow functions: `=>`
- Imports/exports
- Generics: `<T>`

## Troubleshooting

### "Not seeing errors?"

1. Make sure you're in the Extension Development Host window (opened by F5)
2. Check the file is actually `.yaml` or `.yml`
3. Ensure your code has TypeScript-specific syntax (types, interfaces, etc.)
4. Try closing and reopening the file

### "Extension not working?"

1. Check the Debug Console in the main VS Code window
2. Look for any error messages
3. Try restarting the Extension Development Host (Ctrl+R)

## Next Steps

1. ✅ You've seen it work with `example.yaml`
2. 📝 Create your own YAML files with TypeScript
3. 🎨 Explore more examples in `TUTORIAL.md`
4. 🔧 Learn technical details in `DEVELOPMENT.md`
5. 📦 Package and install locally (see below)

## Installing Locally (Optional)

Want to use the extension permanently?

```bash
# Package the extension
pnpm run package

# This creates yamlscript-0.0.1.vsix

# Install it:
# 1. Open Extensions panel (Ctrl+Shift+X)
# 2. Click "..." menu
# 3. Choose "Install from VSIX..."
# 4. Select the .vsix file
```

## Project Structure

```
yamlscript/
├── src/extension.ts     ← Main code (327 lines)
├── example.yaml         ← Demo file
├── package.json         ← Extension manifest
├── README.md            ← User docs
├── TUTORIAL.md          ← Detailed tutorial
├── DEVELOPMENT.md       ← Technical guide
├── SUMMARY.md           ← Complete overview
└── CHECKLIST.md         ← Testing & deployment
```

## Key Features

| Feature | Status |
|---------|--------|
| Error Detection | ✅ Working |
| Type Checking | ✅ Working |
| Real-time Updates | ✅ Working |
| Multiple Blocks | ✅ Working |
| IntelliSense | ⚠️ Partial |
| Go to Definition | ❌ Future |

## Development Commands

```bash
# Watch mode (auto-compile on changes)
pnpm run watch

# Then press F5 to launch

# Compile once
pnpm run compile

# Lint
pnpm run lint

# Test
pnpm run test

# Package
pnpm run package
```

## Examples to Try

### 1. Type Mismatch

```yaml
test:
  code: |
    const x: number = "hello"; // ← Error!
```

### 2. Missing Property

```yaml
test:
  code: |
    interface Person {
      name: string;
      age: number;
    }
    const p: Person = { name: "Bob" }; // ← Error! Missing age
```

### 3. Function Types

```yaml
test:
  code: |
    function greet(name: string): string {
      return `Hello, ${name}`;
    }
    greet(123); // ← Error! Wrong type
```

### 4. Array Types

```yaml
test:
  code: |
    const numbers: number[] = [1, 2, "3"]; // ← Error! Wrong type in array
```

## Tips

1. **Use meaningful keys**: `code`, `script`, `handler` help detection
2. **Include type annotations**: Makes detection more reliable
3. **Keep blocks focused**: One purpose per code block
4. **Check `example.yaml`**: Lots of examples there!

## Help & Resources

- 📖 Full tutorial: `TUTORIAL.md`
- 🔧 Technical docs: `DEVELOPMENT.md`
- 📋 Complete summary: `SUMMARY.md`
- ✅ Testing guide: `CHECKLIST.md`
- 💡 Examples: `example.yaml`

## Questions?

1. Read the docs above
2. Check the example file
3. Look at the code in `src/extension.ts`
4. Open an issue on GitHub

---

## 🎯 TL;DR

1. Press **F5** in VS Code
2. Open **example.yaml** in the new window
3. See **TypeScript errors** in the YAML file
4. **Mind = Blown** 🤯

---

**Made with ❤️ for developers who love type safety everywhere!**

