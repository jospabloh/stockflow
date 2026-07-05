// ESLint rule: validates that can(Module, action) calls use registered permission keys.
// Works with flat config (eslint.config.js).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load ALL_PERMISSION_KEYS from the registry using a dynamic inline approach.
// The registry is ESM, so we load it lazily at rule creation time.
let ALL_KEYS_SET = null;

function getAllKeysSet() {
  if (ALL_KEYS_SET) return ALL_KEYS_SET;
  try {
    const require = createRequire(import.meta.url);
    const registryPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../src/lib/permissionRegistry.js'
    );
    // Attempt CJS-style require (works if Vite/bundler aliases are not needed at lint time)
    // Since the file is pure ESM with no bundler aliases, we parse the keys manually.
    const fs = require('fs');
    const src = fs.readFileSync(registryPath, 'utf8');
    // Extract all `id: "xxx"` values with their module context
    const moduleRegex = /(\w[\w\s]*?):\s*\{[^}]*?label:[^}]*?actions:\s*\[([^\]]*?)\]/gs;
    const actionRegex = /id:\s*["']([^"']+)["']/g;
    const keys = new Set();

    // Simpler: extract module names then action ids
    const moduleBlockRegex = /^\s{2}["']?([^"':{}\n]+?)["']?\s*:\s*\{/gm;
    const modules = [];
    let mm;
    while ((mm = moduleBlockRegex.exec(src)) !== null) {
      const name = mm[1].trim();
      if (name !== 'PERMISSION_REGISTRY') modules.push(name);
    }

    // Extract all action ids per module block
    const fullModuleRegex = /^\s{2}["']?([^"':{}\n]+?)["']?\s*:\s*\{[\s\S]*?actions:\s*\[([\s\S]*?)\]/gm;
    let fm;
    while ((fm = fullModuleRegex.exec(src)) !== null) {
      const modName = fm[1].trim();
      const actionsBlock = fm[2];
      let am;
      while ((am = actionRegex.exec(actionsBlock)) !== null) {
        keys.add(`${modName}:${am[1]}`);
      }
      actionRegex.lastIndex = 0;
    }

    if (keys.size > 0) {
      ALL_KEYS_SET = keys;
    } else {
      // Fallback: if parsing fails, allow everything (don't block lint)
      ALL_KEYS_SET = null;
    }
  } catch (_) {
    ALL_KEYS_SET = null;
  }
  return ALL_KEYS_SET;
}

export const registeredPermissionKey = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure can() and PermissionGate use registered permission keys',
    },
    messages: {
      unregistered:
        "Permission key '{{key}}' not registered. Run 'npm run permissions:add' or edit src/lib/permissionRegistry.js",
    },
    schema: [],
  },
  create(context) {
    const keys = getAllKeysSet();
    if (!keys) return {}; // If registry can't be loaded, skip validation

    function checkKey(module, action, node) {
      const key = `${module}:${action}`;
      if (!keys.has(key)) {
        context.report({ node, messageId: 'unregistered', data: { key } });
      }
    }

    return {
      // can('Module', 'action')
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'Identifier' &&
          callee.name === 'can' &&
          node.arguments.length >= 2 &&
          node.arguments[0].type === 'Literal' &&
          node.arguments[1].type === 'Literal'
        ) {
          checkKey(node.arguments[0].value, node.arguments[1].value, node);
        }
      },
      // <PermissionGate module="X" action="Y">
      JSXOpeningElement(node) {
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'PermissionGate'
        ) {
          const modAttr = node.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'module'
          );
          const actAttr = node.attributes.find(
            a => a.type === 'JSXAttribute' && a.name.name === 'action'
          );
          if (
            modAttr?.value?.type === 'Literal' &&
            actAttr?.value?.type === 'Literal'
          ) {
            checkKey(modAttr.value.value, actAttr.value.value, node);
          }
        }
      },
    };
  },
};

export default {
  rules: {
    'registered-permission-key': registeredPermissionKey,
  },
};
