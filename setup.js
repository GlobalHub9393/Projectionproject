import { sqlClient, requireAdmin, ensureDatabase } from './db.js';

export default async function handler(req,res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({error:'POST only'});
    requireAdmin(req);
    const sql = sqlClient();
    await ensureDatabase(sql);
    return res.status(200).json({ok:true,message:'September database is ready'});
  } catch (e) {
    return res.status(e.statusCode||500).json({error:e.message||'Setup failed'});
  }
}
