import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commands, debug, DebugConfiguration, DebugConfigurationProvider, ExtensionContext, ProviderResult, window, workspace, WorkspaceFolder, CancellationToken } from 'vscode';
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

    context.subscriptions.push(
        commands.registerCommand('cool.debug', () => debugCoolFile(context))
    );

    const debugProvider = new CoolDebugConfigurationProvider(context);
    context.subscriptions.push(
        debug.registerDebugConfigurationProvider('cool', debugProvider)
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

function debugCoolFile(context: ExtensionContext): void {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'cool') {
        window.showErrorMessage('Open a .cool file first.');
        return;
    }

    if (editor.document.isDirty) {
        editor.document.save();
    }

    const config: DebugConfiguration = {
        type: 'cool',
        request: 'launch',
        name: 'Debug COOL Program',
        program: editor.document.uri.fsPath,
    };

    debug.startDebugging(workspace.workspaceFolders?.[0], config);
}

function buildCoolProgram(cli: string, coolFile: string, outputDir: string): string | undefined {
    try {
        cp.execSync(`"${cli}" build csharp --input "${coolFile}" --output "${outputDir}"`, {
            stdio: 'pipe',
            timeout: 30000,
        });
        return path.join(outputDir, 'CoolProgram.dll');
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        window.showErrorMessage(`COOL build failed: ${msg}`);
        return undefined;
    }
}

class CoolDebugConfigurationProvider implements DebugConfigurationProvider {
    constructor(private context: ExtensionContext) {}

    resolveDebugConfigurationWithSubstitutedVariables(
        _folder: WorkspaceFolder | undefined,
        config: DebugConfiguration,
        _token?: CancellationToken
    ): ProviderResult<DebugConfiguration> {
        const coolFile = config.program;
        if (!coolFile || !coolFile.endsWith('.cool')) {
            window.showErrorMessage('Specify a .cool file as the "program" in your launch configuration.');
            return undefined;
        }

        if (!fs.existsSync(coolFile)) {
            window.showErrorMessage(`File not found: ${coolFile}`);
            return undefined;
        }

        const cli = getCliBinaryPath(this.context);
        const buildDir = path.join(os.tmpdir(), 'cool-debug', path.basename(coolFile, '.cool'));

        const dllPath = buildCoolProgram(cli, coolFile, buildDir);
        if (!dllPath) {
            return undefined;
        }

        // Delegate to the coreclr debugger (provided by the C# extension)
        return {
            type: 'coreclr',
            request: 'launch',
            name: config.name,
            program: dllPath,
            cwd: path.dirname(coolFile),
            console: 'integratedTerminal',
            stopAtEntry: config.stopOnEntry ?? false,
            sourceFileMap: config.sourceFileMap,
        };
    }
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
