// Deletes space-wide chat messages past the retention limits (apps/ws also does this every hour).
//   pnpm --filter @repo/db prune-chat
import client, { pruneChatMessages } from "../src/index.js";

// The pool keeps idle connections open for minutes, so disconnect or the process won't exit
pruneChatMessages(client)
  .then((n) => console.log(`Removed ${n} old chat messages`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.$disconnect());
