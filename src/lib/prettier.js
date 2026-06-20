import * as prettier from 'prettier/standalone';

// Monaco language id → Prettier parser name. Plugins are dynamically imported
// per-format so the main bundle doesn't carry every language's printer.
const PARSER_FOR_LANG = {
  javascript: 'babel', typescript: 'typescript', json: 'json',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  markdown: 'markdown', yaml: 'yaml',
};

async function pluginsFor(parser) {
  switch (parser) {
    case 'babel':
    case 'json':
      return [(await import('prettier/plugins/babel')).default, (await import('prettier/plugins/estree')).default];
    case 'typescript':
      return [(await import('prettier/plugins/typescript')).default, (await import('prettier/plugins/estree')).default];
    case 'html':
      return [(await import('prettier/plugins/html')).default];
    case 'css': case 'scss': case 'less':
      return [(await import('prettier/plugins/postcss')).default];
    case 'markdown':
      return [(await import('prettier/plugins/markdown')).default];
    case 'yaml':
      return [(await import('prettier/plugins/yaml')).default];
    default:
      return [];
  }
}

export function isFormattable(lang) {
  return !!PARSER_FOR_LANG[lang];
}

export async function formatCode(content, lang) {
  const parser = PARSER_FOR_LANG[lang];
  if (!parser) return content;
  const plugins = await pluginsFor(parser);
  return prettier.format(content, { parser, plugins, tabWidth: 2 });
}
