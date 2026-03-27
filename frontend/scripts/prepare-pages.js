const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!fs.existsSync(distDir)) {
  throw new Error(`dist folder not found: ${distDir}`);
}

function rewriteIndexHtml() {
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html
    .replace(/href="\//g, 'href="./')
    .replace(/src="\//g, 'src="./');

  fs.writeFileSync(indexPath, html, 'utf8');
}

function rewriteJsBundles() {
  const webBundleDir = path.join(distDir, '_expo', 'static', 'js', 'web');
  if (!fs.existsSync(webBundleDir)) return;

  const files = fs.readdirSync(webBundleDir).filter((name) => name.endsWith('.js'));
  for (const file of files) {
    const filePath = path.join(webBundleDir, file);
    let js = fs.readFileSync(filePath, 'utf8');

    js = js
      .replace(/"\/assets\//g, '"./assets/')
      .replace(/'\/assets\//g, "'./assets/")
      .replace(/"\/_expo\//g, '"./_expo/')
      .replace(/'\/_expo\//g, "'./_expo/");

    fs.writeFileSync(filePath, js, 'utf8');
  }
}

rewriteIndexHtml();
rewriteJsBundles();

console.log('GitHub Pages paths prepared in dist/');
