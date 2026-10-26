// Flux temps réel SSE : en-têtes, remise des notifications insérées, isolement entre comptes,
// limite de flux, fermeture à l'expiration de l'accès, repli par interrogation
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../src/app.js";
import { env } from "../src/config/env.js";
import Notification from "../src/models/Notification.js";
import { ensureFeed, feedMode, stopFeed } from "../src/services/notifications/feed.js";
import { closeAllStreams, streamCount } from "../src/services/notifications/hub.js";
import { createUser, loggedIn, useDatabase } from "./helpers/app.js";
import { openStream } from "./helpers/sse.js";

useDatabase();

let server;
let port;
const opened = [];
const defaultPing = env.SSE_PING_MS;

beforeAll(async () => {
  // Ping rapide : la session est revérifiée à chaque ping (déconnexion détectée en < 1 s)
  env.SSE_PING_MS = 300;
  await Notification.init();
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  port = server.address().port;
});

afterEach(async () => {
  for (const stream of opened.splice(0)) stream.close();
  closeAllStreams();
  await stopFeed();
});

afterAll(async () => {
  env.SSE_PING_MS = defaultPing;
  closeAllStreams();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function connect(token) {
  const stream = await openStream(port, token);
  opened.push(stream);
  return stream;
}

const insert = (user, title = "Mot de passe modifié") =>
  Notification.create({ user: user._id, kind: "security", title, eventId: String(Math.random()) });

const isNotification = (title) => (e) => e.event === "notification" && e.json.title === title;

describe("Flux SSE /api/notifications/stream", () => {
  it("en-têtes SSE, retry conseillé, nombre de non lues à l'ouverture", async () => {
    const { user, accessToken } = await loggedIn();
    await insert(user);
    const stream = await connect(accessToken);
    expect(stream.status).toBe(200);
    expect(stream.res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(stream.res.headers["cache-control"]).toBe("no-cache, no-transform");
    expect(stream.res.headers["x-accel-buffering"]).toBe("no");
    expect(stream.res.headers["content-encoding"]).toBeUndefined();
    const ready = await stream.waitFor((e) => e.event === "ready");
    expect(ready.json).toEqual({ unread: 1 });
    expect(stream.events.some((e) => e.retry > 0)).toBe(true);
  });

  it("une notification insérée est poussée à son destinataire seulement (change stream)", async () => {
    const alice = await loggedIn();
    const bob = await loggedIn();
    const aliceStream = await connect(alice.accessToken);
    const bobStream = await connect(bob.accessToken);
    await aliceStream.waitFor((e) => e.event === "ready");
    await bobStream.waitFor((e) => e.event === "ready");
    expect(feedMode()).toBe("change-stream");

    await insert(bob.user, "Pour Bob");
    await insert(alice.user, "Pour Alice");
    const received = await aliceStream.waitFor(isNotification("Pour Alice"));
    expect(Object.keys(received.json).sort()).toEqual(
      ["body", "createdAt", "id", "kind", "link", "readAt", "title"].sort()
    );
    await bobStream.waitFor(isNotification("Pour Bob"));
    expect(aliceStream.events.some(isNotification("Pour Bob"))).toBe(false);
  });

  it("au plus 5 flux par utilisateur, nettoyés à la déconnexion", async () => {
    const { accessToken } = await loggedIn();
    const streams = [];
    for (let i = 0; i < 5; i += 1) streams.push(await connect(accessToken));
    await Promise.all(streams.map((s) => s.waitFor((e) => e.event === "ready")));
    const sixth = await connect(accessToken);
    expect(sixth.status).toBe(429);
    expect(streamCount()).toBe(5);
    for (const stream of streams) stream.close();
    await expect.poll(() => streamCount(), { timeout: 5000 }).toBe(0);
  });

  it("le flux se ferme quand le jeton d'accès expire (événement reauth)", async () => {
    const { accessToken } = await loggedIn();
    const { sub, ver, sid } = jwt.decode(accessToken);
    const shortToken = jwt.sign({ sub, ver, sid }, process.env.JWT_ACCESS_SECRET, {
      algorithm: "HS256",
      issuer: "le-gba",
      audience: "le-gba-web",
      expiresIn: 2,
    });
    const stream = await connect(shortToken);
    await stream.waitFor((e) => e.event === "reauth", 8000);
    await stream.waitFor("end", 3000);
    expect(streamCount()).toBe(0);
  });

  it("le flux se ferme après la déconnexion (session revérifiée au ping)", async () => {
    const { client, accessToken } = await loggedIn();
    const stream = await connect(accessToken);
    await stream.waitFor((e) => e.event === "ready");
    await client.post("/api/auth/logout");
    await stream.waitFor("end", 5000);
    expect(stream.events.some((e) => e.comment)).toBe(true);
  });

  it("repli par interrogation périodique quand le change stream est indisponible", async () => {
    await ensureFeed({ mode: "poll", pollMs: 200 });
    const user = await createUser();
    const { accessToken, user: me } = await loggedIn();
    const stream = await connect(accessToken);
    await stream.waitFor((e) => e.event === "ready");
    expect(feedMode()).toBe("poll");
    await insert(user, "Pas pour moi");
    await insert(me, "Pour moi");
    await stream.waitFor(isNotification("Pour moi"), 5000);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(stream.events.filter(isNotification("Pour moi"))).toHaveLength(1);
    expect(stream.events.some(isNotification("Pas pour moi"))).toBe(false);
  });
});
