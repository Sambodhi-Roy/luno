const { createUser } = require("../_helpers/auth.helper");
const {
  createSpace,
  updateSpace,
  getSpace,
  getAllSpaces,
  getJoinedSpaces,
  getPublicSpaces,
  visitSpace,
  leaveSpace,
  getInvite,
  acceptInvite,
  resetInvite,
} = require("../_helpers/space.helper");

jest.setTimeout(30000);

describe("Space visibility, membership and invites", () => {
  let owner, guest, stranger, privateId, publicId, inviteCode;

  beforeAll(async () => {
    owner = await createUser();
    guest = await createUser();
    stranger = await createUser();

    privateId = (await createSpace(owner.token, "Private HQ", "10x10")).data.spaceId;
    publicId = (await createSpace(owner.token, "Public Lobby", "10x10", undefined, "Public")).data.spaceId;
    inviteCode = (await getSpace(owner.token, privateId)).data.inviteCode;
  });

  test("New spaces are private by default and listed with their visibility", async () => {
    const res = await getAllSpaces(owner.token);
    const byId = Object.fromEntries(res.data.spaces.map((s) => [s.id, s.visibility]));
    expect(byId[privateId]).toBe("Private");
    expect(byId[publicId]).toBe("Public");
  });

  test("Only the owner sees the invite code", async () => {
    expect(typeof inviteCode).toBe("string");
    const res = await getSpace(guest.token, publicId);
    expect(res.status).toBe(200);
    expect(res.data.inviteCode).toBeUndefined();
  });

  test("A private space is refused to non-members", async () => {
    expect((await getSpace(stranger.token, privateId)).status).toBe(403);
    expect((await visitSpace(stranger.token, privateId)).status).toBe(403);
  });

  test("Explore lists public spaces from other people, not private ones", async () => {
    const res = await getPublicSpaces(stranger.token);
    expect(res.status).toBe(200);
    const ids = res.data.spaces.map((s) => s.id);
    expect(ids).toContain(publicId);
    expect(ids).not.toContain(privateId);
    expect(res.data.spaces.find((s) => s.id === publicId).ownerUsername).toBe(owner.username);

    const own = await getPublicSpaces(owner.token);
    expect(own.data.spaces.map((s) => s.id)).not.toContain(publicId);
  });

  test("Visiting a public space adds it to the visitor's joined spaces", async () => {
    expect((await getJoinedSpaces(guest.token)).data.spaces).toEqual([]);

    expect((await visitSpace(guest.token, publicId)).status).toBe(200);

    const joined = await getJoinedSpaces(guest.token);
    expect(joined.data.spaces.map((s) => s.id)).toEqual([publicId]);
    expect(joined.data.spaces[0].lastVisitedAt).toEqual(expect.any(String));
  });

  test("The owner visiting their own space doesn't make them a member", async () => {
    expect((await visitSpace(owner.token, publicId)).status).toBe(200);
    expect((await getJoinedSpaces(owner.token)).data.spaces).toEqual([]);
  });

  test("An invite previews the space and accepting it grants access", async () => {
    const preview = await getInvite(guest.token, inviteCode);
    expect(preview.status).toBe(200);
    expect(preview.data).toMatchObject({ spaceId: privateId, name: "Private HQ", ownerUsername: owner.username });

    const accepted = await acceptInvite(guest.token, inviteCode);
    expect(accepted.status).toBe(200);
    expect(accepted.data.spaceId).toBe(privateId);

    expect((await getSpace(guest.token, privateId)).status).toBe(200);
    expect((await visitSpace(guest.token, privateId)).status).toBe(200);

    // Most recently visited first
    const joined = await getJoinedSpaces(guest.token);
    expect(joined.data.spaces.map((s) => s.id)).toEqual([privateId, publicId]);
  });

  test("Unknown invite codes return 404", async () => {
    expect((await getInvite(guest.token, "no-such-code")).status).toBe(404);
    expect((await acceptInvite(guest.token, "no-such-code")).status).toBe(404);
  });

  test("Resetting the invite revokes the old link but keeps existing members", async () => {
    expect((await resetInvite(guest.token, privateId)).status).toBe(403);

    const reset = await resetInvite(owner.token, privateId);
    expect(reset.status).toBe(200);
    expect(reset.data.inviteCode).not.toBe(inviteCode);

    expect((await acceptInvite(stranger.token, inviteCode)).status).toBe(404);
    expect((await getSpace(guest.token, privateId)).status).toBe(200);
  });

  test("Only the owner can rename a space or change its visibility", async () => {
    expect((await updateSpace(guest.token, privateId, { name: "Hijacked" })).status).toBe(403);
    expect((await updateSpace(owner.token, privateId, {})).status).toBe(400);

    const res = await updateSpace(owner.token, publicId, { name: "Lobby", visibility: "Private" });
    expect(res.status).toBe(200);
    expect(res.data.space).toMatchObject({ name: "Lobby", visibility: "Private" });

    // The guest joined while it was public, so they are still a member; a stranger is not
    expect((await getSpace(guest.token, publicId)).status).toBe(200);
    expect((await getSpace(stranger.token, publicId)).status).toBe(403);
  });

  test("Leaving removes the space from the dashboard and gives up access to a private one", async () => {
    expect((await leaveSpace(guest.token, privateId)).status).toBe(200);
    expect((await leaveSpace(guest.token, privateId)).status).toBe(404);

    const joined = await getJoinedSpaces(guest.token);
    expect(joined.data.spaces.map((s) => s.id)).not.toContain(privateId);
    expect((await getSpace(guest.token, privateId)).status).toBe(403);
  });
});
