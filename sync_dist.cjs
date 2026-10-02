const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// 1. Sync HTML files
const htmlFiles = [
  'index.html',
  'solutions.html',
  'services.html',
  'work.html',
  'portfolio.html',
  'process.html',
  'about.html',
  'insights.html',
  'contact.html',
  'careers.html',
  'privacy.html',
  'terms.html',
  'verify.html'
];

for (const f of htmlFiles) {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join('dist', f));
    console.log(`Synced ${f} -> dist/${f}`);
  }
}

// 2. Sync directories
const dirs = ['css', 'js', 'img', 'data', 'admin', 'work'];
for (const d of dirs) {
  copyRecursive(d, path.join('dist', d));
  console.log(`Synced dir ${d} -> dist/${d}`);
}

// 3. Sync meta files
const metaFiles = ['robots.txt', 'sitemap.xml', 'netlify.toml'];
for (const m of metaFiles) {
  if (fs.existsSync(m)) {
    fs.copyFileSync(m, path.join('dist', m));
    console.log(`Synced ${m} -> dist/${m}`);
  }
}

console.log('Complete sync finished successfully!');
