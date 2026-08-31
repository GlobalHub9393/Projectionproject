import { sqlClient, requireAdmin } from './db.js';

export default async function handler(req,res){
  try{
    if(req.method !== 'POST') return res.status(405).json({error:'POST only'});
    requireAdmin(req);
    const sql = sqlClient();
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await sql`CREATE TABLE IF NOT EXISTS app_config (
      id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
      active_month date NOT NULL,
      month_label text NOT NULL DEFAULT 'September',
      headline text NOT NULL DEFAULT 'Fresh Start',
      opening_prompt text NOT NULL DEFAULT 'September starts at zero. What are you going after today?',
      team_message text NOT NULL DEFAULT 'New month. Clean board. Every interaction matters.',
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS reps (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL,
      display_name text NOT NULL, role text NOT NULL DEFAULT 'rep', active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 100, started_on date, updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS monthly_goals (
      month date PRIMARY KEY, traffic integer NOT NULL DEFAULT 0, opportunities integer NOT NULL DEFAULT 0,
      ppv integer NOT NULL DEFAULT 0, ppv_close numeric NOT NULL DEFAULT 0, aia_posted integer NOT NULL DEFAULT 0,
      aia_submits integer NOT NULL DEFAULT 0, aia_close numeric NOT NULL DEFAULT 0, htp integer NOT NULL DEFAULT 0,
      htp_close numeric NOT NULL DEFAULT 0, upgrades integer NOT NULL DEFAULT 0, data integer NOT NULL DEFAULT 0,
      accessory_target numeric NOT NULL DEFAULT 60, accessory_qualifier numeric NOT NULL DEFAULT 50,
      insurance_target numeric NOT NULL DEFAULT .60, insurance_qualifier numeric NOT NULL DEFAULT .50,
      trade_target numeric NOT NULL DEFAULT .50, csat_target numeric NOT NULL DEFAULT .88,
      rep_aia_qualifier integer NOT NULL DEFAULT 4, rep_htp_qualifier integer NOT NULL DEFAULT 2,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS store_metrics (
      month date PRIMARY KEY, traffic integer NOT NULL DEFAULT 0, ppv integer NOT NULL DEFAULT 0, ppv_close numeric NOT NULL DEFAULT 0,
      aia_posted integer NOT NULL DEFAULT 0, aia_submits integer NOT NULL DEFAULT 0, aia_close numeric NOT NULL DEFAULT 0,
      htp integer NOT NULL DEFAULT 0, htp_close numeric NOT NULL DEFAULT 0, upgrades integer NOT NULL DEFAULT 0,
      data integer NOT NULL DEFAULT 0, cru integer NOT NULL DEFAULT 0, accessory_revenue numeric NOT NULL DEFAULT 0,
      acc_per_opp numeric NOT NULL DEFAULT 0, insurance_rate numeric NOT NULL DEFAULT 0, nextup_rate numeric NOT NULL DEFAULT 0,
      csat numeric NOT NULL DEFAULT 0, pre_to_post integer NOT NULL DEFAULT 0, pa4 integer NOT NULL DEFAULT 0,
      opps integer NOT NULL DEFAULT 0, trade_rate numeric NOT NULL DEFAULT 0, prepaid integer NOT NULL DEFAULT 0,
      open_enrollment integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS rep_metrics (
      month date NOT NULL, rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
      ppv integer NOT NULL DEFAULT 0, aia_posted integer NOT NULL DEFAULT 0, aia_submits integer NOT NULL DEFAULT 0,
      aia_close numeric NOT NULL DEFAULT 0, htp integer NOT NULL DEFAULT 0, upgrades integer NOT NULL DEFAULT 0,
      data integer NOT NULL DEFAULT 0, cru integer NOT NULL DEFAULT 0, accessory_revenue numeric NOT NULL DEFAULT 0,
      acc_per_opp numeric NOT NULL DEFAULT 0, insurance_rate numeric NOT NULL DEFAULT 0,
      insurance_adds integer, insurance_eligible_opps integer, nextup_rate numeric NOT NULL DEFAULT 0,
      csat numeric NOT NULL DEFAULT 0, pre_to_post integer NOT NULL DEFAULT 0, pa4 integer NOT NULL DEFAULT 0,
      opps integer NOT NULL DEFAULT 0, trade_rate numeric NOT NULL DEFAULT 0, prepaid integer NOT NULL DEFAULT 0,
      open_enrollment integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(month,rep_id)
    )`;
    await sql`CREATE TABLE IF NOT EXISTS coaching_points (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), month date NOT NULL, scope text NOT NULL,
      rep_id uuid REFERENCES reps(id) ON DELETE CASCADE, kind text NOT NULL DEFAULT 'coach', title text NOT NULL DEFAULT '',
      body text NOT NULL, sort_order integer NOT NULL DEFAULT 100, active boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS sbs_observations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
      observed_on date NOT NULL DEFAULT CURRENT_DATE, title text NOT NULL DEFAULT '', greet integer, understand integer,
      recommend integer, confirm integer, educate integer, thank integer, notes text NOT NULL DEFAULT '',
      coaching_summary text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now()
    )`;

    await sql`INSERT INTO app_config(id,active_month,month_label,headline,opening_prompt,team_message)
      VALUES(1,'2026-09-01','September','Fresh Start','September starts at zero. What are you going after today?','New month. Clean board. Every interaction matters.')
      ON CONFLICT(id) DO NOTHING`;
    await sql`INSERT INTO monthly_goals(month,traffic,opportunities,ppv,ppv_close,aia_posted,aia_submits,aia_close,htp,htp_close,upgrades,data,accessory_target,accessory_qualifier,insurance_target,insurance_qualifier,trade_target,csat_target,rep_aia_qualifier,rep_htp_qualifier)
      VALUES('2026-09-01',1020,124,42,.035,22,22,.075,8,.05,86,16,60,50,.60,.50,.50,.88,4,2)
      ON CONFLICT(month) DO NOTHING`;
    await sql`INSERT INTO reps(slug,display_name,role,active,sort_order,started_on) VALUES
      ('tj','TJ','manager',true,1,NULL),('noelle','Noelle Glenn','rep',true,2,NULL),('gio','Gio','rep',true,3,'2026-08-30')
      ON CONFLICT(slug) DO UPDATE SET display_name=excluded.display_name, role=excluded.role, active=true, sort_order=excluded.sort_order`;
    await sql`INSERT INTO store_metrics(month) VALUES('2026-09-01') ON CONFLICT(month) DO NOTHING`;
    await sql`INSERT INTO rep_metrics(month,rep_id) SELECT '2026-09-01',id FROM reps WHERE active=true ON CONFLICT(month,rep_id) DO NOTHING`;
    const existing = await sql`SELECT count(*)::int AS n FROM coaching_points WHERE month='2026-09-01'`;
    if(existing[0].n===0){
      await sql`INSERT INTO coaching_points(month,scope,kind,title,body,sort_order) VALUES
      ('2026-09-01','store','finish','Fresh Start','September starts at zero. Build the month one complete interaction at a time.',1),
      ('2026-09-01','store','coach','Complete Recommendation','Do not just accept no. Ask why, note the pushback, and adjust the recommendation.',2),
      ('2026-09-01','store','coach','Finish the Whole Sale','Rerate the account, look for more than one upgrade, present protection, accessories, Home Internet, and trade when they fit.',3)`;
    }
    return res.status(200).json({ok:true});
  }catch(e){return res.status(e.statusCode||500).json({error:e.message});}
}
