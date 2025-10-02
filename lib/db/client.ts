// lib/db/client.ts
import { Pool, QueryResult } from 'pg';

// Singleton pool
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'dawn',
      user: process.env.POSTGRES_USER || 'dawn',
      password: process.env.POSTGRES_PASSWORD || 'dawn',

      // Connection pool settings
      max: 20,                      // max connections
      idleTimeoutMillis: 30000,     // close idle connections after 30s
      connectionTimeoutMillis: 5000, // timeout after 5s
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
      process.exit(-1);
    });
  }

  return pool;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  const poolInstance = getPool();

  try {
    const res = await poolInstance.query(text, params);
    const duration = Date.now() - start;

    if (process.env.NODE_ENV === 'development') {
      console.log('[DB Query]', {
        duration: `${duration}ms`,
        rows: res.rowCount,
        query: text.substring(0, 100)
      });
    }

    return res;
  } catch (error) {
    console.error('[DB Error]', {
      query: text.substring(0, 100),
      params,
      error
    });
    throw error;
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const poolInstance = getPool();
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export { pool };
