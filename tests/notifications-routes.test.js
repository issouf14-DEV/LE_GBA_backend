// Routes des notifications : liste, lecture, contrôle d'accès (IDOR)
import { beforeAll, describe, expect, it } from "vitest";
import Notification from "../src/models/Notification.js";
import { createUser, loggedIn, raw, useDatabase } from "./helpers/app.js";

useDatabase();
beforeAll(() => Notification.init());

describe("Routes /api/notifications", () => {
  const seed = (user, count, extra = {}) =>
    Notification.insertMany(
      Array.from({ length: count }, (_, i) => ({
        user: user._id,
        kind: "security",
        title: `Notification ${i}`,
        eventId: `evt-${user._id}-${i}`,
        ...extra,
      }))
    );

  it("exige une session", async () => {
    expect((await raw().get("/api/notifications")).status).toBe(401);
    expect((await raw().get("/api/notifications/stream")).status).toBe(401);
  });

  it("liste paginée de SES notifications avec le nombre de non lues", async () => {
    const { client, user } = await loggedIn();
    const other = await createUser();
    await seed(user, 3);
    await seed(other, 4);
    const res = await client.get("/api/notifications?limit=2");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ unread: 3, total: 3, pages: 2, page: 1 });
    expect(res.body.notifications).toHaveLength(2);
    expect(Object.keys(res.body.notifications[0]).sort()).toEqual(
      ["body", "createdAt", "id", "kind", "link", "readAt", "title"].sort()
    );
    expect((await client.get("/api/notifications?limit=500")).status).toBe(400);
    expect((await client.get("/api/notifications?user=x")).status).toBe(400);
  });

  it("lecture d'une notification, puis tout marquer comme lu", async () => {
    const { client, user } = await loggedIn();
    const [first] = await seed(user, 3);
    const res = await client.patch(`/api/notifications/${first._id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(2);
    expect(res.body.notification.readAt).toBeTruthy();
    const all = await client.post("/api/notifications/read-all");
    expect(all.body).toMatchObject({ updated: 2, unread: 0 });
    expect(await Notification.countDocuments({ readAt: null })).toBe(0);
  });

  it("IDOR : impossible de lire ou modifier la notification d'un autre compte", async () => {
    const { client } = await loggedIn();
    const victim = await createUser();
    const [theirs] = await seed(victim, 2);
    expect((await client.patch(`/api/notifications/${theirs._id}/read`)).status).toBe(404);
    expect((await client.patch("/api/notifications/abc/read")).status).toBe(400);
    await client.post("/api/notifications/read-all");
    expect(await Notification.countDocuments({ user: victim._id, readAt: null })).toBe(2);
    expect((await client.get("/api/notifications")).body.notifications).toEqual([]);
  });
});
