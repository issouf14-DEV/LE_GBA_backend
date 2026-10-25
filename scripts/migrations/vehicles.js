// Anciennes fiches véhicule : photo base64 dans `image` et champs de l'ancien import automatique
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const LEGACY_FIELDS = {
  vin: "",
  drivetrain: "",
  engine: "",
  exteriorColor: "",
  interiorColor: "",
  miles: "",
  stock: "",
};

export async function migrateVehicles(db, apply) {
  const vehicles = db.collection("vehicles");
  const all = await vehicles.find({}).toArray();
  let photos = 0;
  let unsafe = 0;

  for (const vehicle of all) {
    const set = {};
    const match = typeof vehicle.image === "string" ? vehicle.image.match(DATA_URL) : null;
    if (match) {
      Object.assign(set, {
        image: "",
        imageData: match[2],
        imageType: match[1],
        hasImageData: true,
      });
      photos++;
    } else if (vehicle.image && !String(vehicle.image).startsWith("https://")) {
      // Adresse http:// ou autre format : refusée par le site, on la retire
      set.image = "";
      unsafe++;
    }
    if (vehicle.hasImageData === undefined && !match) set.hasImageData = false;

    if (apply) {
      await vehicles.updateOne({ _id: vehicle._id }, { $set: set, $unset: LEGACY_FIELDS });
    }
  }
  // L'ancien index unique sur le VIN n'a plus de raison d'être
  if (apply) await vehicles.dropIndex("vin_1").catch(() => {});

  return `${all.length} véhicule(s), dont ${photos} photo(s) à déplacer et ${unsafe} image(s) non sûre(s)`;
}
