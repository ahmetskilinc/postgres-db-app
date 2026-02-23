import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, '..', 'node_modules', 'electron', 'dist')
const appPath = join(distPath, 'Electron.app')
const plistPath = join(appPath, 'Contents', 'Info.plist')

if (process.platform === 'darwin' && existsSync(appPath)) {
  // Patch CFBundleName and CFBundleDisplayName
  if (existsSync(plistPath)) {
    let plist = readFileSync(plistPath, 'utf-8')
    const orig = plist
    plist = plist
      .replace(
        /<key>CFBundleDisplayName<\/key>\s*<string>Electron<\/string>/,
        '<key>CFBundleDisplayName</key>\n\t<string>PG App</string>'
      )
      .replace(
        /<key>CFBundleName<\/key>\s*<string>Electron<\/string>/,
        '<key>CFBundleName</key>\n\t<string>PG App</string>'
      )
    if (plist !== orig) {
      writeFileSync(plistPath, plist, 'utf-8')
      console.log('✓ Electron bundle name patched to PG App')
    }
  }

  // Re-sign after patching
  try {
    execSync(`xattr -cr "${appPath}"`, { stdio: 'ignore' })
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'ignore' })
    console.log('✓ Electron re-signed for local development')
  } catch {
    // Non-fatal
  }
}
