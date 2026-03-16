import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Minimal CJS→ESM plugin for the shared pipeline package.
 * Pipeline source files use module.exports (CJS) for Cloud Functions compatibility.
 * This plugin converts them to ESM at serve time so Vite can handle them.
 */
function pipelineCjsPlugin() {
  return {
    name: 'pipeline-cjs-to-esm',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('packages/pipeline/src/')) return null;
      if (!code.includes('module.exports')) return null;

      // Convert require("./foo") → import statements
      let transformed = code;
      const requires = [];
      transformed = transformed.replace(
        /const (\w+) = require\("\.\/(\w+)"\);?/g,
        (_, varName, modName) => {
          requires.push({ varName, modName });
          return `import ${varName} from "./${modName}.js";`;
        }
      );

      // Convert module.exports = { ... } → named exports
      transformed = transformed.replace(
        /module\.exports\s*=\s*\{([^}]+)\};?/,
        (_, body) => {
          const names = body
            .split(',')
            .map(s => s.replace(/\/\/.*/, '').trim())
            .filter(Boolean)
            .map(s => {
              // Handle "key: value" patterns (e.g., normalizeRows: normalize.normalizeRows)
              const match = s.match(/^(\w+)\s*:\s*\w+\.(\w+)$/);
              if (match) return match[1];
              // Handle "key: value" where key === value (re-export)
              const match2 = s.match(/^(\w+)\s*:\s*(\w+)$/);
              if (match2) return match2[1];
              // Plain identifier
              return s.match(/^\w+$/) ? s : null;
            })
            .filter(Boolean);
          return `export { ${names.join(', ')} };`;
        }
      );

      return { code: transformed, map: null };
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [pipelineCjsPlugin(), react()],
  resolve: {
    alias: {
      // Resolve "xlsx" from frontend/node_modules even when imported
      // from packages/pipeline/ (outside the frontend root)
      xlsx: path.resolve(__dirname, 'node_modules/xlsx'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
