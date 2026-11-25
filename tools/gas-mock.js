/* Minimal in-memory mock of the Apps Script services CodeTrack uses.
   Works in Node (via vm) and in the browser (as a <script>). */
(function (G) {
  // ---------- clock ----------
  const RealDate = Date;
  let offset = 0;
  function FakeDate(...args) {
    if (!(this instanceof FakeDate)) return new RealDate(RealDate.now() + offset).toString();
    return args.length ? new RealDate(...args) : new RealDate(RealDate.now() + offset);
  }
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => RealDate.now() + offset;
  FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse;
  G.__setNow = iso => { offset = new RealDate(iso).getTime() - RealDate.now(); };
  G.Date = FakeDate;

  // ---------- sha256 (sync) ----------
  function sha256Bytes(str) {
    const bytes = Array.from(new TextEncoder().encode(str));
    const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const l = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 0xff);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let i = 0; i < bytes.length; i += 64) {
      const w = new Array(64);
      for (let t = 0; t < 16; t++) w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + w[t]) | 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = H.map((x, k) => (x + [a, b, c, d, e, f, g, h][k]) | 0);
    }
    const out = [];
    H.forEach(x => { for (let k = 3; k >= 0; k--) { const v = (x >>> (k * 8)) & 0xff; out.push(v > 127 ? v - 256 : v); } });
    return out;
  }

  // ---------- Utilities ----------
  let uuidN = 0;
  G.Utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
    computeDigest: (alg, s) => sha256Bytes(String(s)),
    getUuid: () => {
      uuidN++;
      const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
    },
    base64Decode: b64 => { const bin = (typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary')); const out = []; for (let i = 0; i < bin.length; i++) { const c = bin.charCodeAt(i); out.push(c > 127 ? c - 256 : c); } return out; },
    base64Encode: bytes => { let bin = ''; (bytes || []).forEach(b => { bin += String.fromCharCode(b & 255); }); return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64'); },
    newBlob: (bytes, mime, name) => ({ _blob: true, getBytes: () => bytes, getContentType: () => mime, getName: () => name }),
    formatDate: (date, tz, fmt) => {
      const parts = {};
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        .formatToParts(date).forEach(p => { parts[p.type] = p.value; });
      if (parts.hour === '24') parts.hour = '00';
      return fmt.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss/g, (m, q) => q !== undefined ? q :
        m === 'yyyy' ? parts.year : m === 'MM' ? parts.month : m === 'dd' ? parts.day : m === 'HH' ? parts.hour : m === 'mm' ? parts.minute : parts.second);
    }
  };

  // ---------- Properties / Cache / Lock / Logger ----------
  const props = {};
  G.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) };
  const cache = {};
  G.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) };
  G.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  G.__logs = [];
  G.Logger = { log: m => { G.__logs.push(String(m)); } };
  G.MimeType = { PLAIN_TEXT: 'text/plain' };
  G.ContentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: text => { const o = { _text: String(text), _mime: 'text/plain', getContent: () => o._text, setMimeType: m => { o._mime = m; return o; } }; return o; }
  };

  // ---------- Spreadsheet ----------
  const books = {};
  function Range(sheet, r, c, nr, nc) {
    this.getValues = () => {
      const out = [];
      for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(sheet._get(r + i, c + j)); out.push(row); }
      return out;
    };
    this.setValues = vals => {
      if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error('setValues dimension mismatch ' + vals.length + 'x' + (vals[0] || []).length + ' vs ' + nr + 'x' + nc);
      if (r + nr - 1 > sheet._maxRows) throw new Error('Range outside sheet');
      vals.forEach((row, i) => row.forEach((v, j) => sheet._set(r + i, c + j, v)));
      return this;
    };
    this.clearContent = () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sheet._set(r + i, c + j, ''); return this; };
    this.setNumberFormat = () => this; this.setFontWeight = () => this; this.setBackground = () => this;
  }
  function Sheet(name) {
    this._name = name; this._data = []; this._maxRows = 1000; this._maxCols = 26;
    this._get = (r, c) => { const row = this._data[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined ? '' : v; };
    this._set = (r, c, v) => {
      if (typeof v === 'string' && v[0] === "'") v = v.slice(1);
      else if (typeof v === 'string' && /^[=+\-]/.test(v) && v.length > 1) throw new Error('Formula written to sheet: ' + v.slice(0, 30));
      while (this._data.length < r) this._data.push([]);
      this._data[r - 1][c - 1] = v;
      if (c > this._maxCols) this._maxCols = c;
    };
    this.getName = () => name;
    this.getLastRow = () => { for (let i = this._data.length; i > 0; i--) if ((this._data[i - 1] || []).some(v => v !== '' && v !== undefined)) return i; return 0; };
    this.getLastColumn = () => { let m = 0; this._data.forEach(row => row.forEach((v, j) => { if (v !== '' && v !== undefined) m = Math.max(m, j + 1); })); return m; };
    this.getMaxRows = () => this._maxRows; this.getMaxColumns = () => this._maxCols;
    this.getRange = (r, c, nr, nc) => {
      if (r < 1 || c < 1 || (nr || 1) < 1) throw new Error('Bad range ' + [r, c, nr, nc]);
      if (r + (nr || 1) - 1 > this._maxRows) throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      return new Range(this, r, c, nr || 1, nc || 1);
    };
    this.insertRowsAfter = (after, n) => { this._maxRows += n; };
    this.deleteRow = r => {
      if (this._maxRows - 1 < 2) throw new Error('Sorry, it is not possible to delete all non-frozen rows.');
      this._data.splice(r - 1, 1); this._maxRows--;
    };
    this.setFrozenRows = () => {};
  }
  function Spreadsheet(name) {
    const id = 'ss_' + Math.random().toString(36).slice(2, 10);
    const sheets = [new Sheet('Sheet1')];
    this.getId = () => id; this.getName = () => name;
    this.getUrl = () => 'https://docs.google.com/spreadsheets/d/' + id + '/edit';
    this.getSheetByName = n => sheets.find(s => s.getName() === n) || null;
    this.insertSheet = n => { const s = new Sheet(n); sheets.push(s); return s; };
    this.getSheets = () => sheets.slice();
    this.deleteSheet = s => { sheets.splice(sheets.indexOf(s), 1); };
    this._sheets = sheets;
    books[id] = this;
  }
  G.SpreadsheetApp = {
    getActiveSpreadsheet: () => null,
    create: n => new Spreadsheet(n),
    openById: id => { if (!books[id]) throw new Error('No spreadsheet ' + id); return books[id]; }
  };

  // ---------- Drive ----------
  const items = {};
  let fileN = 0;
  function iter(arr) { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; }
  function Folder(name, parent) {
    const id = 'fo_' + (++fileN);
    this.kind = 'folder'; this._name = name; this._parent = parent; this._sharing = null;
    this.getId = () => id; this.getName = () => this._name; this.isTrashed = () => false;
    this.getUrl = () => 'https://drive.google.com/drive/folders/' + id;
    const kids = () => Object.values(items).filter(x => x._parent === this);
    this.createFolder = n => new Folder(n, this);
    this.getFolders = () => iter(kids().filter(x => x.kind === 'folder'));
    this.getFoldersByName = n => iter(kids().filter(x => x.kind === 'folder' && x.getName() === n));
    this.getFiles = () => iter(kids().filter(x => x.kind === 'file'));
    this.createFile = (n, content, mime) => (n && n._blob ? new File(n.getName(), n.getBytes(), n.getContentType(), this) : new File(n, content, mime, this));
    this.setSharing = (a, p) => { this._sharing = a + ':' + p; };
    items[id] = this;
  }
  function File(name, content, mime, parent) {
    const id = 'fi_' + (++fileN);
    this.kind = 'file'; this._parent = parent; this._content = content;
    this.getId = () => id; this.getName = () => name; this.getMimeType = () => mime || 'text/plain';
    this.getSize = () => String(content || '').length; this.getLastUpdated = () => new Date();
    this.getUrl = () => 'https://drive.google.com/file/d/' + id + '/view';
    this.moveTo = f => { this._parent = f; };
    items[id] = this;
  }
  const driveRoot = new Folder('My Drive', null);
  G.DriveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' },
    createFolder: n => new Folder(n, driveRoot),
    getFolderById: id => { const f = items[id]; if (!f || f.kind !== 'folder') throw new Error('No folder ' + id); return f; },
    getFileById: id => { const f = items[id]; if (f) return f; return { moveTo: () => {} }; }
  };
  G.__drive = { items, File, Folder };
  G.__books = books;
})(typeof window !== 'undefined' ? window : globalThis);
