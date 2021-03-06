import * as vscode from 'vscode';
import { dirname, basename, join } from 'path';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('alt8.findRelatedFiles', async () => {
    const uri = vscode.window.activeTextEditor?.document.uri;
    const file = uri?.path ?? '';
    const projections = await getConfiguration(uri);
    const candidates = await findRelatedFiles(file, projections);
    if (candidates.length) {
      return await showQuickPick(candidates);
    }
    return null;
  });

  context.subscriptions.push(disposable);

  async function getConfiguration(file?: vscode.Uri) {
    const vscodeProjections = JSON.parse(JSON.stringify(
      vscode.workspace.getConfiguration('alt8.projections') ?? {}
    ));
    if (!file) {
      return vscodeProjections;
    }

    try {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
      const projectionsFilePath = join(workspaceFolder?.uri.path || '', '.projections.json');
      const workspaceProjections = JSON.parse((
        await vscode.workspace.fs.readFile(vscode.Uri.file(projectionsFilePath))
      ).toString());
      return {
        ...vscodeProjections,
        ...workspaceProjections
      };
    } catch { }
    return vscodeProjections;
  }

  async function findRelatedFiles(file: string, projections: { [pattern: string]: { "alternate"?: string | string[] } }) {
    const candidates = Array.from(Object.entries(projections).reduce((candidates, [pattern, { alternate }]) => {
      const patternMatch = match(file, pattern);
      if (alternate && patternMatch) {
        [alternate].flat(1).forEach((alternate) => {
          const candidate = expand(alternate, { match: patternMatch, file });
          candidates.add(candidate);
        });
      }
      return candidates;
    }, new Set<string>())).map((path) => vscode.Uri.file(path));

    return (await Promise.allSettled(candidates.map(async (uri) => {
      await vscode.workspace.fs.stat(uri);
      return uri;
    })))
      .filter((it): it is PromiseFulfilledResult<vscode.Uri> => it.status === 'fulfilled')
      .map((it) => it.value);
  }

  async function showQuickPick(candidates: vscode.Uri[]) {
    const quickPickItems = candidates.map((uri) => {
      const relativePath = vscode.workspace.asRelativePath(uri);
      // VSCode doesn't support file type icon for the quick pick dialog
      // @see https://github.com/microsoft/vscode/issues/59826
      return {
        label: relativePath,
        resourceUri: uri
      };
    });
    if (quickPickItems.length === 1) {
      return onDidSelectItem(quickPickItems[0]);
    }
    return vscode.window.showQuickPick(quickPickItems).then(onDidSelectItem);
  }

  async function onDidSelectItem(value: (vscode.QuickPickItem & { resourceUri: vscode.Uri }) | undefined) {
    if (value) {
      const uri = value.resourceUri;
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
      return uri;
    }
    return null;
  }
}

export function deactivate() { }

function match(file: string, pattern: string) {
  if (/^[^*{}]*\*[^*{}]*$/.test(pattern)) {
    pattern = pattern.replace('*', '**/*');
  } else if (/^[^*{}]*\*\*[^*{}]+\*[^*{}]*$/.test(pattern)) {
    pattern = pattern;
  } else {
    return '';
  }
  const [prefix, infix, suffix] = pattern.split(/\*+/);
  if (!file.startsWith(prefix) || !file.endsWith(suffix)) {
    return '';
  }
  const match = file.substring(prefix.length, file.length - suffix.length);
  if (infix === '/') {
    return match;
  }
  const clean = `${match}`.replace(infix, '/');
  return clean === match ? '' : clean;
}

function expand(
  value: string,
  expansions: { match?: string, post_function?: (value: [string]) => string } & { [transform: string]: string },
  transformations: { [k: string]: (value: string, expansion: typeof expansions) => string } = {
    dot: (input) => input.replace(/\//g, '.'),
    underscore: (input) => input.replace(/\//g, '_'),
    backslash: (input) => input.replace(/\//g, '\\'),
    colons: (input) => input.replace(/\//g, '::'),
    hyphenate: (input) => input.replace(/_/g, '-'),
    blank: (input) => input.replace(/[_-]/g, ''),
    uppercase: (input) => input.toUpperCase(),
    camelcase: (input) => input.replace(/[_-](.)/, (_, c) => c.toUpperCase()),
    capitalize: (input) => input.charAt(0).toUpperCase() + input.slice(1),
    dirname: (input) => dirname(input),
    basename: (input) => basename(input),
    open: () => '{',
    close: () => '{',
    nothing: () => '',
    vim: (it) => it
  }
) {
  return value.replace(/{[^{}]*}/g, (pattern) => {
    const transforms = pattern.substring(1, pattern.length - 1).split('|').filter((it) => it);
    let value = expansions[transforms[0]] ?? expansions.match ?? '';
    for (const transform of transforms) {
      if (!transformations[transform]) {
        return '';
      }
      value = transformations[transform](value, expansions);
      if (value === '') {
        return '';
      }
    }
    if (expansions['post_function']) {
      value = expansions['post_function']([value]);
    }
    return value;
  });
}