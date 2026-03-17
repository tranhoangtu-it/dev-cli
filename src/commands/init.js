import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { logger } from '../utils/logger.js';

const TEMPLATES = {
  node: {
    files: {
      'package.json': (name) => JSON.stringify({
        name,
        version: '1.0.0',
        description: '',
        main: 'src/index.js',
        type: 'module',
        scripts: {
          start: 'node src/index.js',
          test: 'node --test',
          dev: 'node --watch src/index.js',
        },
        keywords: [],
        author: '',
        license: 'MIT',
      }, null, 2),
      'src/index.js': () => `// Entry point\nconsole.log('Hello, World!');\n`,
      'README.md': (name) => `# ${name}\n\nA Node.js project.\n`,
      '.gitignore': () => `node_modules/\n.env\ndist/\ncoverage/\n`,
    },
  },
  react: {
    files: {
      'package.json': (name) => JSON.stringify({
        name,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
          test: 'vitest',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.0.0',
          vite: '^5.0.0',
          vitest: '^1.0.0',
        },
      }, null, 2),
      'index.html': (name) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>\n`,
      'src/main.jsx': () => `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
      'src/App.jsx': (name) => `export default function App() {\n  return <h1>Welcome to ${name}</h1>;\n}\n`,
      '.gitignore': () => `node_modules/\ndist/\n.env\n`,
    },
  },
};

/**
 * Create all files for a template recursively
 */
function createTemplateFiles(baseDir, files, name) {
  for (const [relativePath, contentFn] of Object.entries(files)) {
    const fullPath = join(baseDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, contentFn(name));
    logger.step(`Created ${relativePath}`);
  }
}

/**
 * Init command handler
 */
export async function initCommand(name, options) {
  const projectName = name || 'my-project';
  const { template, git, install } = options;

  if (!TEMPLATES[template]) {
    logger.error(`Unknown template "${template}". Available: ${Object.keys(TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  const projectDir = join(process.cwd(), projectName);

  if (existsSync(projectDir)) {
    logger.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  logger.info(`Initializing project: ${projectName} (template: ${template})`);

  try {
    mkdirSync(projectDir, { recursive: true });
    createTemplateFiles(projectDir, TEMPLATES[template].files, projectName);

    if (git) {
      logger.step('Initializing git repository...');
      // Use execFileSync (not exec) to prevent shell injection — args are all hardcoded
      execFileSync('git', ['init'], { cwd: projectDir, stdio: 'ignore' });
      execFileSync('git', ['add', '.'], { cwd: projectDir, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'chore: initial commit'], { cwd: projectDir, stdio: 'ignore' });
      logger.success('Git repository initialized');
    }

    if (install && existsSync(join(projectDir, 'package.json'))) {
      logger.step('Installing dependencies...');
      try {
        execFileSync('npm', ['install'], { cwd: projectDir, stdio: 'inherit' });
        logger.success('Dependencies installed');
      } catch {
        logger.warn('Dependency installation failed. Run "npm install" manually.');
      }
    }

    logger.success(`Project "${projectName}" created successfully!`);
    logger.info(`\nNext steps:\n  cd ${projectName}\n  npm run dev`);
  } catch (err) {
    logger.error(`Failed to create project: ${err.message}`);
    process.exit(1);
  }
}
