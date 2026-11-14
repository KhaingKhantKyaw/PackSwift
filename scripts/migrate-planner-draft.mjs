import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {getDatabasePool} from '../src/config/database.js';
const pool=getDatabasePool();
try{
 const sql=await readFile(new URL('../database/migrations/022_nullable_draft_budget.sql',import.meta.url),'utf8');
 await pool.query(sql);
 const [rows]=await pool.query("SHOW COLUMNS FROM trip_sessions LIKE 'budget_amount'");
 if(rows[0]?.Null!=='YES')throw Error('Draft budget migration did not apply.');
 console.log('Draft budgets can be left unknown. Existing trip amounts are unchanged.');
}finally{await pool.end();}
