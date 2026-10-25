import mongoose from "mongoose";
import { httpError } from "../middlewares/errorMiddleware.js";
import Order from "../models/Order.js";
import Vehicle from "../models/Vehicle.js";
import {
  PUBLIC_FIELDS,
  toNewVehicle,
  toPublicVehicle,
  toVehicleUpdate,
} from "../services/vehicles.js";
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

// Photo enregistrée depuis l'administration, servie comme une vraie image (mise en cache)
export async function getVehicleImage(req, res) {
  const vehicle = await Vehicle.findById(req.validated.params.id)
    .select("+imageData +imageType")
    .lean();
  if (!vehicle?.imageData || !vehicle.imageType) throw httpError(404, "Image introuvable");
  res
    .type(vehicle.imageType)
    .set("Cache-Control", "public, max-age=31536000, immutable")
    .send(Buffer.from(vehicle.imageData, "base64"));
}

// Admin : req.body a déjà été réduit par Zod aux seuls champs autorisés
export async function createVehicle(req, res) {
  const vehicle = await Vehicle.create(toNewVehicle(req.body));
  res.status(201).json(toPublicVehicle(vehicle));
}

export async function updateVehicle(req, res) {
  const vehicle = await Vehicle.findByIdAndUpdate(
    req.validated.params.id,
    toVehicleUpdate(req.body),
    {
      new: true,
      runValidators: true,
    }
  )
    .select(PUBLIC_FIELDS)
    .lean();
  if (!vehicle) throw httpError(404, "Véhicule introuvable");
  res.json(toPublicVehicle(vehicle));
}

// Un véhicule réservé ne peut pas être supprimé (les réservations en cours le référencent)
export async function deleteVehicle(req, res) {
  const { id } = req.validated.params;
  const active = await Order.exists({
    vehicle: id,
    status: mongoose.trusted({ $in: ["en_attente", "validee"] }),
  });
  if (active) {
    throw httpError(
      409,
      "Ce véhicule a des réservations en cours : rendez-le indisponible à la place"
    );
  }
  const vehicle = await Vehicle.findByIdAndDelete(id);
  if (!vehicle) throw httpError(404, "Véhicule introuvable");
  res.status(204).end();
}
