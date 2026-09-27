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
const relativeFiles = allFiles.map(f => path.relative(srcDir, f));

// Identify entry / convention files
const entryFiles = relativeFiles.filter(f => {
  const base = path.basename(f);
  return [
    'page.tsx', 'layout.tsx', 'route.ts', 'template.tsx',
    'loading.tsx', 'error.tsx', 'not-found.tsx', 'index.ts', 'index.tsx'
  ].includes(base) || f.includes('sanity/schemaTypes') || f.includes('sanity/queries') || f.includes('studio/');
});

console.log(JSON.stringify({
  count: relativeFiles.length,
  files: relativeFiles,
  entryFiles: entryFiles
}, null, 2));
