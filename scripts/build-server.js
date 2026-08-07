#!/usr/bin/env node
// Builds self-contained Cli binaries for the current host platform.
// - server/       single-file binary for LSP and Run
// - server-debug/ multi-file binary for debugging (vsdbg compatible)
const { execSync } = require('child_process');
const { chmodSync } = require('fs');
const { platform, arch } = require('os');
const path = require('path');

const os = platform();
let rid;
if (os === 'win32') rid = 'win-x64';
else if (os === 'darwin') rid = arch() === 'arm64' ? 'osx-arm64' : 'osx-x64';
else rid = arch() === 'arm64' ? 'linux-arm64' : 'linux-x64';

const cliProj = path.resolve(__dirname, '..', '..', 'Cli', 'Cli.csproj');
const outDir = path.resolve(__dirname, '..', 'server');
const debugOutDir = path.resolve(__dirname, '..', 'server-debug');
const binary = os === 'win32' ? 'Cli' : 'Cli';

console.log(`Publishing single-file server for ${rid} -> server/`);
execSync(
    `dotnet publish "${cliProj}" -c Release -r ${rid} --self-contained true -p:PublishSingleFile=true -o "${outDir}"`,
    { stdio: 'inherit' }
);

console.log(`Publishing debug server for ${rid} -> server-debug/`);
execSync(
    `dotnet publish "${cliProj}" -c Debug -r ${rid} --self-contained true -o "${debugOutDir}"`,
    { stdio: 'inherit' }
);

if (os !== 'win32') {
    chmodSync(path.join(outDir, 'Cli'), 0o755);
    chmodSync(path.join(debugOutDir, 'Cli'), 0o755);
}
console.log('Done.');
