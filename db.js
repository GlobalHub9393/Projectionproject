import { neon } from '@neondatabase/serverless';

export function sqlClient(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}

export function requireAdmin(req){
  const expected = process.env.ADMIN_PHRASE || 'Hello?';
  const supplied = req.headers['x-admin-phrase'];
  if(supplied !== expected){
    const e = new Error('Unauthorized');
    e.statusCode = 401;
    throw e;
  }
}
