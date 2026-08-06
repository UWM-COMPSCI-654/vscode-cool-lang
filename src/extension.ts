import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, workspace } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
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

    await client.start();
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

function resolveServerOptions(context: ExtensionContext): ServerOptions {
    // Prefer bundled self-contained binary (no dotnet install required)
    const binaryName = process.platform === 'win32' ? 'Cli.exe' : 'Cli';
    const binaryPath = context.asAbsolutePath(path.join('server', binaryName));

    if (fs.existsSync(binaryPath)) {
        return { command: binaryPath, args: ['lsp'], transport: TransportKind.stdio };
    }

    // Fallback: framework-dependent — requires dotnet on PATH (dev mode)
    const dllPath = context.asAbsolutePath(path.join('server', 'Cli.dll'));
    return { command: 'dotnet', args: [dllPath, 'lsp'], transport: TransportKind.stdio };
}
