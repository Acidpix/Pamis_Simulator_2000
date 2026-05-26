import http from 'http'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'fs'
import { resolve } from 'path'
import { tmpdir } from 'os'

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

function makeTempDir() {
  // Crée /tmp/pamis-XXXXXX/ et retourne le chemin du sous-dossier repo/ (pas encore créé)
  const parent = mkdtempSync(resolve(tmpdir(), 'pamis-'))
  return { parent, repo: resolve(parent, 'repo') }
}

function cleanup(parent) {
  try { rmSync(parent, { recursive: true, force: true }) } catch {}
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    const json = data => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    const fail = err  => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(err) })) }

    let parent = null
    try {
      const data = JSON.parse(body)

      if (req.url === '/git/commit') {
        const { filename, content, message, repoUrl, authType, token = '', username = '', password = '', branch = 'main' } = data
        const authUrl = buildGitUrl(repoUrl, authType, token, username, password)
        const logUrl = repoUrl.replace(/:[^@]*@/, ':***@')
        console.log(`  → clone: ${logUrl}`)
        ;({ parent } = makeTempDir())
        const repo = resolve(parent, 'repo')
        await runGit(`git clone --depth 1 "${authUrl}" "${repo}"`, tmpdir())
        writeFileSync(resolve(repo, filename), content, 'utf8')
        console.log('  → git add…')
        await runGit(`git add "${filename.replace(/\\/g, '/').replace(/"/g, '\\"')}"`, repo)
        console.log('  → git commit…')
        await runGit(`git -c user.email="pamis@local" -c user.name="PAMIS" commit -m "${message.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`, repo)
        console.log('  → git push…')
        await runGit(`git push origin HEAD:refs/heads/${branch}`, repo)
        console.log('  ✓ commit+push OK')
        json({ ok: true })

      } else if (req.url === '/git/pull') {
        const { filename, repoUrl, authType, token = '', username = '', password = '', branch = 'main' } = data
        const authUrl = buildGitUrl(repoUrl, authType, token, username, password)
        console.log(`  → clone: ${repoUrl}`)
        ;({ parent } = makeTempDir())
        const repo = resolve(parent, 'repo')
        await runGit(`git clone --depth 1 --branch "${branch}" "${authUrl}" "${repo}"`, tmpdir())
        const filePath = resolve(repo, filename)
        if (!existsSync(filePath)) throw new Error(`Fichier "${filename}" introuvable dans le dépôt`)
        json({ ok: true, content: readFileSync(filePath, 'utf8') })

      } else if (req.url === '/git/list') {
        const { repoUrl, authType, token = '', username = '', password = '', branch = 'main' } = data
        const authUrl = buildGitUrl(repoUrl, authType, token, username, password)
        console.log(`  → clone (no-checkout): ${repoUrl}`)
        ;({ parent } = makeTempDir())
        const repo = resolve(parent, 'repo')
        await runGit(`git clone --depth 1 --no-checkout --branch "${branch}" "${authUrl}" "${repo}"`, tmpdir())
        const lsOutput = await runGit('git ls-tree HEAD --name-only', repo)
        const files = lsOutput.split('\n').filter(f => f.endsWith('.json')).sort()
        json({ ok: true, files })

      } else {
        res.writeHead(404); res.end()
      }
    } catch (err) {
      console.error('  ✗ Erreur :', String(err))
      fail(err)
    } finally {
      if (parent) cleanup(parent)
    }
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅  Git server → http://0.0.0.0:${PORT}  (toutes interfaces)`)
})
