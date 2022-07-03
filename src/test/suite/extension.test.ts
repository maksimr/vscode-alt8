import * as assert from 'assert';
import * as vscode from 'vscode';

describe('Extension', () => {
  describe('vscode settings', () => {
    it('should jump to test file', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const fooUri = vscode.Uri.file(`${workspaceFolder!.uri.path}/foo.js`);
      const document = await vscode.workspace.openTextDocument(fooUri);
      await vscode.window.showTextDocument(document);
      await vscode.commands.executeCommand('alt8.findRelatedFiles');
      const activeUri = vscode.window.activeTextEditor?.document.uri;
      const fooTestPath = `${workspaceFolder!.uri.path}/foo.test.js`;
      assert.strictEqual(activeUri?.path, fooTestPath);
    }).timeout(5000);
  });
});
