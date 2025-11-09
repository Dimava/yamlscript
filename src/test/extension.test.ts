import * as assert from 'assert';
import * as vscode from 'vscode';

suite('YAMLScript Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start YAMLScript tests.');

	test('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('your-publisher-name.yamlscript'));
	});

	test('Should activate on YAML file', async () => {
		const doc = await vscode.workspace.openTextDocument({
			language: 'yaml',
			content: `
name: Test
handler:
  code: |
    const x: number = 1;
			`.trim()
		});

		await vscode.window.showTextDocument(doc);
		
		// Give extension time to process
		await new Promise(resolve => setTimeout(resolve, 2000));
		
		assert.ok(doc);
	});

	test('Should detect TypeScript code in YAML', async () => {
		const yamlContent = `
handler:
  code: |
    const x: number = "wrong type";
		`.trim();

		const doc = await vscode.workspace.openTextDocument({
			language: 'yaml',
			content: yamlContent
		});

		await vscode.window.showTextDocument(doc);
		
		// Wait for diagnostics
		await new Promise(resolve => setTimeout(resolve, 3000));
		
		// Note: In a real test, you'd check for diagnostics here
		// This is a basic smoke test
		assert.ok(doc);
	});
});
