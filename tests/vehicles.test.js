// Catalogue : lecture publique, écriture admin, photos servies à part
import { describe, expect, it } from "vitest";
import Vehicle from "../src/models/Vehicle.js";
import { createVehicle, loggedIn, loggedInAdmin, raw, useDatabase } from "./helpers/app.js";

useDatabase();

// Plus petite image PNG valide (1 x 1 pixel)
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const FORM = {
  brand: "Toyota",
  model: "Yaris",
  price: 20_000,
  year: 2024,
  type: "hybrid",
  available: true,
  featured: false,
};

describe("catalogue public", () => {
  it("liste les véhicules sans données internes", async () => {
    await createVehicle();
    const res = await raw().get("/api/vehicles");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.vehicles[0]).not.toHaveProperty("__v");
  });

  it("une recherche piégée (expression régulière) est traitée comme du texte", async () => {
    await createVehicle();
    const res = await raw().get(`/api/vehicles?brand=${encodeURIComponent("(a+)+$.*")}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe("photos", () => {
  it("une photo envoyée en base64 n'est jamais incluse dans la liste", async () => {
    const { client } = await loggedInAdmin();
    const created = await client.post("/api/vehicles", {
      ...FORM,
      image: `data:image/png;base64,${PNG_BASE64}`,
    });
    expect(created.status).toBe(201);
    expect(created.body.image).toMatch(/^\/api\/vehicles\/[a-f0-9]{24}\/image\?v=\d+$/);

    const list = await raw().get("/api/vehicles");
    expect(JSON.stringify(list.body)).not.toContain(PNG_BASE64);

    const image = await raw().get(created.body.image);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("garder la photo actuelle lors d'une modification ne l'efface pas", async () => {
    const { client } = await loggedInAdmin();
    const created = await client.post("/api/vehicles", {
      ...FORM,
      image: `data:image/png;base64,${PNG_BASE64}`,
    });
    const id = created.body._id;
    const updated = await client.put(`/api/vehicles/${id}`, {
      ...FORM,
      price: 22_000,
      image: created.body.image,
    });
    expect(updated.status).toBe(200);
    const saved = await Vehicle.findById(id).select("+imageData");
    expect(saved.imageData).toBe(PNG_BASE64);
    expect(saved.price).toBe(22_000);
  });

  it("refuse une image dangereuse (javascript:, http, SVG)", async () => {
    const { client } = await loggedInAdmin();
    for (const image of [
      "javascript:alert(1)",
      "http://site.com/a.png",
      "data:image/svg+xml;base64,PHN2Zz4=",
    ]) {
      expect((await client.post("/api/vehicles", { ...FORM, image })).status).toBe(400);
    }
  });
});

describe("administration du catalogue", () => {
  it("un client ne peut ni créer, ni modifier, ni supprimer", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle();
    expect((await client.post("/api/vehicles", FORM)).status).toBe(403);
    expect((await client.put(`/api/vehicles/${vehicle._id}`, FORM)).status).toBe(403);
    expect((await client.delete(`/api/vehicles/${vehicle._id}`)).status).toBe(403);
  });

  it("refuse les champs non prévus (ex : données de l'ancien import)", async () => {
    const { client } = await loggedInAdmin();
    expect((await client.post("/api/vehicles", { ...FORM, vin: "X" })).status).toBe(400);
  });
});
