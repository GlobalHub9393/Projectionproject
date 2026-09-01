import { neon } from '@neondatabase/serverless';

export function sqlClient() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured in Vercel');
  return neon(process.env.DATABASE_URL);
}

export function requireAdmin(req) {
  const expected = process.env.ADMIN_PHRASE || 'Hello?';
  const supplied = req.headers['x-admin-phrase'];
  if (supplied !== expected) {
    const e = new Error('Unauthorized');
    e.statusCode = 401;
    throw e;
  }
}

export async function ensureDatabase(sql) {
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
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    display_name text NOT NULL,
    role text NOT NULL DEFAULT 'rep',
    active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 100,
    started_on date,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS monthly_goals (
    month date PRIMARY KEY,
    traffic integer NOT NULL DEFAULT 0,
    opportunities integer NOT NULL DEFAULT 0,
    ppv integer NOT NULL DEFAULT 0,
    ppv_close numeric NOT NULL DEFAULT 0,
    aia_posted integer NOT NULL DEFAULT 0,
    aia_submits integer NOT NULL DEFAULT 0,
    aia_close numeric NOT NULL DEFAULT 0,
    htp integer NOT NULL DEFAULT 0,
    htp_close numeric NOT NULL DEFAULT 0,
    upgrades integer NOT NULL DEFAULT 0,
    data integer NOT NULL DEFAULT 0,
    accessory_target numeric NOT NULL DEFAULT 60,
    accessory_qualifier numeric NOT NULL DEFAULT 50,
    insurance_target numeric NOT NULL DEFAULT .60,
    insurance_qualifier numeric NOT NULL DEFAULT .50,
    trade_target numeric NOT NULL DEFAULT .50,
    csat_target numeric NOT NULL DEFAULT .88,
    rep_aia_qualifier integer NOT NULL DEFAULT 4,
    rep_htp_qualifier integer NOT NULL DEFAULT 2,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS rep_goals (
    month date NOT NULL,
    rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    ppv numeric,
    aia_posted numeric,
    aia_submits numeric,
    aia_close numeric,
    htp numeric,
    upgrades numeric,
    data numeric,
    accessory_target numeric,
    insurance_target numeric,
    trade_target numeric,
    csat_target numeric,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(month, rep_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS store_metrics (
    month date PRIMARY KEY,
    traffic integer NOT NULL DEFAULT 0,
    ppv integer NOT NULL DEFAULT 0,
    ppv_close numeric NOT NULL DEFAULT 0,
    aia_posted integer NOT NULL DEFAULT 0,
    aia_submits integer NOT NULL DEFAULT 0,
    aia_close numeric NOT NULL DEFAULT 0,
    htp integer NOT NULL DEFAULT 0,
    htp_close numeric NOT NULL DEFAULT 0,
    upgrades integer NOT NULL DEFAULT 0,
    data integer NOT NULL DEFAULT 0,
    cru integer NOT NULL DEFAULT 0,
    accessory_revenue numeric NOT NULL DEFAULT 0,
    acc_per_opp numeric NOT NULL DEFAULT 0,
    insurance_rate numeric NOT NULL DEFAULT 0,
    nextup_rate numeric NOT NULL DEFAULT 0,
    csat numeric NOT NULL DEFAULT 0,
    pre_to_post integer NOT NULL DEFAULT 0,
    pa4 integer NOT NULL DEFAULT 0,
    opps integer NOT NULL DEFAULT 0,
    trade_rate numeric NOT NULL DEFAULT 0,
    prepaid integer NOT NULL DEFAULT 0,
    open_enrollment integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS rep_metrics (
    month date NOT NULL,
    rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    ppv integer NOT NULL DEFAULT 0,
    aia_posted integer NOT NULL DEFAULT 0,
    aia_submits integer NOT NULL DEFAULT 0,
    aia_close numeric NOT NULL DEFAULT 0,
    htp integer NOT NULL DEFAULT 0,
    upgrades integer NOT NULL DEFAULT 0,
    data integer NOT NULL DEFAULT 0,
    cru integer NOT NULL DEFAULT 0,
    accessory_revenue numeric NOT NULL DEFAULT 0,
    acc_per_opp numeric NOT NULL DEFAULT 0,
    insurance_rate numeric NOT NULL DEFAULT 0,
    insurance_adds integer,
    insurance_eligible_opps integer,
    nextup_rate numeric NOT NULL DEFAULT 0,
    csat numeric NOT NULL DEFAULT 0,
    pre_to_post integer NOT NULL DEFAULT 0,
    pa4 integer NOT NULL DEFAULT 0,
    opps integer NOT NULL DEFAULT 0,
    trade_rate numeric NOT NULL DEFAULT 0,
    prepaid integer NOT NULL DEFAULT 0,
    open_enrollment integer NOT NULL DEFAULT 0,
    ple_complete boolean NOT NULL DEFAULT false,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(month, rep_id)
  )`;

  await sql`ALTER TABLE rep_metrics ADD COLUMN IF NOT EXISTS htp_close numeric NOT NULL DEFAULT 0`;

  await sql`CREATE TABLE IF NOT EXISTS coaching_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    month date NOT NULL,
    scope text NOT NULL DEFAULT 'store',
    rep_id uuid REFERENCES reps(id) ON DELETE CASCADE,
    kind text NOT NULL DEFAULT 'coach',
    title text NOT NULL DEFAULT '',
    body text NOT NULL DEFAULT '',
    sort_order integer NOT NULL DEFAULT 100,
    active boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'new',
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE coaching_points ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'`;

  await sql`CREATE TABLE IF NOT EXISTS sbs_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    observed_on date NOT NULL DEFAULT CURRENT_DATE,
    title text NOT NULL DEFAULT '',
    greet integer,
    understand integer,
    recommend integer,
    confirm integer,
    educate integer,
    thank integer,
    notes text NOT NULL DEFAULT '',
    coaching_summary text NOT NULL DEFAULT '',
    behavior_notes jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE sbs_observations ADD COLUMN IF NOT EXISTS behavior_notes jsonb NOT NULL DEFAULT '{}'::jsonb`;

  await sql`CREATE TABLE IF NOT EXISTS rep_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rep_id uuid NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
    noted_on date NOT NULL DEFAULT CURRENT_DATE,
    note text NOT NULL,
    private boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;

  await sql`INSERT INTO app_config(id,active_month,month_label,headline,opening_prompt,team_message)
    VALUES(1,'2026-09-01','September','Fresh Start',
      'September starts at zero. What are you going after today?',
      'New month. Clean board. Every interaction matters.')
    ON CONFLICT(id) DO UPDATE SET
      active_month=excluded.active_month,
      month_label=excluded.month_label`;

  await sql`INSERT INTO monthly_goals(
      month,traffic,opportunities,ppv,ppv_close,aia_posted,aia_submits,aia_close,
      htp,htp_close,upgrades,data,accessory_target,accessory_qualifier,
      insurance_target,insurance_qualifier,trade_target,csat_target,
      rep_aia_qualifier,rep_htp_qualifier)
    VALUES('2026-09-01',1000,125,40,.035,20,20,.075,8,.05,85,15,60,50,.60,.50,.50,.88,4,2)
    ON CONFLICT(month) DO NOTHING`;

  // Apply the official September Cinnaminson targets once over the original placeholder seed.
  await sql`UPDATE monthly_goals SET
      ppv=38,
      aia_posted=26,
      aia_submits=0,
      aia_close=.075,
      htp=0,
      htp_close=.05,
      upgrades=124,
      data=15,
      accessory_qualifier=50,
      insurance_qualifier=.50,
      csat_target=.88,
      rep_aia_qualifier=0,
      rep_htp_qualifier=0,
      updated_at=now()
    WHERE month='2026-09-01'
      AND ppv=40
      AND aia_posted=20
      AND upgrades=85
      AND data=15`;

  await sql`INSERT INTO reps(slug,display_name,role,active,sort_order,started_on) VALUES
    ('tj','TJ','manager',true,1,NULL),
    ('noelle','Noelle Glenn','rep',true,2,NULL),
    ('gio','Gio','rep',true,3,'2026-08-30')
    ON CONFLICT(slug) DO UPDATE SET
      display_name=excluded.display_name,
      role=excluded.role,
      active=true,
      sort_order=excluded.sort_order`;

  await sql`INSERT INTO store_metrics(month) VALUES('2026-09-01')
    ON CONFLICT(month) DO NOTHING`;

  await sql`INSERT INTO rep_metrics(month,rep_id)
    SELECT '2026-09-01',id FROM reps WHERE active=true
    ON CONFLICT(month,rep_id) DO NOTHING`;

  const coaching = await sql`SELECT count(*)::int AS n FROM coaching_points WHERE month='2026-09-01'`;
  if (coaching[0].n === 0) {
    await sql`INSERT INTO coaching_points(month,scope,kind,title,body,sort_order,status) VALUES
      ('2026-09-01','store','shoutout','Fresh Start',
       'September starts at zero. Build the month one complete interaction at a time.',1,'new'),
      ('2026-09-01','store','coach','Complete Recommendation',
       'Do not just accept no. Ask why, note the pushback, and adjust the recommendation.',2,'working'),
      ('2026-09-01','store','finish','Finish the Whole Sale',
       'Rerate the account, look for more than one upgrade, present protection, accessories, Home Internet, and trade when they fit.',3,'working')`;
  }

  // Historical Noelle SBS records. These insert only if that date is not already present.
  const noelle = (await sql`SELECT id FROM reps WHERE slug='noelle'`)[0];
  if (noelle) {
    const seed = async (date, ratings, summary, notes, behaviorNotes) => {
      const exists = await sql`SELECT 1 FROM sbs_observations WHERE rep_id=${noelle.id} AND observed_on=${date} LIMIT 1`;
      if (!exists.length) {
        await sql`INSERT INTO sbs_observations(
          rep_id,observed_on,title,greet,understand,recommend,confirm,educate,thank,
          notes,coaching_summary,behavior_notes)
          VALUES(${noelle.id},${date},'Historical Side-by-Side',
          ${ratings.greet},${ratings.understand},${ratings.recommend},${ratings.confirm},${ratings.educate},${ratings.thank},
          ${notes},${summary},${JSON.stringify(behaviorNotes)}::jsonb)`;
      }
    };

    await seed('2026-06-19',
      {greet:1,understand:2,recommend:1,confirm:2,educate:1,thank:1},
      'Own the greeting and bring the accessory solution to the customer.',
      'Warm customer care and useful discovery. The biggest misses were greeting ownership, physically presenting the full recommendation, first-bill education, and sharing contact information.',
      {
        greet:'Let customers come to her, but did greet within the expected window.',
        understand:'Asked Live, Work, Play questions and identified the need for port information and a new phone.',
        recommend:'Recommended Internet, plan benefits, insurance and Next Up; accessories needed to be physically brought into the recommendation.',
        confirm:'Confirmed plan fit and that the reason for the visit was resolved.',
        educate:'Explained a lot and offered content-transfer help; first-bill expectations needed more attention.',
        thank:'Appreciative close, but contact information was not shared.'
      });

    await seed('2026-06-24',
      {greet:1,understand:2,recommend:2,confirm:1,educate:2,thank:1},
      'Slow down and use the available tools to reinforce the value of the full solution.',
      'Strong discovery and recommendation work. Pace became the main issue: the customer received the information, but confirmation and the personal close needed more intention.',
      {
        greet:'Stayed seated during the greeting and initially directed the customers toward customer care before moving into the account.',
        understand:'Used Live, Work, Play questions and found device and Internet opportunities.',
        recommend:'Used the sales tools and did a strong job offering the Internet promotion.',
        confirm:'Moved through the explanation very quickly; the customer may not have fully absorbed the value.',
        educate:'Explained next steps and even offered help setting up watches; Internet pickup was planned for later.',
        thank:'Walked the customers out, but did not share contact information.'
      });

    await seed('2026-07-03',
      {greet:1,understand:2,recommend:1,confirm:2,educate:1,thank:2},
      'Use translator-supported discovery, then connect every recommendation to the customer’s needs.',
      'Translator-supported interaction. Noelle surfaced the customer’s concerns and confirmed the solution, but the recommendation needed accessories/AIA/data lines and education was limited by the communication barrier.',
      {
        greet:'Waited for the customer to approach instead of actively welcoming; translator was needed.',
        understand:'Spoke carefully through the translator and surfaced the customer’s concerns.',
        recommend:'Customer knew what he wanted; accessories, AIA, and data-line benefits were not presented.',
        confirm:'Reviewed what was being added, including PA4 and future upgrade options; network reinforcement was limited.',
        educate:'Customer did not fully understand through the translator and was ready to leave.',
        thank:'Reviewed future upgrade options and used the QR code so the customer could reconnect later.'
      });

    await seed('2026-07-07',
      {greet:1,understand:1,recommend:1,confirm:1,educate:1,thank:1},
      'Move beyond the requested upgrade and build a complete solution.',
      'A basic upgrade was completed, but the interaction stayed too narrow. Discovery, ecosystem recommendations, billing education, and the close all needed more ownership.',
      {
        greet:'Greeted the customer while seated.',
        understand:'Asked about the desired phone, color, and trade-in but did not broaden discovery.',
        recommend:'Only Next Up Anytime was presented; no accessory, Internet, or connected-device recommendation.',
        confirm:'The customer’s requested upgrade was handled, but the full value of the solution was not reinforced.',
        educate:'No meaningful current-bill or future-bill conversation during the sales process.',
        thank:'Basic close; customer was told the store would reach out when the phone arrived.'
      });

    await seed('2026-08-04',
      {greet:1,understand:1,recommend:1,confirm:2,educate:1,thank:1},
      'Discovery before recommendation. Stand, ask, bundle, then close personally.',
      'Very pleasant and empathetic interaction. Confirm was On Track, but discovery missed the business account and Live/Work/Play questions; accessory and rerate opportunities were also missed.',
      {
        greet:'Seated during the greeting, though very pleasant during introductions.',
        understand:'Reassured the customers and showed empathy, but did not ask about the business account or use Live, Work, Play questions.',
        recommend:'Rerate/data-device opportunity and the Buy 2 Get 1 accessory conversation were missed.',
        confirm:'Effectively confirmed that this was all the customers wanted and offered future support.',
        educate:'Content transfer and next steps were explained, but trade value was not explained clearly.',
        thank:'Warm goodbye, but the walk-out, tenure thank-you, and contact information were missed.'
      });

    await seed('2026-08-17',
      {greet:1,understand:1,recommend:2,confirm:2,educate:2,thank:1},
      'Stand and own the interaction. When you get a no, ask why, note the pushback, and keep looking for the right solution.',
      'Historical Team Huddle record: three upgrade recommendations were declined, but Noelle kept working the account and found Open Enrollment. Confirm and Educate were On Track; greeting ownership and the personal close remained recurring opportunities.',
      {
        greet:'Friendly, but remained seated and the greeting was not very personal.',
        understand:'Accessed the account and reviewed opportunities, though the behavior was rated Needs Improvement.',
        recommend:'Three upgrades were declined; Noelle kept working and found Open Enrollment as a relevant alternative.',
        confirm:'On Track.',
        educate:'On Track.',
        thank:'Did not share contact information and remained seated while the customer left.'
      });
  }
}
