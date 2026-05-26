import http from 'http'
import { exec } from 'child_process'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 3001
const REDIRECT_URI = `http://localhost:${PORT}/oauth/callback`

// Sessions OAuth en mémoire (state → {clientId, clientSecret, provider, gitlabUrl, done, token, error})
const oauthSessions = new Map()

function buildGitUrl(repoUrl, authType, token, username, password, oauthToken) {
  if (!repoUrl) return repoUrl
  try {
    const url = new URL(repoUrl)
    if (authType === 'oauth') {
      url.username = 'oauth2'
      url.password = oauthToken
    } else if (authType === 'token') {
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

async function exchangeCodeGitHub(clientId, clientSecret, code) {
  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: REDIRECT_URI }),
  })
  const data = await r.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}

async function exchangeCodeGitLab(gitlabUrl, clientId, clientSecret, code) {
  const r = await fetch(`${gitlabUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI }),
  })
  const data = await r.json()
  if (data.error) throw new Error(data.error_description || data.error)
  return data.access_token
}

function callbackHtml(success, message) {
  const emoji = success ? '✅' : '❌'
  const color = success ? '#22c55e' : '#ef4444'
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>PAMIS Simulator — OAuth</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #0f172a; color: #f1f5f9; }
    .box { text-align: center; padding: 40px 60px; border-radius: 16px;
           border: 1px solid #334155; background: #1e293b; }
    h2 { font-size: 24px; margin-bottom: 12px; color: ${color}; }
    p  { color: #94a3b8; margin-bottom: 20px; }
    .countdown { font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="box">
    <div style="font-size:48px">${emoji}</div>
    <h2>${success ? 'Autorisation accordée' : 'Erreur d\'autorisation'}</h2>
    <p>${message}</p>
    <div class="countdown">Fermeture automatique dans <span id="c">3</span>s…</div>
  </div>
  <script>
    let n = 3
    setInterval(() => { document.getElementById('c').textContent = --n; if (n <= 0) window.close() }, 1000)
  </script>
</body>
</html>`
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // ── GET /oauth/callback — redirigé depuis GitHub/GitLab ────────────────────
  if (req.method === 'GET' && req.url.startsWith('/oauth/callback')) {
    const params = new URL(req.url, `http://localhost:${PORT}`).searchParams
    const code  = params.get('code')
    const state = params.get('state')

    const session = oauthSessions.get(state)
    if (!session || !code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(callbackHtml(false, 'Session invalide ou code manquant.'))
      return
    }

    try {
      let token
      if (session.provider === 'gitlab') {
        token = await exchangeCodeGitLab(session.gitlabUrl, session.clientId, session.clientSecret, code)
      } else {
        token = await exchangeCodeGitHub(session.clientId, session.clientSecret, code)
      }
      session.token = token
      session.done  = true
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(callbackHtml(true, 'Vous pouvez fermer cet onglet et retourner dans l\'application.'))
    } catch (err) {
      session.error = String(err)
      session.done  = true
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(callbackHtml(false, String(err)))
    }
    return
  }

  if (req.method !== 'POST') { res.writeHead(405); res.end(); return }

  let body = ''
  req.on('data', chunk => body += chunk)
  req.on('end', async () => {
    const json = (data) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)) }
    const fail = (err)  => { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(err) })) }

    try {
      const data = JSON.parse(body)
      const repoDir = __dirname

      // ── OAuth : démarrer le flow ─────────────────────────────────────────
      if (req.url === '/oauth/start') {
        const { clientId, clientSecret, provider = 'github', gitlabUrl = 'https://gitlab.com' } = data
        if (!clientId || !clientSecret) throw new Error('client_id et client_secret requis')
        const state = randomBytes(16).toString('hex')
        oauthSessions.set(state, { clientId, clientSecret, provider, gitlabUrl, done: false })
        // Nettoyage automatique après 10 minutes
        setTimeout(() => oauthSessions.delete(state), 10 * 60 * 1000)

        let authUrl
        if (provider === 'gitlab') {
          authUrl = `${gitlabUrl}/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=api&state=${state}`
        } else {
          authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=repo&state=${state}`
        }
        json({ ok: true, authUrl, state })

      // ── OAuth : statut du flow (polling) ────────────────────────────────
      } else if (req.url === '/oauth/status') {
        const { state } = data
        const session = oauthSessions.get(state)
        if (!session) { json({ ok: false, done: true, error: 'Session expirée' }); return }
        if (!session.done) { json({ ok: true, done: false }); return }
        if (session.error) { json({ ok: false, done: true, error: session.error }); return }
        oauthSessions.delete(state)
        json({ ok: true, done: true, token: session.token })

      // ── Git : commit + push ──────────────────────────────────────────────
      } else if (req.url === '/git/commit') {
        const { filename, content, message, repoUrl, authType, token = '', username = '', password = '', oauthToken = '', branch = 'main' } = data
        const filePath = resolve(repoDir, filename)
        writeFileSync(filePath, content, 'utf8')
        await runGit(`git add "${filename.replace(/\\/g, '/').replace(/"/g, '\\"')}"`, repoDir)
        await runGit(`git commit -m "${message.replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`, repoDir)
        const authUrl = buildGitUrl(repoUrl, authType, token, username, password, oauthToken)
        await runGit(`git push "${authUrl}" HEAD:refs/heads/${branch}`, repoDir)
        json({ ok: true })

      // ── Git : pull ───────────────────────────────────────────────────────
      } else if (req.url === '/git/pull') {
        const { filename, repoUrl, authType, token = '', username = '', password = '', oauthToken = '', branch = 'main' } = data
        const authUrl = buildGitUrl(repoUrl, authType, token, username, password, oauthToken)
        await runGit(`git pull "${authUrl}" ${branch}`, repoDir)
        const filePath = resolve(repoDir, filename)
        if (!existsSync(filePath)) throw new Error(`Fichier "${filename}" introuvable après le pull`)
        json({ ok: true, content: readFileSync(filePath, 'utf8') })

      // ── Git : lister les fichiers JSON du repo ───────────────────────────
      } else if (req.url === '/git/list') {
        const { repoUrl, authType, token = '', username = '', password = '', oauthToken = '', branch = 'main' } = data
        const authUrl = buildGitUrl(repoUrl, authType, token, username, password, oauthToken)
        await runGit(`git fetch "${authUrl}" ${branch}`, repoDir)
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

server.listen(PORT, () => {
  console.log(`✅  Git server    → http://localhost:${PORT}`)
  console.log(`    OAuth callback → ${REDIRECT_URI}`)
  console.log(`    Répertoire     : ${__dirname}`)
})
