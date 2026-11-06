// Publishes the app to GitHub Pages: tests, builds, then pushes dist/ to the gh-pages branch.
// gh-pages only ever holds build output, so each publish replaces it with a single fresh commit.
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';

const run = (command, cwd) => execSync(command, { stdio: 'inherit', cwd });
const repo = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();

run('npm test');
run('npm run build');

writeFileSync('dist/.nojekyll', ''); // serve files exactly as built

try {
  run('git init -q -b gh-pages', 'dist');
  run('git add -A', 'dist');
  run('git commit -q -m "Publish Pixel Palette build"', 'dist');
  run(`git push --force ${repo} gh-pages`, 'dist');
} finally {
  rmSync('dist/.git', { recursive: true, force: true });
}

// A push normally starts the Pages build. This asks for one too, in case it doesn't.
try {
  const slug = repo.replace(/^.*github\.com[/:]/, '').replace(/\.git$/, '');
  execSync(`gh api -X POST repos/${slug}/pages/builds`, { stdio: 'ignore' });
} catch {
  console.log('Could not request a Pages build. If the site does not update, see the README.');
}

console.log('\nPublished. The live site updates in about a minute.');
