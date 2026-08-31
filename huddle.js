import { sqlClient, requireAdmin, ensureDatabase } from './db.js';

const allowedStoreFields = new Set([
  'traffic','ppv','ppv_close','aia_posted','aia_submits','aia_close','htp','htp_close',
  'upgrades','data','cru','accessory_revenue','acc_per_opp','insurance_rate','nextup_rate',
  'csat','pre_to_post','pa4','opps','trade_rate','prepaid','open_enrollment'
]);

const allowedRepFields = new Set([
  'ppv','aia_posted','aia_submits','aia_close','htp','upgrades','data','cru',
  'accessory_revenue','acc_per_opp','insurance_rate','insurance_adds',
  'insurance_eligible_opps','nextup_rate','csat','pre_to_post','pa4','opps',
  'trade_rate','prepaid','open_enrollment','ple_complete'
]);

const goalFields = new Set([
  'traffic','opportunities','ppv','ppv_close','aia_posted','aia_submits','aia_close',
  'htp','htp_close','upgrades','data','accessory_target','accessory_qualifier',
  'insurance_target','insurance_qualifier','trade_target','csat_target',
  'rep_aia_qualifier','rep_htp_qualifier'
]);

async function snapshot(sql) {
  const config = (await sql`SELECT * FROM app_config WHERE id=1`)[0];
  const month = config.active_month;

  const goals =
    (await sql`SELECT * FROM monthly_goals WHERE month=${month}`)[0] || {};

  const store =
    (await sql`SELECT * FROM store_metrics WHERE month=${month}`)[0] || {};

  const reps = await sql`
    SELECT
      r.*,
      COALESCE(row_to_json(m),'{}'::json) AS metrics
    FROM reps r
    LEFT JOIN rep_metrics m
      ON m.rep_id=r.id
      AND m.month=${month}
    WHERE r.active=true
    ORDER BY r.sort_order,r.display_name
  `;

  const coaching = await sql`
    SELECT
      c.*,
      r.slug AS rep_slug,
      r.display_name AS rep_name
    FROM coaching_points c
    LEFT JOIN reps r
      ON r.id=c.rep_id
    WHERE c.month=${month}
      AND c.active=true
    ORDER BY c.sort_order,c.updated_at DESC
  `;

  const sbs = await sql`
    SELECT
      s.*,
      r.slug AS rep_slug,
      r.display_name AS rep_name
    FROM sbs_observations s
    JOIN reps r
      ON r.id=s.rep_id
    ORDER BY s.observed_on DESC,s.updated_at DESC
    LIMIT 100
  `;

  return {
    config,
    goals,
    store,
    reps,
    coaching,
    sbs
  };
}

async function updateField(
  sql,
  table,
  field,
  value,
  whereSql,
  args=[]
) {
  const query =
    `UPDATE ${table}
     SET ${field}=$1, updated_at=now()
     WHERE ${whereSql}`;

  await sql.query(query,[value,...args]);
}

export default async function handler(req,res) {
  try {
    const sql = sqlClient();

    await ensureDatabase(sql);

    if (req.method === 'GET') {
      return res.status(200).json(
        await snapshot(sql)
      );
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        error:'Method not allowed'
      });
    }

    requireAdmin(req);

    const b = req.body || {};

    if (b.action === 'verify_admin') {
      return res.status(200).json({
        ok:true
      });
    }

    if (b.action === 'save_config') {

      await sql`
        UPDATE app_config
        SET
          headline=${b.headline||''},
          opening_prompt=${b.opening_prompt||''},
          team_message=${b.team_message||''},
          updated_at=now()
        WHERE id=1
      `;

    } else if (b.action === 'save_goals') {

      for (const [k,v] of Object.entries(b.fields||{})) {

        if (goalFields.has(k)) {

          await updateField(
            sql,
            'monthly_goals',
            k,
            v,
            'month=(SELECT active_month FROM app_config WHERE id=1)'
          );

        }

      }

    } else if (b.action === 'save_store') {

      for (const [k,v] of Object.entries(b.fields||{})) {

        if (allowedStoreFields.has(k)) {

          await updateField(
            sql,
            'store_metrics',
            k,
            v,
            'month=(SELECT active_month FROM app_config WHERE id=1)'
          );

        }

      }

    } else if (b.action === 'save_rep') {

      const rep =
        (await sql`
          SELECT id
          FROM reps
          WHERE slug=${b.rep_slug}
        `)[0];

      if (!rep) {
        throw new Error('Rep not found');
      }

      for (const [k,v] of Object.entries(b.fields||{})) {

        if (allowedRepFields.has(k)) {

          await updateField(
            sql,
            'rep_metrics',
            k,
            v,
            'rep_id=$2 AND month=(SELECT active_month FROM app_config WHERE id=1)',
            [rep.id]
          );

        }

      }

    } else if (b.action === 'add_coaching') {

      let repId = null;

      if (b.rep_slug) {

        const rep =
          (await sql`
            SELECT id
            FROM reps
            WHERE slug=${b.rep_slug}
          `)[0];

        repId = rep?.id || null;

      }

      await sql`
        INSERT INTO coaching_points(
          month,
          scope,
          rep_id,
          kind,
          title,
          body,
          sort_order
        )
        VALUES(
          (SELECT active_month FROM app_config WHERE id=1),
          ${b.rep_slug?'rep':'store'},
          ${repId},
          ${b.kind||'coach'},
          ${b.title||''},
          ${b.body||''},
          ${Number(b.sort_order||100)}
        )
      `;

    } else if (b.action === 'delete_coaching') {

      await sql`
        DELETE FROM coaching_points
        WHERE id=${b.id}
      `;

    } else if (b.action === 'add_sbs') {

      const rep =
        (await sql`
          SELECT id
          FROM reps
          WHERE slug=${b.rep_slug}
        `)[0];

      if (!rep) {
        throw new Error('Rep not found');
      }

      await sql`
        INSERT INTO sbs_observations(
          rep_id,
          observed_on,
          title,
          greet,
          understand,
          recommend,
          confirm,
          educate,
          thank,
          notes,
          coaching_summary
        )
        VALUES(
          ${rep.id},
          ${b.observed_on||new Date().toISOString().slice(0,10)},
          ${b.title||''},
          ${b.greet||null},
          ${b.understand||null},
          ${b.recommend||null},
          ${b.confirm||null},
          ${b.educate||null},
          ${b.thank||null},
          ${b.notes||''},
          ${b.coaching_summary||''}
        )
      `;

    } else if (b.action === 'delete_sbs') {

      await sql`
        DELETE FROM sbs_observations
        WHERE id=${b.id}
      `;

    } else {

      throw new Error('Unknown action');

    }

    return res.status(200).json({
      ok:true,
      data:await snapshot(sql)
    });

  } catch (e) {

    console.error(e);

    return res.status(e.statusCode||500).json({
      error:e.message||'Server error'
    });

  }
}
