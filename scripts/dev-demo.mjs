import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const vite = new URL('../node_modules/vite/bin/vite.js', import.meta.url)
const child = spawn(process.execPath, [fileURLToPath(vite), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_JANUS_API_URL: 'http://127.0.0.1:5000', VITE_LOCAL_DEMO: 'true' },
})
child.on('error', (error) => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
