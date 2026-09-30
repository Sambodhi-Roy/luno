// Removes the data the integration tests (and manual checks) leave in the shared dev database: test users and
// everything they created, plus the avatars, maps and furniture the tests register with fake image URLs.
//   pnpm --filter @repo/db cleanup-test-data         # dry run: counts what would be deleted
//   pnpm --filter @repo/db cleanup-test-data --yes   # deletes it
//   pnpm --filter @repo/db cleanup-test-data --keep-only=sam,bob --yes   # one-off: every user except these
// The Jest suite runs this with --yes in its global teardown (tests/jest.teardown.js).
// Only rows with the tests' markers match, so seed data and real content are never touched:
//   users named "test-…", fake image URLs on https://example.com/, and the test helper's furniture sprite.
import client from "../src/index.js";

const sqlString = (s: string) => `'${s.replaceAll("'", "''")}'`;
const keepOnly = process.argv
  .find((a) => a.startsWith("--keep-only="))
  ?.slice("--keep-only=".length)
  .split(",")
  .filter(Boolean);

// "check…"/"pick…" users came from early manual browser checks, before the "test-" convention was written down
const TEST_USERS = keepOnly?.length
  ? `SELECT id FROM "User" WHERE username NOT IN (${keepOnly.map(sqlString).join(", ")})`
  : `SELECT id FROM "User" WHERE username LIKE 'test-%' OR username ~ '^(check|pick)[0-9]+$'`;
const TEST_AVATARS = `SELECT id FROM "Avatar" WHERE id NOT LIKE 'seed-%' AND "imageUrl" LIKE 'https://example.com/%'`;
const TEST_MAPS = `SELECT id FROM "Map" WHERE id NOT LIKE 'seed-%' AND thumbnail LIKE 'https://example.com/%'`;
// tests/_helpers/admin.helper.js creates furniture with chair.png; real furniture is seeded or uploaded
const TEST_ELEMENTS = `SELECT id FROM "Element" WHERE id NOT LIKE 'seed-%'
  AND ("imageUrl" LIKE 'https://example.com/%' OR "imageUrl" = '/assets/elements/chair.png')`;

async function main() {
  const apply = process.argv.includes("--yes");

  const [counts] = await client.$queryRawUnsafe<Record<string, number>[]>(`
    SELECT
      (SELECT count(*)::int FROM (${TEST_USERS}) t) AS users,
      (SELECT count(*)::int FROM "Space" WHERE "creatorId" IN (${TEST_USERS})) AS spaces,
      (SELECT count(*)::int FROM (${TEST_AVATARS}) t) AS avatars,
      (SELECT count(*)::int FROM (${TEST_MAPS}) t) AS maps,
      (SELECT count(*)::int FROM (${TEST_ELEMENTS}) t) AS elements,
      (SELECT count(*)::int FROM "User" WHERE "avatarId" IN (${TEST_AVATARS})
        AND id NOT IN (${TEST_USERS})) AS "real users wearing a test avatar"`);
  const summary = Object.entries(counts ?? {})
    .map(([name, n]) => `${n} ${name}`)
    .join(", ");

  if (!apply) {
    console.log(`Would remove: ${summary}. Run again with --yes to delete.`);
    return 0;
  }

  // Foreign-key order: several relations don't cascade (placements → element, map defaults → map/element,
  // space → creator)
  await client.$transaction([
    client.$executeRawUnsafe(`UPDATE "User" SET "avatarId" = NULL WHERE "avatarId" IN (${TEST_AVATARS})`),
    client.$executeRawUnsafe(`DELETE FROM "spaceElements" WHERE "elementId" IN (${TEST_ELEMENTS})`),
    client.$executeRawUnsafe(
      `DELETE FROM "MapElements" WHERE "elementId" IN (${TEST_ELEMENTS}) OR "mapId" IN (${TEST_MAPS})`
    ),
    // Cascades to the spaces' members and placements; other spaces on a test map just lose the map
    client.$executeRawUnsafe(`DELETE FROM "Space" WHERE "creatorId" IN (${TEST_USERS})`),
    client.$executeRawUnsafe(`DELETE FROM "User" WHERE id IN (${TEST_USERS})`),
    client.$executeRawUnsafe(`DELETE FROM "Avatar" WHERE id IN (${TEST_AVATARS})`),
    client.$executeRawUnsafe(`DELETE FROM "Map" WHERE id IN (${TEST_MAPS})`),
    client.$executeRawUnsafe(`DELETE FROM "Element" WHERE id IN (${TEST_ELEMENTS})`),
  ]);
  console.log(`Removed test data: ${summary}`);
  return 0;
}

// The pool keeps idle connections open for minutes, so disconnect or the process won't exit
main()
  .then((code) => (process.exitCode = code))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.$disconnect());
