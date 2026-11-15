// Maakt het voorbeeldtraject aan in de database: npm run seed
import { initDatabase, pool } from '../db.js';
import { maakVoorbeeldAan } from '../data.js';

await initDatabase();
const id = await maakVoorbeeldAan();
console.log(id ? `Voorbeeldtraject aangemaakt (${id}).` : 'Het voorbeeldtraject bestaat al.');
await pool.end();
