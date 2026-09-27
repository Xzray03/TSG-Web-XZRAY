import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');
function getAllFiles(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) getAllFiles(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = getAllFiles(srcDir);
const fileMap = new Map(); // absPath -> relative path
allFiles.forEach(f => fileMap.set(path.resolve(f), path.relative(srcDir, f)));

const referenced = new Set();

// Special convention files
allFiles.forEach(file => {
  const rel = path.relative(srcDir, file);
  const base = path.basename(file);
  if (
    ['page.tsx', 'layout.tsx', 'route.ts', 'template.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx', 'index.ts', 'index.tsx'].includes(base) ||
    rel.includes('sanity/schemaTypes') ||
    rel.includes('sanity/queries') ||
    rel.includes('app/studio') ||
    rel.includes('data/')
  ) {
    referenced.add(path.resolve(file));
  }
});

// Parse imports
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /(?:import|from|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const imp = match[1];
    let resolved = null;
    if (imp.startsWith('.')) {
      resolved = path.resolve(path.dirname(file), imp);
    } else if (imp.startsWith('@/') || imp.startsWith('src/')) {
      const clean = imp.replace(/^@\//, '').replace(/^src\//, '');
      resolved = path.resolve(srcDir, clean);
    }

    if (resolved) {
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        const target = resolved + ext;
        if (fileMap.has(target)) {
          referenced.add(target);
          break;
        }
      }
    }
  }
});

const unused = [];
allFiles.forEach(f => {
  const abs = path.resolve(f);
  if (!referenced.has(abs)) {
    unused.push(path.relative(srcDir, f));
  }
});

console.log('Unused files:', unused);
