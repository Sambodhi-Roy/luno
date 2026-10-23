// GET /space/:spaceId/messages: who may read a space's saved chat. Sending and paging are in tests/ws/chat.
const { createUser } = require("../_helpers/auth.helper");
const { createSpace } = require("../_helpers/space.helper");
const client = require("../_helpers/axios.client");

jest.setTimeout(30000);

function history(token, spaceId, query = "") {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
  return client.get(`/space/${spaceId}/messages${query}`, config);
}

describe("Chat history", () => {
  let owner, stranger, privateId, publicId;

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createUser(), createUser()]);
    privateId = (await createSpace(owner.token, "Private Chat", "10x10")).data.spaceId;
    publicId = (await createSpace(owner.token, "Public Chat", "10x10", undefined, "Public")).data.spaceId;
  });

  test("The owner reads an empty history", async () => {
    const res = await history(owner.token, privateId);
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ messages: [], hasMore: false });
  });

  test("Anyone signed in reads a public space's history", async () => {
    expect((await history(stranger.token, publicId)).status).toBe(200);
  });

  test("Non-members can't read a private space's history", async () => {
    expect((await history(stranger.token, privateId)).status).toBe(403);
  });

  test("A missing space is 404", async () => {
    expect((await history(owner.token, "no-such-space")).status).toBe(404);
  });

  test("A bad page query is 400", async () => {
    expect((await history(owner.token, publicId, "?limit=0")).status).toBe(400);
    expect((await history(owner.token, publicId, "?before=yesterday")).status).toBe(400);
  });

  test("Signed-out requests are 401", async () => {
    expect((await history(null, publicId)).status).toBe(401);
  });
});
