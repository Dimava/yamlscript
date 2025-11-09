import * as vscode from 'vscode';
import * as yaml from 'yaml';

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
		
		try {
			// Parse YAML and look for TypeScript code blocks
			const parsed = yaml.parseDocument(text);
			
			// Walk through the document looking for strings that might be TypeScript code
			// This is a simple heuristic - look for multiline strings or specific keys
			const findCodeInNode = (node: any, path: string = ''): void => {
				if (!node) {
					return;
				}

				if (node.type === 'PAIR') {
					const key = node.key?.value;
					const value = node.value;
					
					// Check if this looks like a TypeScript code block
					if (value && typeof value.value === 'string') {
						const code = value.value;
						// Heuristic: check if it looks like TypeScript code
						if (this.looksLikeTypeScript(code)) {
							const range = value.range;
							if (range) {
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
					for (const pair of node.items || []) {
						findCodeInNode(pair, path);
					}
				} else if (node.type === 'SEQ') {
					for (const item of node.items || []) {
						findCodeInNode(item, path);
					}
				}
			};

			findCodeInNode(parsed.contents);
		} catch (error) {
			// If YAML parsing fails, fall back to regex-based extraction
			blocks.push(...this.extractCodeBlocksWithRegex(text));
		}

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

		// Clean up old virtual documents for this file
		this.cleanupDocument(doc);

		const codeBlocks = this.extractCodeBlocks(doc.getText());
		const virtualUris: vscode.Uri[] = [];

		for (let i = 0; i < codeBlocks.length; i++) {
			const block = codeBlocks[i];
			
			// Create a unique URI for this code block
			const virtualUri = vscode.Uri.parse(
				`yamlscript-ts:${doc.uri.fsPath}.block${i}.ts`
			);

			// Store mapping
			virtualUris.push(virtualUri);
			this.virtualToSourceMap.set(virtualUri.toString(), {
				sourceUri: doc.uri,
				codeBlock: block
			});

			// Update virtual document content
			this.virtualDocProvider.updateDocument(virtualUri, block.code);

			// Open the virtual document to trigger TypeScript language server
			await vscode.workspace.openTextDocument(virtualUri);
		}

		this.documentToVirtualMap.set(doc.uri.toString(), virtualUris);
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
				const mapping = this.virtualToSourceMap.get(uriStr);
				
				if (mapping) {
					const diagnostics = vscode.languages.getDiagnostics(uri);
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
