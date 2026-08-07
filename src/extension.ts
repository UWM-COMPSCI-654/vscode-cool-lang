import * as fs from 'fs';
import * as path from 'path';
import { ExtensionContext, window, workspace } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
    const cliBinary = resolveServerBinary(context);
    if (!cliBinary) {
        window.showErrorMessage('COOL: No server binary found for this platform.');
        return;
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'cool' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/*.cool'),
        },
    };

    const serverOptions: ServerOptions = { command: cliBinary, args: ['lsp'] };

    client = new LanguageClient(
        'cool-language-server',
        'COOL Language Server',
        serverOptions,
        clientOptions
    );

    await client.start();
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}

function resolveServerBinary(context: ExtensionContext): string | undefined {
    const platform = getPlatformDir();
    const binaryName = process.platform === 'win32' ? 'Cli.exe' : 'Cli';

    // Multi-platform VSIX: server/<platform>/Cli[.exe]
    const multiPlatform = context.asAbsolutePath(path.join('server', platform, binaryName));
    if (fs.existsSync(multiPlatform)) return multiPlatform;

    // Single-platform VSIX fallback: server/Cli[.exe]
    const singlePlatform = context.asAbsolutePath(path.join('server', binaryName));
    if (fs.existsSync(singlePlatform)) return singlePlatform;

    return undefined;
}

function getPlatformDir(): string {
    const p = process.platform;
    const a = process.arch;
    if (p === 'win32') return 'win-x64';
    if (p === 'darwin') return a === 'arm64' ? 'osx-arm64' : 'osx-x64';
    return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
}
