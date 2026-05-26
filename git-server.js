import http from 'http'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 3001

function buildGitUrl(repoUrl, authType, token, username, password) {
  if (!repoUrl) return repoUrl
  try {
    const url = new URL(repoUrl)
    if (authType === 'token') {
      url.username = 'oauth2'
      url.password = token
    } else {
      url.username = encodeURIComponent(username)
      url.password = encodeURIComponent(password)
    }
    return url.toString()
  } catch {
    return repoUrl
  }
}

function runGit(cmd, cwd) {
  return new Promise((res, rej) => {
    exec(cmd, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, stdout, stderr) => {
      if (err) rej((stderr || err.message).trim())
      else res(stdout.trim())
    })
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  if (req.method !== 'POST')   { res.writeHead(405); res.end(); return }

  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', async () => {
    const json = data => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    const fail = err  => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(err) })) }

    try {
      const data = JSON.parse(body)
      const repoDir = __dirname

      if (req.url === '/git/commit') {
        const { filename, content, message, repoUrl, authType, token = '', username = '', password = '', branch = 'main' } = data
        writeFileSync(resolve(repoDir, filename), content, 'utf8')
        await runGit(`git add "${filename.replace(/\\/g, '/').replace(/"/g, '\\"')}"`, repoDir)
        await runGit(`git commit -m "${message.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`, repoDir)
        await runGit(`git push "${buildGitUrl(repoUrl, authType, token, username, password)}" HEAD:refs/heads/${branch}`, repoDir)
        json({ ok: true })

      } else if (req.url === '/git/pull') {
        const { filename, repoUrl, authType, token = '', username = '', password = '', branch = 'main' } = data
        await runGit(`git pull "${buildGitUrl(repoUrl, authType, token, username, password)}" ${branch}`, repoDir)
        const filePath = resolve(repoDir, filename)
        if (!existsSync(filePath)) throw new Error(`Fichier "${filename}" introuvable après le pull`)
        json({ ok: true, content: readFileSync(filePath, 'utf8') })

      } else if (req.url === '/git/list') {
        const { repoUrl, authType, token = '', username = '', password = '', branch = 'main' } = data
        await runGit(`git fetch "${buildGitUrl(repoUrl, authType, token, username, password)}" ${branch}`, repoDir)
        const lsOutput = await runGit('git ls-tree -r --name-only FETCH_HEAD', repoDir)
        const files = lsOutput.split('\n').filter(f => f.endsWith('.json')).sort()
        json({ ok: true, files })

      } else {
        res.writeHead(404); res.end()
      }
    } catch (err) {
      fail(err)
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  Git server → http://0.0.0.0:${PORT}  (toutes interfaces)`)
  console.log(`    Répertoire : ${__dirname}`)
})
