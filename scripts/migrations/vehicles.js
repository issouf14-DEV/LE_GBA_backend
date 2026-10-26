// Anciennes fiches véhicule -> photos gérées par l'équipe :
// - photo base64 (champ imageData ou image « data: ») déplacée dans la collection vehiclephotos ;
// - images externes https existantes CONSERVÉES dans legacyImages (affichées tant que l'équipe
//   n'a pas ajouté de photo) ; plus aucune nouvelle image externe n'est récupérée ;
// - véhicule sans catégorie : « thermal » par défaut (à corriger ensuite par l'équipe) ;
// - option removeImageless : les anciens véhicules SANS AUCUNE image sont SUPPRIMÉS.
import mongoose from "mongoose";

const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const LEGACY_FIELDS = {
  image: "",
  imageData: "",
  imageType: "",
  hasImageData: "",
  photos: "",
  vin: "",
  drivetrain: "",
  engine: "",
  exteriorColor: "",
  interiorColor: "",
  miles: "",
  stock: "",
};
const TYPES = ["thermal", "electric", "hybrid"];

// Photo base64 éventuelle de l'ancienne version : { type, data } ou null
function legacyPhoto(vehicle) {
  if (vehicle.imageData && vehicle.imageType) {
    return { type: vehicle.imageType, data: Buffer.from(vehicle.imageData, "base64") };
  }
  const match = typeof vehicle.image === "string" ? vehicle.image.match(DATA_URL) : null;
  return match ? { type: match[1], data: Buffer.from(match[2], "base64") } : null;
}

// Anciennes adresses https (image principale + ancien tableau photos), sans doublon
const externalImages = (vehicle) =>
  [...new Set([vehicle.image, ...(Array.isArray(vehicle.photos) ? vehicle.photos : [])])].filter(
    (url) => typeof url === "string" && /^https:\/\/[^\s"'<>]+$/.test(url)
  );

export async function migrateVehicles(db, apply, { removeImageless = false } = {}) {
  const vehicles = db.collection("vehicles");
  const photos = db.collection("vehiclephotos");
  const legacy = await vehicles
    .find({ $or: Object.keys(LEGACY_FIELDS).map((field) => ({ [field]: { $exists: true } })) })
    .toArray();
  let moved = 0;
  let kept = 0;
  let deleted = 0;

  for (const vehicle of legacy) {
    const photo = legacyPhoto(vehicle);
    const external = externalImages(vehicle);
    if (removeImageless && !photo && external.length === 0 && !vehicle.gallery?.length) {
      deleted++;
      if (apply) await vehicles.deleteOne({ _id: vehicle._id });
      continue;
    }
    if (external.length > 0) kept++;
    if (photo) moved++;
    if (!apply) continue;

    const set = external.length > 0 ? { legacyImages: external } : {};
    if (photo) {
      const _id = new mongoose.Types.ObjectId();
      await photos.insertOne({ _id, vehicle: vehicle._id, ...photo, size: photo.data.length });
      set.gallery = [...(vehicle.gallery || []), { _id }];
    }
    await vehicles.updateOne({ _id: vehicle._id }, { $set: set, $unset: LEGACY_FIELDS });
  }
  const untyped = await vehicles.countDocuments({ type: { $nin: TYPES } });
  if (apply) {
    await vehicles.updateMany({ type: { $nin: TYPES } }, { $set: { type: "thermal" } });
    await vehicles.updateMany({ gallery: { $exists: false } }, { $set: { gallery: [] } });
    // L'ancien index unique sur le VIN n'a plus de raison d'être
    await vehicles.dropIndex("vin_1").catch(() => {});
  }

  const removal = removeImageless ? `, ${deleted} véhicule(s) sans image SUPPRIMÉ(S)` : "";
  const typed = apply
    ? `${untyped} catégorie(s) mise(s) à « thermique »`
    : `${untyped - deleted} sans catégorie (deviendront « thermique »)`;
  return `${legacy.length} véhicule(s) à l'ancien format : ${moved} photo(s) à déplacer, ${kept} véhicule(s) gardant leurs images existantes${removal}, ${typed}`;
}
