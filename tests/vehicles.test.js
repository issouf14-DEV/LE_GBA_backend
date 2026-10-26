// Catalogue : lecture publique, écriture par l'équipe, photos envoyées par l'équipe
import { describe, expect, it } from "vitest";
import Vehicle from "../src/models/Vehicle.js";
import { createVehicle, loggedIn, loggedInManager, raw, useDatabase } from "./helpers/app.js";

useDatabase();

// Plus petite image PNG valide (1 x 1 pixel)
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const PNG = `data:image/png;base64,${PNG_BASE64}`;
const FORM = {
  brand: "Toyota",
  model: "Yaris",
  price: 20_000,
  year: 2024,
  type: "hybrid",
  available: true,
  featured: false,
};
const manager = () => loggedInManager(["vehicles.manage"]);
const upload = (client, id, image = PNG) => client.post(`/api/vehicles/${id}/photos`, { image });

describe("catalogue public", () => {
  it("liste les véhicules sans données internes", async () => {
    await createVehicle();
    const res = await raw().get("/api/vehicles");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.vehicles[0]).not.toHaveProperty("__v");
    expect(res.body.vehicles[0]).not.toHaveProperty("gallery");
  });

  it("une recherche piégée (expression régulière) est traitée comme du texte", async () => {
    await createVehicle();
    const res = await raw().get(`/api/vehicles?brand=${encodeURIComponent("(a+)+$.*")}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it("filtre par catégorie (thermique, hybride, électrique)", async () => {
    await createVehicle({ type: "electric" });
    await createVehicle({ type: "hybrid" });
    const res = await raw().get("/api/vehicles?type=electric");
    expect(res.body.vehicles.map((vehicle) => vehicle.type)).toEqual(["electric"]);
  });
});

describe("photos envoyées par l'équipe", () => {
  it("ajoute une photo, servie à part et jamais incluse dans la liste", async () => {
    const { client } = await manager();
    const vehicle = await createVehicle();
    const res = await upload(client, vehicle._id);
    expect(res.status).toBe(201);
    expect(res.body.image).toMatch(/^\/api\/vehicles\/[a-f0-9]{24}\/photos\/[a-f0-9]{24}$/);
    expect(JSON.stringify((await raw().get("/api/vehicles")).body)).not.toContain(PNG_BASE64);

    const image = await raw().get(res.body.image);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("refuse un faux fichier image, un SVG et une adresse externe", async () => {
    const { client } = await manager();
    const vehicle = await createVehicle();
    const fake = `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;
    for (const image of [fake, "data:image/svg+xml;base64,PHN2Zz4=", "https://site.com/a.png"]) {
      expect((await upload(client, vehicle._id, image)).status, image.slice(0, 30)).toBe(400);
    }
  });

  it("8 photos maximum, réordonnables, la première est la principale", async () => {
    const { client } = await manager();
    const vehicle = await createVehicle();
    let last;
    for (let i = 0; i < 8; i++) last = await upload(client, vehicle._id);
    expect(last.body.images).toHaveLength(8);
    expect((await upload(client, vehicle._id)).status).toBe(409);

    const ids = last.body.images.map((url) => url.split("/").pop());
    const reordered = await client.put(`/api/vehicles/${vehicle._id}/photos/order`, {
      order: [...ids].reverse(),
    });
    expect(reordered.body.image.endsWith(ids[7])).toBe(true);
    const partial = await client.put(`/api/vehicles/${vehicle._id}/photos/order`, {
      order: ids.slice(1),
    });
    expect(partial.status).toBe(400);
  });

  it("supprimer une photo ou le véhicule supprime aussi le fichier", async () => {
    const { client } = await manager();
    const vehicle = await createVehicle();
    const { body } = await upload(client, vehicle._id);
    const photoId = body.image.split("/").pop();
    const res = await client.delete(`/api/vehicles/${vehicle._id}/photos/${photoId}`);
    expect(res.body.images).toEqual([]);
    expect((await raw().get(body.image)).status).toBe(404);
  });

  it("garde les anciennes images tant qu'aucune photo n'a été envoyée", async () => {
    const { client } = await manager();
    const vehicle = await createVehicle({ legacyImages: ["https://images.unsplash.com/a.jpg"] });
    const before = await raw().get(`/api/vehicles/${vehicle._id}`);
    expect(before.body.image).toBe("https://images.unsplash.com/a.jpg");
    const after = await upload(client, vehicle._id);
    expect(after.body.images).toHaveLength(1);
    expect(after.body.image).toMatch(/^\/api\/vehicles\//);
  });
});

describe("administration du catalogue", () => {
  it("un client ne peut ni créer, ni modifier, ni ajouter de photo", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle();
    expect((await client.post("/api/vehicles", FORM)).status).toBe(403);
    expect((await client.put(`/api/vehicles/${vehicle._id}`, FORM)).status).toBe(403);
    expect((await upload(client, vehicle._id)).status).toBe(403);
  });

  it("catégorie obligatoire ; champ image, adresse externe ou ancien champ refusés", async () => {
    const { client } = await manager();
    const { type: _type, ...withoutType } = FORM;
    expect((await client.post("/api/vehicles", withoutType)).status).toBe(400);
    for (const extra of [{ image: "https://a.com/b.jpg" }, { vin: "X" }]) {
      expect((await client.post("/api/vehicles", { ...FORM, ...extra })).status).toBe(400);
    }
    const created = await client.post("/api/vehicles", FORM);
    expect(created.status).toBe(201);
    expect((await Vehicle.findById(created.body._id)).type).toBe("hybrid");
  });
});
