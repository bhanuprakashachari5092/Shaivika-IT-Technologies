const fs = require('fs');
const path = require('path');

const files = [
  'index.html',
  'solutions.html',
  'services.html',
  'work.html',
  'portfolio.html',
  'process.html',
  'about.html',
  'insights.html',
  'contact.html',
  'privacy.html',
  'terms.html',
  'work/kaizenq.html',
  'work/smr-car-travels.html',
  'work/textile-ecommerce.html'
];

let hasErrors = false;

console.log("--- 1. Link & Navigation Audits ---");
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');

    // Find href="..."
    const hrefRegex = /href="([^"]+)"/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
      let link = match[1];

      // Ignore external and special links
      if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('tel:') || link.startsWith('css/') || link.startsWith('img/') || link.startsWith('#') || link.startsWith('../css/')) {
        continue;
      }

      // Strip query strings or hash
      const cleanLink = link.split('?')[0].split('#')[0];
      if (!cleanLink) continue;

      // Handle relative paths from work/
      let resolvedFile = cleanLink;
      if (file.startsWith('work/')) {
        if (cleanLink.startsWith('../')) {
          resolvedFile = cleanLink.replace('../', '');
        } else {
          resolvedFile = path.posix.join('work', cleanLink);
        }
      }

      // Check if internal file exists
      if (!files.includes(resolvedFile) && !fs.existsSync(path.join(__dirname, resolvedFile))) {
        console.error(`[ERROR] Broken link found in ${file}: ${link} -> resolved: ${resolvedFile}`);
        hasErrors = true;
      }
    }
  }
});

if (!hasErrors) {
  console.log("[SUCCESS] All internal HTML links across all pages and case studies are 100% valid!");
} else {
  console.error("[FAILURE] Broken links detected.");
}

// 2. Audit empty links href="#"
console.log("\n--- Checking for empty or placeholder links (href=\"#\") ---");
let emptyCount = 0;
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = (content.match(/href="#"/g) || []).length;
    if (matches > 0) {
      console.log(`[WARNING] Found ${matches} empty link(s) (href="#") in ${file}.`);
      emptyCount += matches;
    }
  }
});
if (emptyCount === 0) {
  console.log("[SUCCESS] Zero empty href='#' links found!");
}
