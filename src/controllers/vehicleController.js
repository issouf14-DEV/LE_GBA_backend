import mongoose from "mongoose";
import { httpError } from "../middlewares/errorMiddleware.js";
import Vehicle from "../models/Vehicle.js";
import { auditVehicle } from "../services/audit.js";
import { hasBlockingOrders } from "../services/orderStatus.js";
import { deletePhotosOf } from "../services/vehiclePhotos.js";
import { PUBLIC_FIELDS, photoUrl, toPublicVehicle } from "../services/vehicles.js";
import { escapeRegex } from "../utils/escape.js";

const SORTS = {
  priceAsc: { price: 1 },
  priceDesc: { price: -1 },
  yearAsc: { year: 1 },
  yearDesc: { year: -1 },
  recent: { createdAt: -1 },
};

export async function getVehicles(req, res) {
  const { page, limit, type, brand, minPrice, maxPrice, sort } = req.validated.query;
  const filter = {};
  if (type) filter.type = type;
  // Texte saisi échappé : aucune expression régulière piégée (ReDoS) ne peut être injectée
  if (brand) filter.brand = new RegExp(escapeRegex(brand), "i");
  if (minPrice !== undefined || maxPrice !== undefined) {
    // Opérateurs construits par le serveur : marqués « de confiance » pour sanitizeFilter
    filter.price = mongoose.trusted({
      ...(minPrice !== undefined ? { $gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { $lte: maxPrice } : {}),
    });
  }

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter)
      .select(PUBLIC_FIELDS)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Vehicle.countDocuments(filter),
  ]);
  res.json({ vehicles: vehicles.map(toPublicVehicle), total, page, limit });
}

export async function getVehicleById(req, res) {
  const vehicle = await Vehicle.findById(req.validated.params.id).select(PUBLIC_FIELDS).lean();
  if (!vehicle) throw httpError(404, "Véhicule introuvable");
  res.json(toPublicVehicle(vehicle));
}

// Ancienne adresse de photo (copiée dans d'anciennes réservations) : renvoie vers la photo
// principale actuelle du véhicule
export async function getVehicleImage(req, res) {
  const vehicle = await Vehicle.findById(req.validated.params.id).select("gallery").lean();
  const cover = vehicle?.gallery?.[0];
  if (!cover) throw httpError(404, "Image introuvable");
  res.redirect(301, photoUrl(vehicle._id, cover._id));
}

// Admin : req.body a déjà été réduit par Zod aux seuls champs autorisés
export async function createVehicle(req, res) {
  const vehicle = await Vehicle.create(req.body);
  await auditVehicle(req, "vehicle.created", vehicle);
  res.status(201).json(toPublicVehicle(vehicle));
}

export async function updateVehicle(req, res) {
  const vehicle = await Vehicle.findByIdAndUpdate(
    req.validated.params.id,
    { $set: req.body },
    {
      new: true,
      runValidators: true,
    }
  )
    .select(PUBLIC_FIELDS)
    .lean();
  if (!vehicle) throw httpError(404, "Véhicule introuvable");
  // Seuls les noms des champs modifiés sont notés
  await auditVehicle(req, "vehicle.updated", vehicle, { fields: Object.keys(req.body) });
  res.json(toPublicVehicle(vehicle));
}

// Un véhicule réservé ne peut pas être supprimé (les réservations en cours le référencent)
export async function deleteVehicle(req, res) {
  const { id } = req.validated.params;
  const active = await hasBlockingOrders({ vehicle: id });
  if (active) {
    throw httpError(
      409,
      "Ce véhicule a des réservations en cours : rendez-le indisponible à la place"
    );
  }
  const vehicle = await Vehicle.findByIdAndDelete(id);
  if (!vehicle) throw httpError(404, "Véhicule introuvable");
  await deletePhotosOf(id);
  await auditVehicle(req, "vehicle.deleted", vehicle);
  res.status(204).end();
}
