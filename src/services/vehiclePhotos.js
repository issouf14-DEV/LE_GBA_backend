// Photos des véhicules : contrôle du contenu réel, ajout limité, ordre d'affichage
import mongoose from "mongoose";
import { httpError } from "../middlewares/errorMiddleware.js";
import Vehicle, { MAX_PHOTOS } from "../models/Vehicle.js";
import VehiclePhoto from "../models/VehiclePhoto.js";

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

// Signatures (premiers octets) : un fichier renommé ou un faux type déclaré est refusé
const SIGNATURES = {
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) =>
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
};

export function decodePhoto(dataUrl) {
  const match = typeof dataUrl === "string" ? dataUrl.match(DATA_URL) : null;
  if (!match) throw httpError(400, "Image invalide : JPEG, PNG ou WebP uniquement");
  const [, type, base64] = match;
  const data = Buffer.from(base64, "base64");
  if (data.length > MAX_PHOTO_BYTES) throw httpError(413, "Image trop lourde (2 Mo maximum)");
  if (data.length < 12 || !SIGNATURES[type](data)) {
    throw httpError(400, "Le fichier n'est pas une image JPEG, PNG ou WebP valide");
  }
  return { type, data };
}

export async function addPhoto(vehicleId, dataUrl, uploadedBy) {
  const { type, data } = decodePhoto(dataUrl);
  if (!(await Vehicle.exists({ _id: vehicleId }))) throw httpError(404, "Véhicule introuvable");
  const photo = await VehiclePhoto.create({
    vehicle: vehicleId,
    type,
    data,
    size: data.length,
    uploadedBy,
  });
  // Ajout atomique, seulement s'il reste de la place (deux envois simultanés ne dépassent pas 8)
  const vehicle = await Vehicle.findOneAndUpdate(
    { _id: vehicleId, [`gallery.${MAX_PHOTOS - 1}`]: mongoose.trusted({ $exists: false }) },
    // La première photo envoyée remplace les anciennes images externes
    { $push: { gallery: { _id: photo._id } }, $unset: { legacyImages: "" } },
    { new: true }
  );
  if (!vehicle) {
    await VehiclePhoto.deleteOne({ _id: photo._id });
    throw httpError(409, `${MAX_PHOTOS} photos maximum par véhicule`);
  }
  return vehicle;
}

export async function removePhoto(vehicleId, photoId) {
  const vehicle = await Vehicle.findOneAndUpdate(
    { _id: vehicleId, "gallery._id": photoId },
    { $pull: { gallery: { _id: photoId } } },
    { new: true }
  );
  if (!vehicle) throw httpError(404, "Photo introuvable");
  await VehiclePhoto.deleteOne({ _id: photoId, vehicle: vehicleId });
  return vehicle;
}

// Nouvel ordre : exactement les mêmes photos, dans un autre ordre (la première devient principale)
export async function reorderPhotos(vehicleId, order) {
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw httpError(404, "Véhicule introuvable");
  const current = vehicle.gallery.map((photo) => String(photo._id));
  const same =
    order.length === current.length &&
    new Set(order).size === order.length &&
    order.every((id) => current.includes(id));
  if (!same) throw httpError(400, "L'ordre doit contenir exactement les photos du véhicule");
  vehicle.gallery = order.map((id) => ({ _id: new mongoose.Types.ObjectId(id) }));
  await vehicle.save();
  return vehicle;
}

export const findPhoto = (vehicleId, photoId) =>
  VehiclePhoto.findOne({ _id: photoId, vehicle: vehicleId }).lean();

export const deletePhotosOf = (vehicleId) => VehiclePhoto.deleteMany({ vehicle: vehicleId });
