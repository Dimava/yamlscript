import * as vscode from 'vscode';
import * as yaml from 'yaml';
import * as ts from 'typescript';

interface CodeBlock {
	language: string;
	code: string;
	startLine: number;
	endLine: number;
	startOffset: number;
	endOffset: number;
}

/**
 * Provider for virtual TypeScript documents extracted from YAML files
 */
class YamlTypeScriptVirtualDocumentProvider implements vscode.TextDocumentContentProvider {
	private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
	public onDidChange = this.onDidChangeEmitter.event;

	private documents = new Map<string, string>();

	provideTextDocumentContent(uri: vscode.Uri): string {
		return this.documents.get(uri.toString()) || '';
	}

	updateDocument(uri: vscode.Uri, content: string) {
		this.documents.set(uri.toString(), content);
		this.onDidChangeEmitter.fire(uri);
	}

	deleteDocument(uri: vscode.Uri) {
		this.documents.delete(uri.toString());
	}
}

/**
 * Manages TypeScript code blocks within YAML files
 */
class YamlTypeScriptManager {
	private virtualDocProvider: YamlTypeScriptVirtualDocumentProvider;
	private diagnosticCollection: vscode.DiagnosticCollection;
	private documentToVirtualMap = new Map<string, vscode.Uri[]>();
	private virtualToSourceMap = new Map<string, { sourceUri: vscode.Uri; codeBlock: CodeBlock }>();

	constructor(context: vscode.ExtensionContext) {
		this.virtualDocProvider = new YamlTypeScriptVirtualDocumentProvider();
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('yamlscript-typescript');

		// Register the virtual document provider
		context.subscriptions.push(
			vscode.workspace.registerTextDocumentContentProvider('yamlscript-ts', this.virtualDocProvider)
		);

		// Listen to document changes
		context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument(doc => this.updateDocument(doc)),
			vscode.workspace.onDidChangeTextDocument(e => this.updateDocument(e.document)),
			vscode.workspace.onDidCloseTextDocument(doc => this.cleanupDocument(doc))
		);

		// Listen to TypeScript diagnostics
		context.subscriptions.push(
			vscode.languages.onDidChangeDiagnostics(e => this.handleDiagnosticChanges(e))
		);

		// Process already open documents
		vscode.workspace.textDocuments.forEach(doc => this.updateDocument(doc));
	}

	private isYamlDocument(doc: vscode.TextDocument): boolean {
		return doc.languageId === 'yaml' || doc.languageId === 'yml';
	}

	private extractCodeBlocks(text: string): CodeBlock[] {
		const blocks: CodeBlock[] = [];
		
		console.log('[YAMLScript] Starting code block extraction...');
		
		try {
			// Parse YAML and look for TypeScript code blocks
			const parsed = yaml.parseDocument(text);
			console.log('[YAMLScript] YAML parsed successfully');
			
			// Walk through the document looking for strings that might be TypeScript code
			// This is a simple heuristic - look for multiline strings or specific keys
			const findCodeInNode = (node: any, path: string = ''): void => {
				if (!node) {
					return;
				}

				console.log(`[YAMLScript] Node type: ${node.type || node.constructor?.name}, has items: ${!!node.items}`);

				// Handle YAMLMap (the root usually)
				if (node.constructor?.name === 'YAMLMap' || node.type === 'MAP') {
					console.log(`[YAMLScript] Processing YAMLMap/MAP with ${node.items?.length || 0} items`);
					for (const pair of node.items || []) {
						findCodeInNode(pair, path);
					}
					return;
				}

				// Handle Pair nodes (can be 'Pair' or '_Pair' depending on yaml library version)
				if (node.constructor?.name === 'Pair' || node.constructor?.name === '_Pair' || node.type === 'PAIR') {
					const key = node.key?.value;
					const value = node.value;
					
					console.log(`[YAMLScript] Checking pair: ${key}, value type: ${value?.constructor?.name || value?.type}`);
					
					// Check if the value is a scalar (string)
					if (value && (value.constructor?.name === 'Scalar' || value.type === 'SCALAR')) {
						const code = value.value;
						if (typeof code === 'string') {
							console.log(`[YAMLScript] Found string value (${code.length} chars): ${code.substring(0, 50)}...`);
							console.log(`[YAMLScript] Looks like TypeScript? ${this.looksLikeTypeScript(code)}`);
							
							// Heuristic: check if it looks like TypeScript code
							if (this.looksLikeTypeScript(code)) {
								const range = value.range;
								if (range) {
									// For block scalars (|, >), the actual content starts on the next line
									// We need to find where the actual code content begins in the original text
									const rangeStart = range[0];
									const textUpToValue = text.substring(0, rangeStart);
									const linesBeforeValue = textUpToValue.split('\n').length - 1;
									
									// Look ahead to find where the actual code starts (skip the | or > marker)
									const valueText = text.substring(range[0], range[1]);
									const firstNewlineInValue = valueText.indexOf('\n');
									const codeStartOffset = firstNewlineInValue >= 0 ? range[0] + firstNewlineInValue + 1 : range[0];
									
									console.log(`[YAMLScript] Adding code block from line ${this.getLineNumber(text, codeStartOffset)}`);
									blocks.push({
										language: 'typescript',
										code: code,
										startLine: this.getLineNumber(text, codeStartOffset),
										endLine: this.getLineNumber(text, range[1]),
										startOffset: codeStartOffset,
										endOffset: range[1]
									});
								}
							}
						}
					}
					
					// Check if value is nested (MAP or SEQ)
					if (value && (value.constructor?.name === 'YAMLMap' || value.type === 'MAP')) {
						findCodeInNode(value, `${path}/${key}`);
					}
					if (value && (value.constructor?.name === 'YAMLSeq' || value.type === 'SEQ')) {
						findCodeInNode(value, `${path}/${key}`);
					}
					return;
				}

				// Handle sequences
				if (node.constructor?.name === 'YAMLSeq' || node.type === 'SEQ') {
					console.log(`[YAMLScript] Processing YAMLSeq/SEQ with ${node.items?.length || 0} items`);
					for (const item of node.items || []) {
						findCodeInNode(item, path);
					}
					return;
				}
				
				// Legacy handling for old structure
				if (node.type === 'PAIR') {
					const key = node.key?.value;
					const value = node.value;
					
					console.log(`[YAMLScript] Checking pair: ${key}, value type: ${value?.type}, is string: ${typeof value?.value === 'string'}`);
					
					// Check if this looks like a TypeScript code block
					if (value && typeof value.value === 'string') {
						const code = value.value;
						console.log(`[YAMLScript] Found string value (${code.length} chars): ${code.substring(0, 50)}...`);
						console.log(`[YAMLScript] Looks like TypeScript? ${this.looksLikeTypeScript(code)}`);
						
						// Heuristic: check if it looks like TypeScript code
						if (this.looksLikeTypeScript(code)) {
							const range = value.range;
							if (range) {
								console.log(`[YAMLScript] Adding code block from line ${this.getLineNumber(text, range[0])}`);
								blocks.push({
									language: 'typescript',
									code: code,
									startLine: this.getLineNumber(text, range[0]),
									endLine: this.getLineNumber(text, range[1]),
									startOffset: range[0],
									endOffset: range[1]
								});
							}
						}
					}

					// Recursively check nested structures
					if (value?.items) {
						for (const item of value.items) {
							findCodeInNode(item, `${path}/${key}`);
						}
					}
				} else if (node.type === 'MAP') {
					console.log(`[YAMLScript] Processing MAP with ${node.items?.length || 0} items`);
					for (const pair of node.items || []) {
						findCodeInNode(pair, path);
					}
				} else if (node.type === 'SEQ') {
					console.log(`[YAMLScript] Processing SEQ with ${node.items?.length || 0} items`);
					for (const item of node.items || []) {
						findCodeInNode(item, path);
					}
				}
			};

			console.log(`[YAMLScript] parsed.contents type: ${parsed.contents?.constructor?.name}`);
			console.log(`[YAMLScript] parsed.contents: ${JSON.stringify(parsed.contents, null, 2).substring(0, 200)}`);
			
			findCodeInNode(parsed.contents);
			console.log(`[YAMLScript] YAML parsing found ${blocks.length} blocks`);
		} catch (error) {
			console.log(`[YAMLScript] YAML parsing failed: ${error}`);
			// If YAML parsing fails, fall back to regex-based extraction
			blocks.push(...this.extractCodeBlocksWithRegex(text));
		}

		console.log(`[YAMLScript] Total blocks found: ${blocks.length}`);
		return blocks;
	}

	private extractCodeBlocksWithRegex(text: string): CodeBlock[] {
		const blocks: CodeBlock[] = [];
		
		// Pattern 1: Look for explicit TypeScript markers (like in comments)
		// # typescript:
		// code: |
		//   const x = 1;
		const tsMarkerPattern = /#\s*typescript:\s*\n\s*\w+:\s*[|>][-+]?\s*\n((?:[ \t]+.*\n?)+)/gi;
		let match;
		
		while ((match = tsMarkerPattern.exec(text)) !== null) {
			const code = match[1];
			const startOffset = match.index + match[0].indexOf(code);
			blocks.push({
				language: 'typescript',
				code: this.dedentCode(code),
				startLine: this.getLineNumber(text, startOffset),
				endLine: this.getLineNumber(text, startOffset + code.length),
				startOffset: startOffset,
				endOffset: startOffset + code.length
			});
		}

		// Pattern 2: Look for blocks with 'script' or 'code' keys containing TypeScript-like content
		const codeBlockPattern = /(\w*script\w*|\w*code\w*):\s*[|>][-+]?\s*\n((?:[ \t]+.*\n?)+)/gi;
		
		while ((match = codeBlockPattern.exec(text)) !== null) {
			const code = match[2];
			if (this.looksLikeTypeScript(code)) {
				const startOffset = match.index + match[0].indexOf(code);
				blocks.push({
					language: 'typescript',
					code: this.dedentCode(code),
					startLine: this.getLineNumber(text, startOffset),
					endLine: this.getLineNumber(text, startOffset + code.length),
					startOffset: startOffset,
					endOffset: startOffset + code.length
				});
			}
		}

		return blocks;
	}

	private looksLikeTypeScript(code: string): boolean {
		// Simple heuristics to detect TypeScript code
		const tsPatterns = [
			/\b(const|let|var|function|class|interface|type|enum|namespace|import|export)\b/,
			/:\s*(string|number|boolean|any|void|unknown|never)/,
			/=>/,
			/\bimport\s+.*\bfrom\b/,
			/<.*>/,  // Generics
		];
		
		return tsPatterns.some(pattern => pattern.test(code));
	}

	private dedentCode(code: string): string {
		const lines = code.split('\n');
		const nonEmptyLines = lines.filter(line => line.trim().length > 0);
		
		if (nonEmptyLines.length === 0) {
			return code;
		}
		
		// Find minimum indentation
		const minIndent = Math.min(...nonEmptyLines.map(line => {
			const match = line.match(/^[ \t]*/);
			return match ? match[0].length : 0;
		}));
		
		// Remove the minimum indentation from all lines
		return lines.map(line => line.substring(minIndent)).join('\n');
	}

	private getLineNumber(text: string, offset: number): number {
		return text.substring(0, offset).split('\n').length - 1;
	}

	private async updateDocument(doc: vscode.TextDocument) {
		if (!this.isYamlDocument(doc)) {
			return;
		}

		console.log(`[YAMLScript] Processing YAML document: ${doc.uri.fsPath}`);

		// Clear old diagnostics
		this.diagnosticCollection.delete(doc.uri);

		const text = doc.getText();
		const codeBlocks = this.extractCodeBlocks(text);
		console.log(`[YAMLScript] Found ${codeBlocks.length} code blocks`);
		
		// Analyze each code block with TypeScript
		const allDiagnostics: vscode.Diagnostic[] = [];
		
		for (const block of codeBlocks) {
			const diagnostics = this.analyzeTypeScriptCode(block, doc.uri, text);
			allDiagnostics.push(...diagnostics);
		}

		if (allDiagnostics.length > 0) {
			console.log(`[YAMLScript] Setting ${allDiagnostics.length} diagnostics`);
			this.diagnosticCollection.set(doc.uri, allDiagnostics);
		}
	}

	private analyzeTypeScriptCode(codeBlock: CodeBlock, sourceUri: vscode.Uri, sourceText: string): vscode.Diagnostic[] {
		const diagnostics: vscode.Diagnostic[] = [];
		
		// Find the actual indentation in the source file at the start of the code block
		const lines = sourceText.split('\n');
		const startLine = codeBlock.startLine;
		
		// Get the first line of actual code in the source
		let yamlIndentation = 0;
		if (startLine < lines.length) {
			const firstCodeLine = lines[startLine];
			const indentMatch = firstCodeLine.match(/^(\s*)/);
			yamlIndentation = indentMatch ? indentMatch[1].length : 0;
			console.log(`[YAMLScript] Source file line ${startLine}: "${firstCodeLine.substring(0, 50)}..."`);
			console.log(`[YAMLScript] Detected indentation: ${yamlIndentation} spaces`);
		}
		
		// The codeBlock.code is already dedented by YAML parser, use it directly
		const codeToAnalyze = codeBlock.code;
		
		// Create a temporary source file for TypeScript to analyze
		const fileName = 'temp.ts';
		const sourceFile = ts.createSourceFile(
			fileName,
			codeToAnalyze,
			ts.ScriptTarget.Latest,
			true
		);

		// Create a simple TypeScript program
		const compilerOptions: ts.CompilerOptions = {
			noEmit: true,
			target: ts.ScriptTarget.Latest,
			module: ts.ModuleKind.ESNext,
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
		};

		const compilerHost: ts.CompilerHost = {
			getSourceFile: (name) => {
				if (name === fileName) {
					return sourceFile;
				}
				// Return undefined for lib files - we'll skip lib checking
				return undefined;
			},
			writeFile: () => { },
			getCurrentDirectory: () => '',
			getDirectories: () => [],
			fileExists: (name) => name === fileName,
			readFile: (name) => name === fileName ? codeToAnalyze : undefined,
			getCanonicalFileName: (name) => name,
			useCaseSensitiveFileNames: () => true,
			getNewLine: () => '\n',
			getDefaultLibFileName: () => 'lib.d.ts',
		};

		const program = ts.createProgram([fileName], compilerOptions, compilerHost);
		const tsDiagnostics = [
			...program.getSyntacticDiagnostics(sourceFile),
			...program.getSemanticDiagnostics(sourceFile)
		];

		console.log(`[YAMLScript] TypeScript found ${tsDiagnostics.length} diagnostics for block at line ${codeBlock.startLine}`);

		// Convert TypeScript diagnostics to VS Code diagnostics
		for (const tsDiag of tsDiagnostics) {
			if (tsDiag.file && tsDiag.start !== undefined) {
				const start = ts.getLineAndCharacterOfPosition(sourceFile, tsDiag.start);
				const end = ts.getLineAndCharacterOfPosition(sourceFile, tsDiag.start + (tsDiag.length || 0));

				// Add back the YAML indentation to the character positions
				const range = new vscode.Range(
					codeBlock.startLine + start.line,
					start.character + yamlIndentation,
					codeBlock.startLine + end.line,
					end.character + yamlIndentation
				);

				const severity = tsDiag.category === ts.DiagnosticCategory.Error
					? vscode.DiagnosticSeverity.Error
					: tsDiag.category === ts.DiagnosticCategory.Warning
					? vscode.DiagnosticSeverity.Warning
					: vscode.DiagnosticSeverity.Information;

				const message = ts.flattenDiagnosticMessageText(tsDiag.messageText, '\n');
				const diagnostic = new vscode.Diagnostic(range, message, severity);
				diagnostic.source = 'TypeScript (in YAML)';
				diagnostic.code = tsDiag.code;

				console.log(`[YAMLScript] Diagnostic at line ${range.start.line}, col ${range.start.character}: ${message.substring(0, 50)}`);
				diagnostics.push(diagnostic);
			}
		}

		return diagnostics;
	}

	private cleanupDocument(doc: vscode.TextDocument) {
		const virtualUris = this.documentToVirtualMap.get(doc.uri.toString());
		
		if (virtualUris) {
			for (const uri of virtualUris) {
				this.virtualDocProvider.deleteDocument(uri);
				this.virtualToSourceMap.delete(uri.toString());
			}
			this.documentToVirtualMap.delete(doc.uri.toString());
		}

		// Clear diagnostics
		this.diagnosticCollection.delete(doc.uri);
	}

	private handleDiagnosticChanges(event: vscode.DiagnosticChangeEvent) {
		for (const uri of event.uris) {
			const uriStr = uri.toString();
			
			// Check if this is a virtual document
			if (uriStr.startsWith('yamlscript-ts:')) {
				console.log(`[YAMLScript] Diagnostics changed for: ${uriStr}`);
				const mapping = this.virtualToSourceMap.get(uriStr);
				
				if (mapping) {
					const diagnostics = vscode.languages.getDiagnostics(uri);
					console.log(`[YAMLScript] Got ${diagnostics.length} diagnostics`);
					this.mapDiagnosticsToSource(mapping.sourceUri, mapping.codeBlock, diagnostics);
				}
			}
		}
	}

	private mapDiagnosticsToSource(
		sourceUri: vscode.Uri,
		codeBlock: CodeBlock,
		diagnostics: vscode.Diagnostic[]
	) {
		const mappedDiagnostics = diagnostics.map(diag => {
			// Map line numbers from virtual document to source document
			const newStart = new vscode.Position(
				codeBlock.startLine + diag.range.start.line,
				diag.range.start.character
			);
			const newEnd = new vscode.Position(
				codeBlock.startLine + diag.range.end.line,
				diag.range.end.character
			);

			const newDiag = new vscode.Diagnostic(
				new vscode.Range(newStart, newEnd),
				diag.message,
				diag.severity
			);
			newDiag.source = 'TypeScript (in YAML)';
			newDiag.code = diag.code;
			
			return newDiag;
		});

		// Get existing diagnostics and merge
		const existingDiagnostics = this.diagnosticCollection.get(sourceUri) || [];
		const allDiagnostics = [...existingDiagnostics, ...mappedDiagnostics];
		
		this.diagnosticCollection.set(sourceUri, allDiagnostics);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('YAMLScript extension is now active!');

	// Initialize the YAML TypeScript manager
	new YamlTypeScriptManager(context);

	// Register a command to test the extension
	const disposable = vscode.commands.registerCommand('yamlscript.helloWorld', () => {
		vscode.window.showInformationMessage('YAMLScript is active! TypeScript in YAML files is now supported.');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
