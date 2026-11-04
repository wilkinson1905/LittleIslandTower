// Builds the game and puts it on the gh-pages branch as index.html: node tools/publish.mjs ["commit message"]
// Works on git objects directly, so the working tree and the current branch are left alone.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { withAnalytics } from './analytics.mjs';

const git = (args, input) => execFileSync('git', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] }).trim();
const message = process.argv[2] || `Publish ${git(['rev-parse', '--short', 'HEAD'])}`;

execFileSync('node', ['build.mjs'], { stdio: 'inherit' });

// only the public page can count visits; the development build stays free of outside references
const page = git(['hash-object', '-w', '--stdin'], withAnalytics(readFileSync('dollhouse.html', 'utf8')));
const empty = git(['hash-object', '-w', '--stdin'], '');
const tree = git(['mktree'], `100644 blob ${empty}\t.nojekyll\n100644 blob ${page}\tindex.html\n`);

let parent = null;
try {
  git(['fetch', 'origin', 'gh-pages']);
  parent = git(['rev-parse', 'FETCH_HEAD']);
} catch { /* first publish: the branch does not exist yet */ }

if (parent && git(['rev-parse', `${parent}^{tree}`]) === tree) {
  console.log('gh-pages is already up to date');
} else {
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message]);
  git(['push', 'origin', `${commit}:refs/heads/gh-pages`]);
  console.log(`published ${commit.slice(0, 7)} to gh-pages`);
}
