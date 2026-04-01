/**
 * D1 数据库类型定义
 */
interface Env {
  DB: D1Database
}

interface D1Database {
  prepare(sql: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(sql: string): Promise<D1ExecResult>
  dump(): Promise<string>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: {
    duration: number
    last_row_id: number
    rows_read: number
    rows_written: number
    changed_db: boolean
    changes: number
    served_by: string
  }
}

interface D1ExecResult {
  count: number
  duration: number
}

declare global {
  interface CloudflareEnv extends Env {}
}

export {}
