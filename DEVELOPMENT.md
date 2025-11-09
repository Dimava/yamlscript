# YAMLScript Extension - Development & Testing Guide

## Overview

This extension enables TypeScript language server features for code embedded in YAML files using a virtual document approach.

## How to Test the Extension

### Method 1: Using F5 (Extension Development Host)

1. Open the extension project folder in VS Code
2. Press `F5` (or Run > Start Debugging)
3. This will open a new "Extension Development Host" window
4. In the new window, open `example.yaml`
5. You should see TypeScript errors highlighted in the YAML file:
   - Line with `const num: number = "not a number"` should show a type error
   - The incomplete `User` object should show a missing property error
   - The invalid status value should show an error

### Method 2: Installing Locally

```bash
# Package the extension
pnpm run package

# Install the .vsix file in VS Code
# Go to Extensions > ... > Install from VSIX
```

## How It Works - Technical Details

### 1. Virtual Document Provider

The extension registers a custom URI scheme `yamlscript-ts://` that provides content for virtual TypeScript documents.

```typescript
vscode.workspace.registerTextDocumentContentProvider('yamlscript-ts', provider)
```

### 2. Code Block Extraction

The extension uses two methods to extract TypeScript code:

**Method A: YAML Parsing (Primary)**
- Uses the `yaml` library to parse the YAML structure
- Walks the AST looking for string values that contain TypeScript code
- Extracts position information from the YAML AST

**Method B: Regex Fallback**
- Falls back to regex patterns if YAML parsing fails
- Looks for patterns like `code: |`, `script: >`, etc.
- Uses heuristics to detect TypeScript syntax

### 3. TypeScript Detection Heuristics

Code is identified as TypeScript if it contains:
- Keywords: `const`, `let`, `var`, `function`, `class`, `interface`, `type`, `enum`
- Type annotations: `: string`, `: number`, etc.
- Arrow functions: `=>`
- Import/export statements
- Generic syntax: `<T>`, `<Type>`

### 4. Diagnostic Mapping

When the TypeScript language server produces diagnostics:
1. Extension listens to `onDidChangeDiagnostics` events
2. Checks if the diagnostic is for a virtual document (URI starts with `yamlscript-ts:`)
3. Maps line/column numbers from virtual document to original YAML file
4. Creates new diagnostics with adjusted positions
5. Displays them in the original YAML file

### 5. Line Mapping

```typescript
// Virtual document line -> YAML file line
yamlLine = codeBlock.startLine + virtualLine
```

## Supported YAML Patterns

### Pattern 1: Multiline Strings with Code/Script Keys

```yaml
handler:
  code: |
    const x = 1;
```

### Pattern 2: Folded Scalars

```yaml
transform:
  script: >
    function process() {
      return true;
    }
```

### Pattern 3: Explicit TypeScript Markers

```yaml
# typescript:
utils: |
  interface Data {
    id: number;
  }
```

### Pattern 4: Nested Structures

```yaml
components:
  button:
    onClick: |
      const handleClick = (e: Event) => {
        console.log(e);
      };
```

## Architecture

```
YAML File
    ↓
[Extract Code Blocks]
    ↓
Virtual TS Documents (yamlscript-ts://...)
    ↓
[TypeScript Language Server]
    ↓
Diagnostics
    ↓
[Map Back to YAML]
    ↓
Show Errors in YAML File
```

## Key VS Code APIs Used

### Document Management
- `vscode.workspace.registerTextDocumentContentProvider()` - Register virtual document provider
- `vscode.workspace.onDidOpenTextDocument()` - Listen for document opens
- `vscode.workspace.onDidChangeTextDocument()` - Listen for document changes
- `vscode.workspace.openTextDocument()` - Open virtual documents

### Diagnostics
- `vscode.languages.createDiagnosticCollection()` - Create diagnostic collection
- `vscode.languages.onDidChangeDiagnostics()` - Listen for diagnostic changes
- `vscode.languages.getDiagnostics()` - Get diagnostics for a document
- `diagnosticCollection.set()` - Set diagnostics for a document

### URI Handling
- `vscode.Uri.parse()` - Create URIs for virtual documents
- Custom URI scheme: `yamlscript-ts:` 

## Debugging Tips

### Enable Extension Logs

Add this to your launch.json:
```json
{
  "type": "extensionHost",
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}",
    "--log=debug"
  ]
}
```

### View Output Channel

In the Extension Development Host:
1. View > Output
2. Select "Extension Host" from the dropdown

### Inspect Virtual Documents

You can open virtual documents directly:
```
Command Palette > Open: yamlscript-ts://path/to/file.yaml.block0.ts
```

## Known Issues & Solutions

### Issue: Diagnostics not appearing
**Solution**: Make sure TypeScript language features are enabled in VS Code

### Issue: Wrong line numbers
**Solution**: Check that the YAML parser is correctly identifying code block positions

### Issue: Code not detected
**Solution**: Ensure the code contains TypeScript-specific syntax (types, interfaces, etc.)

## Future Enhancements

1. **IntelliSense Support**: Provide completions, hover info within YAML
2. **Go to Definition**: Navigate from YAML to definitions
3. **Refactoring**: Support rename, extract function, etc.
4. **Configuration**: Allow users to customize detection patterns
5. **Multi-language Support**: Support JavaScript, JSX, TSX
6. **Import Resolution**: Resolve imports relative to YAML file location
7. **Workspace Configuration**: Respect tsconfig.json from workspace

## Performance Considerations

- Virtual documents are created only for open YAML files
- Documents are cleaned up when YAML files are closed
- Code extraction is done on-demand, not for entire workspace
- Diagnostics are updated incrementally as you type

## Testing Checklist

- [ ] Extension activates when YAML file is opened
- [ ] TypeScript errors appear in YAML file
- [ ] Errors update as you type
- [ ] Multiple code blocks in same file work
- [ ] Nested YAML structures handled correctly
- [ ] Extension doesn't impact non-YAML files
- [ ] No performance issues with large YAML files
- [ ] Virtual documents cleaned up on file close

## References

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Virtual Documents in VS Code](https://code.visualstudio.com/api/extension-guides/virtual-documents)
- [TypeScript Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [YAML Specification](https://yaml.org/spec/)

---

Happy coding! 🎉

