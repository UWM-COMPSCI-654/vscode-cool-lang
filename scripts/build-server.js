#!/usr/bin/env node
// Builds a self-contained single-file Cli binary for the current host platform.
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

console.log(`Publishing self-contained server for ${rid} -> server/`);
execSync(
    `dotnet publish "${cliProj}" -c Release -r ${rid} --self-contained true -p:PublishSingleFile=true -o "${outDir}"`,
    { stdio: 'inherit' }
);

if (os !== 'win32') {
    chmodSync(path.join(outDir, 'Cli'), 0o755);
}
console.log('Done.');
