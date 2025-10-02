// lib/db/queries.ts
import { query } from './client';

export interface NearestStyleProfile {
  id: string;
  source_url: string;
  distance: number;
  tokens_json: any;
  ux_summary: any;
}

export async function findNearestStyleProfiles(
  referenceProfileId: string,
  limit: number = 10
): Promise<NearestStyleProfile[]> {
  // For <1000 vectors, brute force is faster than IVFFlat
  const res = await query(`
    SELECT
      sp2.id,
      sp2.source_url,
      sp2.style_vec <-> sp1.style_vec AS distance,
      sp2.tokens_json,
      sp2.ux_summary
    FROM style_profiles sp1, style_profiles sp2
    WHERE sp1.id = $1 AND sp2.id != sp1.id
    ORDER BY distance ASC
    LIMIT $2
  `, [referenceProfileId, limit]);

  return res.rows;
}

export interface NearestPrimaryCta {
  id: string;
  style_profile_id: string;
  distance: number;
  tokens_json: any;
  ux_report: any;
}

export async function findNearestPrimaryCtas(
  referenceProfileId: string,
  limit: number = 10
): Promise<NearestPrimaryCta[]> {
  const res = await query(`
    SELECT
      r2.id,
      r2.style_profile_id,
      r2.vec <-> r1.vec AS distance,
      r2.tokens_json,
      r2.ux_report
    FROM role_vectors_primarycta r1, role_vectors_primarycta r2
    WHERE r1.style_profile_id = $1 AND r2.style_profile_id != $1
    ORDER BY distance ASC
    LIMIT $2
  `, [referenceProfileId, limit]);

  return res.rows;
}

export async function getStyleProfileByRunId(runId: string) {
  const res = await query(`
    SELECT sp.*
    FROM style_profiles sp
    JOIN captures c ON sp.capture_id = c.id
    WHERE c.run_id = $1
  `, [runId]);

  return res.rows[0];
}

export async function getAllStyleProfiles() {
  const res = await query(`
    SELECT
      sp.id,
      sp.source_url,
      sp.created_at,
      c.run_id,
      sp.ux_summary
    FROM style_profiles sp
    JOIN captures c ON sp.capture_id = c.id
    ORDER BY sp.created_at DESC
  `);

  return res.rows.map(row => ({
    ...row,
    brand_tone: row.ux_summary?.brandPersonality?.tone || null
  }));
}
