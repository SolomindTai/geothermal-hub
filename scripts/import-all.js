const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Import from both source databases
const seedData = require(path.join(__dirname, '../../geothermal-exhibitors/data/seed-data.js'));
const powerPlants = require(path.join(__dirname, '../../geothermal-exhibitors/data/power-plants.js'));

const dbPath = path.join(__dirname, '../data/geothermal.db');

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  console.log('Creating unified database...');

  // Create tables
  db.run(`
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      location TEXT,
      type TEXT,
      organizer TEXT,
      website TEXT
    );

    CREATE TABLE exhibitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      country TEXT,
      category TEXT,
      subcategory TEXT,
      website TEXT,
      description TEXT
    );

    CREATE TABLE event_exhibitors (
      event_id TEXT,
      exhibitor_id INTEGER,
      PRIMARY KEY (event_id, exhibitor_id)
    );

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
      source TEXT
    );

    CREATE TABLE news (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      pubDate TEXT,
      source TEXT,
      language TEXT,
      summary TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE papers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      link TEXT NOT NULL,
      authors TEXT,
      summary TEXT,
      published TEXT,
      source TEXT,
      fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_exhibitors_category ON exhibitors(category);
    CREATE INDEX idx_exhibitors_country ON exhibitors(country);
    CREATE INDEX idx_events_year ON events(year);
    CREATE INDEX idx_plants_country ON power_plants(country);
    CREATE INDEX idx_plants_status ON power_plants(status);
    CREATE INDEX idx_news_language ON news(language);
    CREATE INDEX idx_papers_source ON papers(source);
  `);

  // Insert events
  const insertEvent = db.prepare(`
    INSERT INTO events (id, name, year, location, type, organizer, website)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const event of seedData.events) {
    insertEvent.run([event.id, event.name, event.year, event.location, event.type, event.organizer, event.website || '']);
  }
  insertEvent.free();

  // Insert exhibitors
  const insertExhibitor = db.prepare(`
    INSERT INTO exhibitors (name, country, category, subcategory, website, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertRelation = db.prepare(`
    INSERT OR IGNORE INTO event_exhibitors (event_id, exhibitor_id) VALUES (?, ?)
  `);

  let exhibitorId = 1;
  for (const exhibitor of seedData.exhibitors) {
    insertExhibitor.run([
      exhibitor.name, exhibitor.country, exhibitor.category, exhibitor.subcategory,
      exhibitor.website || '', exhibitor.description || ''
    ]);
    
    for (const eventId of exhibitor.events || []) {
      insertRelation.run([eventId, exhibitorId]);
    }
    exhibitorId++;
  }
  insertExhibitor.free();
  insertRelation.free();

  // Insert power plants
  const insertPlant = db.prepare(`
    INSERT INTO power_plants (name, country, region, operator, developer, capacity_mw, capacity_installed_mw, 
      plant_type, commissioning_year, reservoir_temp_c, reservoir_depth_m, well_count, area_km2, status,
      grid_connection, annual_generation_gwh, thermal_output_mw, capacity_factor, lat, lng, description, notes, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const plant of powerPlants.powerPlants) {
    insertPlant.run([
      plant.name, plant.country, plant.region, plant.operator, plant.developer,
      plant.capacity_mw, plant.capacity_installed_mw, plant.plant_type, plant.commissioning_year,
      plant.reservoir_temp_c, plant.reservoir_depth_m, plant.well_count, plant.area_km2, plant.status,
      plant.grid_connection, plant.annual_generation_gwh, plant.thermal_output_mw || null, plant.capacity_factor,
      plant.coordinates?.lat, plant.coordinates?.lng, plant.description, plant.notes, plant.source
    ]);
  }
  insertPlant.free();

  // Insert sample news (placeholder - would be fetched dynamically)
  const now = new Date().toISOString();
  const insertNews = db.prepare(`
    INSERT INTO news (title, link, pubDate, source, language, summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const sampleNews = [
    { title: 'Global geothermal capacity reaches 17,173 MW by end of 2025', source: 'ThinkGeoEnergy', lang: 'en', summary: 'ThinkGeoEnergy annual report shows continued growth in global geothermal power generation.' },
    { title: 'Fervo Energy Cape Station project on track for 2026', source: 'CleanTechnica', lang: 'en', summary: 'Google-backed EGS project in Utah advancing toward commercial operation.' },
    { title: '印尼地熱發電量持續成長，2025年新增330MW', source: '中央社', lang: 'zh-TW', summary: '印尼能源部公布最新地熱裝置容量數據。' },
    { title: '台灣地熱發展腳步加快，清水电厂商转成功', source: '工商时报', lang: 'zh-TW', summary: '台湾首座商转地热电厂运营状况良好。' },
  ];

  for (const news of sampleNews) {
    insertNews.run([news.title, '#', now, news.source, news.lang, news.summary]);
  }
  insertNews.free();

  // Insert sample papers (placeholder)
  const insertPaper = db.prepare(`
    INSERT INTO papers (title, link, authors, summary, published, source)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const samplePapers = [
    { title: 'Enhanced Geothermal Systems: Current Status and Future Prospects', authors: 'DOE Geothermal Technologies Office', summary: 'Comprehensive review of EGS technology development and deployment strategies.', published: '2025-12', source: 'arXiv' },
    { title: 'Global Geothermal Power Potential Assessment', authors: 'IRENA', summary: 'Assessment of technically recoverable geothermal resources worldwide.', published: '2025-11', source: 'Semantic Scholar' },
    { title: '地熱發電在台灣的發展潛力與挑戰', authors: '台灣地熱協會', summary: '分析台灣地熱資源分布與開發前景。', published: '2025-10', source: 'Taiwan' },
  ];

  for (const paper of samplePapers) {
    insertPaper.run([paper.title, '#', paper.authors, paper.summary, paper.published, paper.source]);
  }
  insertPaper.free();

  // Save to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  console.log(`✅ Unified database created!`);
  console.log(`   Events: ${seedData.events.length}`);
  console.log(`   Exhibitors: ${seedData.exhibitors.length}`);
  console.log(`   Power Plants: ${powerPlants.powerPlants.length}`);
  console.log(`   News: ${sampleNews.length}`);
  console.log(`   Papers: ${samplePapers.length}`);

  db.close();
}

main().catch(console.error);
