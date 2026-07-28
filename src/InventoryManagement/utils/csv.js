// Chhota CSV parser - quotes, escaped quotes ("" ), aur newline-in-quotes handle karta hai.
// Koi npm package nahi chahiye.

function parseCsv(text) {
  const s = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  // poori khali lines nikal do
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// header row ko normalize kar ke { header: index } map banata hai
function headerMap(headerRow) {
  const map = {};
  headerRow.forEach((h, i) => {
    const key = String(h).toLowerCase().replace(/[\s_-]/g, '');
    if (!(key in map)) map[key] = i;
  });
  return map;
}

// pehla column jo mil jaye
function pick(map, row, ...aliases) {
  for (const a of aliases) {
    const key = a.toLowerCase().replace(/[\s_-]/g, '');
    if (key in map) {
      const v = row[map[key]];
      if (v !== undefined && String(v).trim() !== '') return String(v).trim();
    }
  }
  return '';
}

module.exports = { parseCsv, headerMap, pick };
