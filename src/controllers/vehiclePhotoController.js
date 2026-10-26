// Photos des véhicules : affichage public, gestion par l'équipe (permission vehicles.manage)
import { httpError } from "../middlewares/errorMiddleware.js";
import { auditVehicle } from "../services/audit.js";
import { addPhoto, findPhoto, removePhoto, reorderPhotos } from "../services/vehiclePhotos.js";
import { toPublicVehicle } from "../services/vehicles.js";

// Une photo ne change jamais (une nouvelle photo a un nouvel identifiant) : cache longue durée
export async function getPhoto(req, res) {
  const { id, photoId } = req.validated.params;
  const photo = await findPhoto(id, photoId);
  if (!photo) throw httpError(404, "Photo introuvable");
  res
    .type(photo.type)
    .set("Cache-Control", "public, max-age=31536000, immutable")
    .send(Buffer.from(photo.data.buffer ?? photo.data));
}

export async function uploadPhoto(req, res) {
  const vehicle = await addPhoto(req.validated.params.id, req.body.image, req.user._id);
  const photoId = vehicle.gallery.at(-1)?._id;
  await auditVehicle(req, "photo.added", vehicle, { photoId });
  res.status(201).json(toPublicVehicle(vehicle));
}

export async function deletePhoto(req, res) {
  const { id, photoId } = req.validated.params;
  const vehicle = await removePhoto(id, photoId);
  await auditVehicle(req, "photo.deleted", vehicle, { photoId });
  res.json(toPublicVehicle(vehicle));
}

export async function updatePhotoOrder(req, res) {
  const vehicle = await reorderPhotos(req.validated.params.id, req.body.order);
  res.json(toPublicVehicle(vehicle));
}
