const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 3001;
const dbPath = path.join(__dirname, 'data/geothermal.db');

let db = null;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    version: '2.0.0',
    dbPath: dbPath,
    dbExists: fs.existsSync(dbPath),
    fieldsCount: db ? Object.keys(db.exec('SELECT * FROM power_plants LIMIT 1')[0]?.columns || {}).length : 0
  });
});

// Stats
app.get('/api/stats', async (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const stats = {
      plants: db.exec('SELECT COUNT(*) FROM power_plants')[0]?.values[0][0] || 0,
      totalCapacity: db.exec('SELECT SUM(capacity_mw) FROM power_plants WHERE capacity_mw IS NOT NULL')[0]?.values[0][0] || 0,
      exhibitors: db.exec('SELECT COUNT(*) FROM exhibitors')[0]?.values[0][0] || 0,
      events: db.exec('SELECT COUNT(*) FROM events')[0]?.values[0][0] || 0,
      news: db.exec('SELECT COUNT(*) FROM news')[0]?.values[0][0] || 0,
      papers: db.exec('SELECT COUNT(*) FROM papers')[0]?.values[0][0] || 0,
    };
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Power Plants API
app.get('/api/plants', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  const { q, country, type, status, min_capacity } = req.query;
  let query = `SELECT * FROM power_plants WHERE 1=1`;
  if (q) query += ` AND (name LIKE '%${q}%' OR operator LIKE '%${q}%')`;
  if (country) query += ` AND country = '${country}'`;
  if (type) query += ` AND plant_type LIKE '%${type}%'`;
  if (status) query += ` AND status = '${status}'`;
  if (min_capacity) query += ` AND capacity_mw >= ${parseInt(min_capacity)}`;
  query += ` ORDER BY capacity_mw DESC`;
  
  try {
    const result = db.exec(query);
    if (!result.length) return res.json([]);
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {}; columns.forEach((col, i) => obj[col] = row[i]); return obj;
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/plant-countries', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT DISTINCT country FROM power_plants ORDER BY country');
    res.json(result[0]?.values.map(r => r[0]) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/plant-types', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT DISTINCT plant_type FROM power_plants ORDER BY plant_type');
    res.json(result[0]?.values.map(r => r[0]) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Exhibitors API
app.get('/api/exhibitors', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  const { q, category, country, year } = req.query;
  let query = `SELECT DISTINCT e.*, GROUP_CONCAT(DISTINCT ev.name) as events_list FROM exhibitors e LEFT JOIN event_exhibitors ee ON e.id = ee.exhibitor_id LEFT JOIN events ev ON ee.event_id = ev.id WHERE 1=1`;
  if (q) query += ` AND (e.name LIKE '%${q}%' OR e.description LIKE '%${q}%')`;
  if (category) query += ` AND e.category = '${category}'`;
  if (country) query += ` AND e.country = '${country}'`;
  if (year) query += ` AND ev.year = ${parseInt(year)}`;
  query += ` GROUP BY e.id ORDER BY e.name`;
  
  try {
    const result = db.exec(query);
    if (!result.length) return res.json([]);
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {}; columns.forEach((col, i) => obj[col] = row[i]); return obj;
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exhibitor-categories', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT DISTINCT category FROM exhibitors ORDER BY category');
    res.json(result[0]?.values.map(r => r[0]) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/exhibitor-countries', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT DISTINCT country FROM exhibitors ORDER BY country');
    res.json(result[0]?.values.map(r => r[0]) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/events', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT * FROM events ORDER BY year DESC, name');
    if (!result.length) return res.json([]);
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {}; columns.forEach((col, i) => obj[col] = row[i]); return obj;
    });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// News API
app.get('/api/news', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  const { lang } = req.query;
  let query = 'SELECT * FROM news WHERE 1=1';
  if (lang) query += ` AND language = '${lang}'`;
  query += ' ORDER BY fetched_at DESC LIMIT 20';
  
  try {
    const result = db.exec(query);
    if (!result.length) return res.json([]);
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {}; columns.forEach((col, i) => obj[col] = row[i]); return obj;
    });
    res.json({ lastUpdated: new Date().toISOString(), items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Papers API
app.get('/api/papers', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  const { source } = req.query;
  let query = 'SELECT * FROM papers WHERE 1=1';
  if (source) query += ` AND source = '${source}'`;
  query += ' ORDER BY published DESC LIMIT 20';
  
  try {
    const result = db.exec(query);
    if (!result.length) return res.json({ lastUpdated: new Date().toISOString(), items: [] });
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {}; columns.forEach((col, i) => obj[col] = row[i]); return obj;
    });
    res.json({ lastUpdated: new Date().toISOString(), items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/paper-sources', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT DISTINCT source FROM papers ORDER BY source');
    res.json(result[0]?.values.map(r => r[0]) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Build database using the import script
async function rebuildDatabase() {
  // Delete old database
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  
  // Run import script
  const { execSync } = require('child_process');
  execSync('node scripts/import-all.js', { cwd: __dirname, stdio: 'inherit' });
  
  // Load the newly created database
  const SQL = await initSqlJs({
    locateFile: file => `/data/${file}`
  });
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  console.log('✅ Database rebuilt successfully');
  return db;
}

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🌋 Geothermal Hub v2.0.0 starting...`);
  try {
    db = await rebuildDatabase();
    console.log('✅ Database ready');
  } catch (err) {
    console.error('❌ Failed to rebuild database:', err);
  }
});
