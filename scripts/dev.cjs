const { spawn } = require('child_process');
const path = require('path');

const cwd = path.join(__dirname, '..');
const cp = spawn('vercel', ['dev'], { stdio: 'inherit', cwd, shell: true });

cp.on('error', (err) => {
  console.error('Failed to start vercel dev:', err.message);
  process.exit(1);
});

cp.on('exit', (code) => process.exit(code == null ? 0 : code));
