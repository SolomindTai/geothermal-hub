const express = require('express');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT) || 3001;
const dbPath = '/tmp/geothermal.db';

let db = null;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

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

app.get('/api/paper-sources', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec('SELECT DISTINCT source FROM papers ORDER BY source');
    res.json(result[0]?.values.map(r => r[0]) || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Podcasts API
app.get('/api/podcasts', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  try {
    const result = db.exec(`
      SELECT id, title, authors, notebooklm_url, notebooklm_status, published, source, summary
      FROM papers 
      WHERE notebooklm_url IS NOT NULL
      ORDER BY published DESC
    `);
    if (!result.length) return res.json({ lastUpdated: new Date().toISOString(), items: [] });
    const columns = result[0].columns;
    const rows = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json({ lastUpdated: new Date().toISOString(), items: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/podcasts', express.json(), (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database initializing...' });
  const { paper_id, notebooklm_url } = req.body;
  
  if (!notebooklm_url) {
    return res.status(400).json({ error: 'notebooklm_url is required' });
  }

  try {
    if (paper_id) {
      const stmt = db.prepare(`
        UPDATE papers 
        SET notebooklm_url = ?, notebooklm_status = 'available'
        WHERE id = ?
      `);
      stmt.run([notebooklm_url, parseInt(paper_id)]);
      stmt.free();
    }

    // Save database
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    
    res.json({ success: true, notebooklm_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Build database directly (inline import)
async function rebuildDatabase() {
  const SQL = await initSqlJs();
  
  // Always delete old database to force rebuild
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️ Old database deleted');
  }
  
  const db = new SQL.Database();
  
  // Import data
  const seedData = require('./data/seed-data.js');
  const powerPlants = require('./data/power-plants.js');
  const newsData = require('./data/news.json');
  const papersData = require('./data/papers.json');
  
  // Create tables
  db.run(`
    CREATE TABLE power_plants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT,
      region TEXT,
      operator TEXT,
      developer TEXT,
      capacity_mw REAL,
      capacity_installed_mw REAL,
      plant_type TEXT,
      commissioning_year INTEGER,
      reservoir_temp_c INTEGER,
      reservoir_depth_m INTEGER,
      well_count INTEGER,
      area_km2 REAL,
      status TEXT,
      grid_connection TEXT,
      annual_generation_gwh REAL,
      thermal_output_mw REAL,
      capacity_factor REAL,
      lat REAL,
      lng REAL,
      description TEXT,
      notes TEXT,
      source TEXT,
      drilling_contractor TEXT,
      owner TEXT,
      turbine_manufacturer TEXT,
      power_units INTEGER,
      flash_stages TEXT,
      injection_wells INTEGER,
      makeup_water_source TEXT,
      ppa_buyer TEXT,
      project_cost_usd REAL,
      land_area_hectares REAL,
      environmental_cert TEXT,
      grid_operator TEXT
    );
  `);
  
  // Insert plants
  const insertPlant = db.prepare(`
    INSERT INTO power_plants VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  
  for (const plant of powerPlants.powerPlants) {
    insertPlant.run([
      null, plant.name, plant.country, plant.region, plant.operator, plant.developer,
      plant.capacity_mw, plant.capacity_installed_mw, plant.plant_type, plant.commissioning_year,
      plant.reservoir_temp_c, plant.reservoir_depth_m, plant.well_count, plant.area_km2, plant.status,
      plant.grid_connection, plant.annual_generation_gwh, plant.thermal_output_mw || null, plant.capacity_factor,
      plant.coordinates?.lat, plant.coordinates?.lng, plant.description, plant.notes, plant.source,
      plant.drilling_contractor || null, plant.owner || null, plant.turbine_manufacturer || null,
      plant.power_units || null, plant.flash_stages || null, plant.injection_wells || null,
      plant.makeup_water_source || null, plant.ppa_buyer || null, plant.project_cost_usd || null,
      plant.land_area_hectares || null, plant.environmental_cert || null, plant.grid_operator || null
    ]);
  }
  insertPlant.free();
  
  // Save
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  console.log('✅ Database rebuilt with all fields');
  return db;
}

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🌋 Geothermal Hub v${require('./package.json').version} starting...`);
  try {
    db = await rebuildDatabase();
    console.log('✅ Database ready');
  } catch (err) {
    console.error('❌ Failed to rebuild database:', err);
  }
});
