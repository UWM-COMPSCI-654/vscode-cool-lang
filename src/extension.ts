import * as fs from 'fs';
import * as path from 'path';
import { commands, ExtensionContext, window, workspace } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'cool' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.cool'),
        },
    };

    client = new LanguageClient(
        'cool-language-server',
        'COOL Language Server',
        resolveServerOptions(context),
        clientOptions
    );

    context.subscriptions.push(
        commands.registerCommand('cool.run', () => runCoolFile(context))
    );

    await client.start();
}

function runCoolFile(context: ExtensionContext): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'cool') {
        window.showErrorMessage('Open a .cool file first.');
        return;
    }

    if (editor.document.isDirty) {
        editor.document.save();
    }

    const filePath = editor.document.uri.fsPath;
    const cli = getCliBinaryPath(context);
    const cmd = `"${cli}" run csharp --input "${filePath}"`;

    let terminal = window.terminals.find(t => t.name === 'COOL');
    if (!terminal) {
        terminal = window.createTerminal('COOL');
    }
    terminal.show(true);
    terminal.sendText(cmd);
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

function getCliBinaryPath(context: ExtensionContext): string {
    const binaryName = process.platform === 'win32' ? 'Cli.exe' : 'Cli';
    return context.asAbsolutePath(path.join('server', binaryName));
}

function resolveServerOptions(context: ExtensionContext): ServerOptions {
    // Prefer bundled self-contained binary (no dotnet install required)
    const binaryPath = getCliBinaryPath(context);

    if (fs.existsSync(binaryPath)) {
        return { command: binaryPath, args: ['lsp'] };
    }

    // Fallback: framework-dependent — requires dotnet on PATH (dev mode)
    const dllPath = context.asAbsolutePath(path.join('server', 'Cli.dll'));
    return { command: 'dotnet', args: [dllPath, 'lsp'] };
}
