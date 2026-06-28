const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const existingBuild = path.join(backendDir, 'build', 'index.html');

const clientCandidates = [
  path.join(backendDir, 'clients'),
  path.join(backendDir, '..', 'clients'),
];

const clientsDir = clientCandidates.find((dir) => fs.existsSync(path.join(dir, 'package.json')));

if (!clientsDir) {
  if (fs.existsSync(existingBuild)) {
    console.log('⚠️  clients/ introuvable — build existant conservé (déploiement Render OK).');
    process.exit(0);
  }
  console.error('❌ Dossier clients/ introuvable et aucun build/ présent.');
  clientCandidates.forEach((dir) => console.error(`   - ${dir}`));
  process.exit(1);
}

console.log(`✅ Frontend trouvé : ${clientsDir}`);

const install = () => {
  const hasLock = fs.existsSync(path.join(clientsDir, 'package-lock.json'));
  try {
    if (hasLock) {
      execSync('npm ci', { cwd: clientsDir, stdio: 'inherit' });
    } else {
      execSync('npm install', { cwd: clientsDir, stdio: 'inherit' });
    }
  } catch (_err) {
    console.warn('⚠️  npm ci a échoué, nouvel essai avec npm install...');
    execSync('npm install', { cwd: clientsDir, stdio: 'inherit' });
  }
};

install();

execSync('npm run build', {
  cwd: clientsDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    GENERATE_SOURCEMAP: 'false',
    REACT_APP_API_URL: '/api',
      REACT_APP_USE_MOCK: process.env.REACT_APP_USE_MOCK === 'true' ? 'true' : 'false',
  console.error('❌ Build React invalide (index.html manquant).');
  process.exit(1);
}

fs.rmSync(targetBuild, { recursive: true, force: true });
fs.cpSync(sourceBuild, targetBuild, { recursive: true });

console.log(`✅ Build copié vers ${targetBuild}`);
