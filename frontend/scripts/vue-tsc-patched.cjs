#!/usr/bin/env node
const fs = require('fs');
const semver = require('semver');

const tsPkg = require('typescript/package.json');
const proxyApiPath = require.resolve('vue-tsc/out/index');
const { state } = require('vue-tsc/out/shared');

const tscEntryPath = require.resolve('typescript/lib/tsc');
const tscRealPath = require.resolve('typescript/lib/_tsc.js');

const originalReadFileSync = fs.readFileSync.bind(fs);
let cachedPatchedContent = null;

const normalizeReadOptions = (options) => {
  if (options === undefined) {
    return { encoding: null };
  }
  if (typeof options === 'string') {
    return { encoding: options };
  }
  if (typeof options === 'object' && options !== null) {
    return { encoding: options.encoding ?? null };
  }
  return { encoding: null };
};

const convertOutput = (content, options) => {
  const { encoding } = normalizeReadOptions(options);
  if (!encoding || encoding === 'buffer') {
    return Buffer.from(content, 'utf8');
  }
  if (encoding.toLowerCase() === 'utf8' || encoding.toLowerCase() === 'utf-8') {
    return content;
  }
  return Buffer.from(content, 'utf8').toString(encoding);
};

const applyPatch = (source) => {
  if (source.includes('__VUE_TSC_PATCH_APPLIED__')) {
    return source;
  }

  let output = source;

  const apply = (pattern, replacer, { optional = false } = {}) => {
    const next = output.replace(pattern, (...args) => {
      const segment = args[0];
      const replacement = typeof replacer === 'function' ? replacer(...args) : replacer;
      if (segment === replacement) {
        return segment;
      }
      return replacement;
    });

    if (next === output) {
      if (!optional) {
        throw new Error(`Failed to patch TypeScript compiler with pattern ${pattern}`);
      }
    } else {
      output = next;
    }
  };

  apply(/supportedTSExtensions\s*=\s*[^;\n]+/, (segment) => {
    if (segment.includes('.vue')) {
      return segment;
    }
    return `${segment}.concat([[".vue"]])`;
  });

  apply(/supportedJSExtensions\s*=\s*[^;\n]+/, (segment) => {
    if (segment.includes('.vue')) {
      return segment;
    }
    return `${segment}.concat([[".vue"]])`;
  });

  apply(/allSupportedExtensions\s*=\s*[^;\n]+/, (segment) => {
    if (segment.includes('.vue')) {
      return segment;
    }
    return `${segment}.concat([[".vue"]])`;
  });

  apply(/function\s+createProgram\s*\([^)]*\)\s*{/, (segment) => {
    if (segment.includes('vue-tsc/out/index')) {
      return segment;
    }
    return `${segment} return require(${JSON.stringify(proxyApiPath)}).createProgram(...arguments);`;
  });

  if (semver.gt(tsPkg.version, '5.0.0')) {
    apply(
      /for \(const existingRoot of buildInfoVersionMap\.roots\) {/,
      `for (const existingRoot of buildInfoVersionMap.roots\n        .filter(file => !file.toLowerCase().includes('__vls_'))\n      .map(file => file.replace(/\\.vue\\.(j|t)sx?$/i, '.vue'))\n    ) {`,
      { optional: true }
    );

    apply(
      /return \[toFileId\(key\), toFileIdListId\(state\.exportedModulesMap\.getValues\(key\)\)];/,
      `return [\n      toFileId(key),\n      toFileIdListId(new Set(arrayFrom(state.exportedModulesMap.getValues(key)).filter(file => file !== void 0)))\n    ];`,
      { optional: true }
    );
  }

  if (semver.gte(tsPkg.version, '5.0.4')) {
    apply(
      /return createBuilderProgramUsingProgramBuildInfo\(buildInfo, buildInfoPath, host\);/,
      (segment) => {
        if (segment.includes('__vls_')) {
          return segment;
        }
        return `buildInfo.program.fileNames = buildInfo.program.fileNames\n      .filter(file => !file.toLowerCase().includes('__vls_'))\n      .map(file => file.replace(/\\.vue\\.(j|t)sx?$/i, '.vue'));\n${segment}`;
      },
      { optional: true }
    );
  }

output += '\n// __VUE_TSC_PATCH_APPLIED__';
  return output;
};

fs.readFileSync = function patchedReadFileSync(filePath, options) {
  if (filePath === tscRealPath) {
    if (!cachedPatchedContent) {
      const raw = originalReadFileSync(filePath, { encoding: 'utf8' });
      cachedPatchedContent = applyPatch(raw);
    }
    return convertOutput(cachedPatchedContent, options);
  }

  return originalReadFileSync(filePath, options);
};

(function main() {
  try {
    require(tscEntryPath);
  } catch (err) {
    if (err === 'hook') {
      state.hook.worker.then(main);
    } else {
      throw err;
    }
  }
})();
