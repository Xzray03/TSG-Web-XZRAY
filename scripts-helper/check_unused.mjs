import fs from 'fs';
import path from 'path';

const srcDir = path.resolve('src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const allFiles = getAllFiles(srcDir);
const fileSet = new Set(allFiles.map(f => path.resolve(f)));

// Special files that don't need to be imported:
// - Next.js App Router special files: page.tsx, layout.tsx, route.ts, template.tsx, loading.tsx, error.tsx, not-found.tsx
// - Sanity schema index / config / studio files referenced by Sanity config or structure
// - Files referenced dynamically or via string config

const referencedFiles = new Set();

// Always consider entry/special Next.js and Sanity files referenced
allFiles.forEach(file => {
  const rel = path.relative(srcDir, file);
  const base = path.basename(file);
  if (
    ['page.tsx', 'layout.tsx', 'route.ts', 'template.tsx', 'loading.tsx', 'error.tsx', 'not-found.tsx', 'index.ts'].some(s => base === s) ||
    rel.includes('sanity/schemaTypes') ||
    rel.includes('sanity/queries') ||
    rel.includes('app/studio') ||
    rel.includes('data/')
  ) {
    referencedFiles.add(path.resolve(file));
  }
});

// Read content of all ts/tsx/js files and extract import/require statements or string paths
allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match import ... from '...' or import('...') or require('...')
  const importRegex = /(?:import|from|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    let imp = match[1];
    if (imp.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), imp);
      // check possible extensions
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        if (fileSet.has(resolved + ext)) {
          referencedFiles.add(resolved + ext);
          break;
        }
      }
    } else if (imp.startsWith('@/') || imp.startsWith('src/')) {
      const cleanImp = imp.replace(/^@\//, 'src/').replace(/^src\//, '');
      const resolved = path.resolve(srcDir, cleanImp);
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
      for (const ext of extensions) {
        if (fileSet.has(resolved + ext)) {
          referencedFiles.add(resolved + ext);
          break;
        }
      }
    }
  }
});

const unused = allFiles.filter(f => !referencedFiles.has(path.resolve(f)));
console.log('UNREFERENCED FILES:');
unused.forEach(f => console.log(path.relative(srcDir, f)));
