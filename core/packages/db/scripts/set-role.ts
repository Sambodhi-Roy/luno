// Promotes a user to Admin or demotes them back to User. This is how admins are created: self-signup as
// Admin (ALLOW_ADMIN_SIGNUP) exists only for the test suite and must stay off in production.
//   pnpm --filter @repo/db promote-admin <username>
//   pnpm --filter @repo/db demote-admin <username>
// Takes effect immediately without signing in again: authenticateAdmin and /user/me read the role from the
// database. The role claim inside existing JWTs goes stale, but nothing uses it for authorisation.
import client from "../src/index.js";

const ROLES = ["Admin", "User"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [role, username] = process.argv.slice(2);

  if (!ROLES.includes(role as Role) || !username) {
    console.error("Usage: tsx scripts/set-role.ts <Admin|User> <username>");
    return 1;
  }

  const user = await client.user.findUnique({ where: { username }, select: { id: true, role: true } });
  if (!user) {
    console.error(`No user named "${username}"`);
    return 1;
  }

  if (user.role === role) {
    console.log(`${username} is already ${role}, nothing to do`);
    return 0;
  }

  await client.user.update({ where: { id: user.id }, data: { role: role as Role } });
  console.log(`${username}: ${user.role} → ${role}`);
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
