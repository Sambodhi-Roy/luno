const { createUser, createAdmin } = require("../_helpers/auth.helper");
const { createElement, createMap } = require("../_helpers/admin.helper");
const {
  createSpace,
  getSpace,
  getAllElements,
  addElement,
  removeElement,
} = require("../_helpers/space.helper");

jest.setTimeout(30000);

describe("Arena (elements inside a space)", () => {
  let admin, user, elementId, spaceId;

  beforeAll(async () => {
    admin = await createAdmin();
    user = await createUser();

    const e1 = await createElement(admin.token);
    const e2 = await createElement(admin.token);
    elementId = e1.data.id;

    const mapRes = await createMap(admin.token, {
      dimensions: "100x200",
      defaultElements: [
        { elementId: e1.data.id, x: 20, y: 20 },
        { elementId: e2.data.id, x: 18, y: 20 },
        { elementId: e1.data.id, x: 19, y: 20 },
      ],
    });

    const spaceRes = await createSpace(user.token, "Arena", "100x200", mapRes.data.id);
    spaceId = spaceRes.data.spaceId;
  });

  test("Unknown spaceId returns 404", async () => {
    const res = await getSpace(user.token, "non-existent-space-id");
    expect(res.status).toBe(404);
  });

  test("Valid spaceId returns dimensions and elements", async () => {
    const res = await getSpace(user.token, spaceId);
    expect(res.status).toBe(200);
    expect(res.data.dimensions).toBe("100x200");
    expect(res.data.elements.length).toBe(3);
  });

  test("Other signed-in users can view the space", async () => {
    const res = await getSpace(admin.token, spaceId);
    expect(res.status).toBe(200);
  });

  test("Element catalogue is listed", async () => {
    const res = await getAllElements(user.token);
    expect(res.status).toBe(200);
    expect(res.data.elements.find((e) => e.id === elementId)).toBeDefined();
  });

  test("Owner can remove an element", async () => {
    const before = await getSpace(user.token, spaceId);
    const res = await removeElement(user.token, before.data.elements[0].id);
    expect(res.status).toBe(200);

    const after = await getSpace(user.token, spaceId);
    expect(after.data.elements.length).toBe(2);
  });

  test("Non-owner cannot remove an element", async () => {
    const space = await getSpace(user.token, spaceId);
    const res = await removeElement(admin.token, space.data.elements[0].id);
    expect(res.status).toBe(403);
  });

  test("Adding an element outside the space fails", async () => {
    const far = await addElement(user.token, spaceId, elementId, 500000000, 200000000);
    expect(far.status).toBe(400);

    // A 1x1 element at x=100 would overflow a 100-wide space by one tile
    const edge = await addElement(user.token, spaceId, elementId, 100, 0);
    expect(edge.status).toBe(400);
  });

  test("Non-owner cannot add an element", async () => {
    const res = await addElement(admin.token, spaceId, elementId, 50, 20);
    expect(res.status).toBe(403);
  });

  test("Owner can add an element inside the space", async () => {
    const res = await addElement(user.token, spaceId, elementId, 50, 20);
    expect(res.status).toBe(200);

    const after = await getSpace(user.token, spaceId);
    expect(after.data.elements.length).toBe(3);
  });
});
