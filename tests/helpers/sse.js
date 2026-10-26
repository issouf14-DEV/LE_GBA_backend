// Client SSE minimal pour les tests : ouvre /api/notifications/stream avec le cookie de session
// sur un vrai serveur HTTP (app.listen(0)) et découpe les événements reçus
import http from "node:http";
import { ACCESS_COOKIE } from "../../src/config/cookies.js";

function parse(block) {
  const event = { event: "message", data: "", comment: false };
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) event.comment = true;
    else if (line.startsWith("event: ")) event.event = line.slice(7);
    else if (line.startsWith("data: ")) event.data += line.slice(6);
    else if (line.startsWith("retry: ")) event.retry = Number(line.slice(7));
  }
  if (event.data) event.json = JSON.parse(event.data);
  return event;
}

export function openStream(port, token) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/api/notifications/stream",
        headers: token ? { Cookie: `${ACCESS_COOKIE}=${token}` } : {},
      },
      (res) => {
        const stream = { req, res, status: res.statusCode, events: [], ended: false, raw: "" };
        let buffer = "";
        const listeners = new Set();
        const notify = () => {
          for (const listener of [...listeners]) listener();
        };
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          stream.raw += chunk;
          buffer += chunk;
          let index = buffer.indexOf("\n\n");
          while (index !== -1) {
            stream.events.push(parse(buffer.slice(0, index)));
            buffer = buffer.slice(index + 2);
            index = buffer.indexOf("\n\n");
          }
          notify();
        });
        res.on("end", () => {
          stream.ended = true;
          notify();
        });
        res.on("error", () => {});
        // Attend un événement qui vérifie la condition (ou la fin du flux si until === "end")
        stream.waitFor = (predicate, timeoutMs = 10_000) =>
          new Promise((done, fail) => {
            const check = () => {
              const found = predicate === "end" ? stream.ended : stream.events.find(predicate);
              if (!found) return false;
              listeners.delete(check);
              clearTimeout(timer);
              done(found);
              return true;
            };
            const timer = setTimeout(() => {
              listeners.delete(check);
              fail(new Error("Événement SSE attendu non reçu"));
            }, timeoutMs);
            if (!check()) listeners.add(check);
          });
        stream.close = () => req.destroy();
        resolve(stream);
      }
    );
    req.on("error", reject);
  });
}
