const { db, close } = require("../db");
const { users, refreshTokens } = require("../db/schema");
const {
  eq,
  ne,
  and,
  or,
  gt,
  gte,
  lt,
  lte,
  ilike,
  isNull,
  isNotNull,
  desc,
  asc,
  count,
} = require("drizzle-orm");
const { randomUUID } = require("node:crypto");
function predicate(table, where = {}) {
  const clauses = Object.entries(where)
    .filter(([, v]) => v !== undefined)
    .map(([key, value]) => {
      if (key === "OR") return or(...value.map((v) => predicate(table, v)));
      if (key === "AND") return and(...value.map((v) => predicate(table, v)));
      const col = table[key];
      if (!col) throw new Error("Unsupported query field");
      if (value === null) return isNull(col);
      if (typeof value === "object" && !(value instanceof Date))
        return and(
          ...Object.entries(value)
            .filter(([op]) => op !== "mode")
            .map(([op, v]) =>
              ({
                gt: () => gt(col, v),
                gte: () => gte(col, v),
                lt: () => lt(col, v),
                lte: () => lte(col, v),
                not: () => (v === null ? isNotNull(col) : ne(col, v)),
                contains: () => ilike(col, `%${v}%`),
              })[op]?.(),
            ),
        );
      return eq(col, value);
    });
  return and(...clauses);
}
function repository(table) {
  async function expand(row, options) {
    if (!row) return null;
    if (options.include?.user)
      row.user = await user.findUnique({ where: { id: row.userId } });
    if (options.include?._count)
      row._count = {
        refreshTokens: await refreshToken.count({
          where: {
            userId: row.id,
            isRevoked: false,
            expiresAt: { gt: new Date() },
          },
        }),
      };
    if (options.select)
      return Object.fromEntries(
        Object.entries(options.select)
          .filter(([, v]) => v)
          .map(([k]) => [k, row[k]]),
      );
    return row;
  }
  const repo = {
    async findMany(options = {}) {
      let query = db
        .select()
        .from(table)
        .where(predicate(table, options.where));
      if (options.orderBy) {
        const [k, v] = Object.entries(options.orderBy)[0];
        query = query.orderBy(v === "asc" ? asc(table[k]) : desc(table[k]));
      }
      if (options.take)
        query = query.limit(Math.min(200, Math.max(1, options.take)));
      if (options.skip) query = query.offset(Math.max(0, options.skip));
      return Promise.all((await query).map((row) => expand(row, options)));
    },
    async findUnique(options) {
      const rows = await db
        .select()
        .from(table)
        .where(predicate(table, options.where))
        .limit(1);
      return expand(rows[0], options);
    },
    async findFirst(options) {
      return repo.findUnique(options);
    },
    async create({ data }) {
      return (
        await db
          .insert(table)
          .values({ id: randomUUID(), ...data })
          .returning()
      )[0];
    },
    async update({ where, data }) {
      const rows = await db
        .update(table)
        .set({ ...data, ...(table.updatedAt ? { updatedAt: new Date() } : {}) })
        .where(predicate(table, where))
        .returning();
      if (!rows.length)
        throw Object.assign(new Error("Not found"), { code: "P2025" });
      return rows[0];
    },
    async delete({ where }) {
      return (
        await db.delete(table).where(predicate(table, where)).returning()
      )[0];
    },
    async deleteMany({ where } = {}) {
      return {
        count: (
          await db
            .delete(table)
            .where(predicate(table, where))
            .returning({ id: table.id })
        ).length,
      };
    },
    async count({ where } = {}) {
      return Number(
        (
          await db
            .select({ value: count() })
            .from(table)
            .where(predicate(table, where))
        )[0].value,
      );
    },
    async groupBy({ by }) {
      const columns = Object.fromEntries(by.map((k) => [k, table[k]]));
      return await db
        .select({ ...columns, _count: count() })
        .from(table)
        .groupBy(...Object.values(columns));
    },
  };
  return repo;
}
const user = repository(users),
  refreshToken = repository(refreshTokens);
module.exports = {
  user,
  refreshToken,
  $disconnect: close,
  $connect: async () => {
    await db.select({ id: users.id }).from(users).limit(1);
  },
};
