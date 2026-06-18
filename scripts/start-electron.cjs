const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

// Unset the problematic environment variable
delete process.env.ELECTRON_RUN_AS_NODE;

console.log('[Start Script] Launching Electron...');
console.log('[Start Script] ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE);

const child = spawn(electron, ['.'], {
    env: process.env,
    stdio: 'inherit',
    shell: false,
    cwd: path.join(__dirname, '..')
});

child.on('close', (code) => {
    process.exit(code);
});
