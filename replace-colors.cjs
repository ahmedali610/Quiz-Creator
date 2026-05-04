const fs = require('fs');

const files = [
  'src/pages/player/QuizPlayer.tsx',
  'src/pages/player/TeamPage.tsx',
];

const mappings = [
  { search: /bg-\[#0A0A0B\]/g, replace: 'bg-slate-50 dark:bg-[#0A0A0B]' },
  { search: /bg-\[#1C1E23\]/g, replace: 'bg-white dark:bg-[#1C1E23]' },
  { search: /bg-\[#111215\]/g, replace: 'bg-white dark:bg-[#111215]' },
  { search: /text-white/g, replace: 'text-slate-900 dark:text-white' },
  { search: /text-zinc-500/g, replace: 'text-slate-500 dark:text-zinc-500' },
  { search: /border-white\/5/g, replace: 'border-slate-200 dark:border-white/5' },
  { search: /border-white\/10/g, replace: 'border-slate-200 dark:border-white/10' },
  { search: /bg-white\/\[0\.02\]/g, replace: 'bg-white dark:bg-white/[0.02]' },
  { search: /bg-white\/\[0\.03\]/g, replace: 'bg-slate-100 dark:bg-white/[0.03]' },
  { search: /bg-white\/\[0\.04\]/g, replace: 'bg-slate-200 dark:bg-white/[0.04]' },
  { search: /text-zinc-400/g, replace: 'text-slate-500 dark:text-zinc-400' },
  { search: /text-zinc-300/g, replace: 'text-slate-600 dark:text-zinc-300' },
  { search: /text-black/g, replace: 'text-white dark:text-black' },
  { search: /bg-black/g, replace: 'bg-white dark:bg-black' },
  { search: /\btext-white\/90\b/g, replace: 'text-slate-800 dark:text-white/90' },
  { search: /\bfrom-white\b/g, replace: 'from-slate-900 dark:from-white' },
  { search: /\bvia-white\b/g, replace: 'via-slate-800 dark:via-white' },
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  mappings.forEach(map => {
    content = content.replace(map.search, map.replace);
  });
  fs.writeFileSync(file, content, 'utf8');
});
console.log('Done!');
