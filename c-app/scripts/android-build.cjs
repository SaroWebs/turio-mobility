const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' };
if (process.platform === 'win32' && !env.ANDROID_HOME && !env.ANDROID_SDK_ROOT && env.LOCALAPPDATA) {
  const sdk = path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
  if (fs.existsSync(path.join(sdk, 'platform-tools', 'adb.exe'))) env.ANDROID_HOME = sdk;
}
if (process.platform === 'win32' && !env.JAVA_HOME) {
  const bundledJdk = path.join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  if (fs.existsSync(path.join(bundledJdk, 'bin', 'java.exe'))) {
    env.JAVA_HOME = bundledJdk;
    console.log('Using Android Studio bundled Java.');
  }
}
if (env.JAVA_HOME) {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = `${path.join(env.JAVA_HOME, 'bin')}${path.delimiter}${env[pathKey] || ''}`;
}
const result = spawnSync(process.execPath, [
  require.resolve('expo/bin/cli'), 'run:android', '--device', ...process.argv.slice(2),
], { env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
