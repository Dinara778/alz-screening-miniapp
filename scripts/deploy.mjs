import { execSync } from 'node:child_process';

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
}

const dirty = git('status --porcelain');
if (dirty) {
  console.error('Есть незакоммиченные изменения. Сначала сделайте commit.');
  process.exit(1);
}

const branch = git('rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  console.error(`Деплой только с ветки main (сейчас: ${branch}).`);
  process.exit(1);
}

const remotes = git('remote');
if (!remotes.split('\n').includes('origin')) {
  console.error('Нет remote origin (GitHub).');
  process.exit(1);
}
if (!remotes.split('\n').includes('amvera')) {
  console.error('Нет remote amvera. Добавьте: git remote add amvera <url>');
  process.exit(1);
}

const sha = git('rev-parse --short HEAD');
console.log(`Деплой ${sha} → GitHub + Amvera…`);

run('git push origin main');
run('git push amvera main:master');

console.log(`\nГотово: ${sha}`);
console.log('GitHub: origin/main');
console.log('Прод:   amvera/master (сборка на Amvera ~2–5 мин)');
