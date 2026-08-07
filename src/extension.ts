import * as cp from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { ExtensionContext, ProgressLocation, window, workspace } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
} from 'vscode-languageclient/node';

const GITHUB_REPO = 'UWM-COMPSCI-654/cool-dotnet';
const RELEASE_TAG = 'latest';

let client: LanguageClient;

export async function activate(context: ExtensionContext): Promise<void> {
    const cliBinary = await ensureServerBinary(context);
    if (!cliBinary) {
        window.showErrorMessage('COOL: Could not find or download the server binary.');
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

// --- Server binary resolution ---

function getBinaryName(): string {
    return process.platform === 'win32' ? 'Cli.exe' : 'Cli';
}

function getVsceTarget(): string {
    const p = process.platform;
    const a = process.arch;
    if (p === 'win32') return 'win32-x64';
    if (p === 'darwin') return a === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
    return a === 'arm64' ? 'linux-arm64' : 'linux-x64';
}

async function ensureServerBinary(context: ExtensionContext): Promise<string | undefined> {
    const binaryName = getBinaryName();

    // 1. Bundled binary (platform-specific VSIX)
    const bundled = context.asAbsolutePath(path.join('server', binaryName));
    if (fs.existsSync(bundled)) {
        return bundled;
    }

    // 2. Previously downloaded binary in globalStorage
    const storageDir = context.globalStorageUri.fsPath;
    const downloaded = path.join(storageDir, 'server', binaryName);
    if (fs.existsSync(downloaded)) {
        return downloaded;
    }

    // 3. Download from GitHub Releases
    return downloadServerBinary(context);
}

async function downloadServerBinary(context: ExtensionContext): Promise<string | undefined> {
    const target = getVsceTarget();
    const binaryName = getBinaryName();
    const storageDir = path.join(context.globalStorageUri.fsPath, 'server');

    const assetName = `cool-server-${target}.zip`;
    const url = `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/${assetName}`;

    return window.withProgress(
        { location: ProgressLocation.Notification, title: 'COOL', cancellable: false },
        async (progress) => {
            progress.report({ message: `Downloading server for ${target}...` });

            try {
                fs.mkdirSync(storageDir, { recursive: true });
                const zipPath = path.join(storageDir, assetName);

                await downloadFile(url, zipPath);

                progress.report({ message: 'Extracting...' });
                await extractZip(zipPath, storageDir);
                fs.unlinkSync(zipPath);

                const binaryPath = path.join(storageDir, binaryName);
                if (process.platform !== 'win32') {
                    fs.chmodSync(binaryPath, 0o755);
                }

                if (fs.existsSync(binaryPath)) {
                    return binaryPath;
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                window.showErrorMessage(`COOL: Failed to download server: ${msg}`);
            }
            return undefined;
        }
    );
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const follow = (u: string) => {
            https.get(u, { headers: { 'User-Agent': 'vscode-cool-lang' } }, (res) => {
                if (res.statusCode === 302 || res.statusCode === 301) {
                    follow(res.headers.location!);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode} from ${u}`));
                    return;
                }
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => { file.close(); resolve(); });
                file.on('error', reject);
            }).on('error', reject);
        };
        follow(url);
    });
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const cmd = process.platform === 'win32'
            ? `powershell -NoProfile -Command "Expand-Archive -Force '${zipPath}' '${destDir}'"`
            : `unzip -o "${zipPath}" -d "${destDir}"`;
        cp.exec(cmd, (err) => err ? reject(err) : resolve());
    });
}
