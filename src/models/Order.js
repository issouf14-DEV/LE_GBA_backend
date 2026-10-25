import mongoose from "mongoose";

export const ORDER_STATUSES = ["en_attente", "validee", "rejetee", "annulee", "terminee"];

// Transitions autorisées : impossible par exemple de « terminer » une commande rejetée
export const ALLOWED_TRANSITIONS = {
  en_attente: ["validee", "rejetee", "annulee"],
  validee: ["terminee", "annulee"],
  rejetee: [],
  annulee: [],
  terminee: [],
};

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    // Copie au moment de la commande : le prix facturé ne change pas si le véhicule est modifié
    vehicleSnapshot: {
      brand: String,
      model: String,
      year: Number,
      image: String,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 1 },
    pricePerDay: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
    contact: {
      fullName: { type: String, required: true, maxlength: 100 },
      email: { type: String, required: true, maxlength: 254 },
      phone: { type: String, required: true, maxlength: 20 },
      address: { type: String, required: true, maxlength: 300 },
    },
    notes: { type: String, maxlength: 500, default: "" },
    status: { type: String, enum: ORDER_STATUSES, default: "en_attente", index: true },
    paymentMethod: { type: String, enum: ["on_delivery"], default: "on_delivery" },
    validatedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

orderSchema.index({ vehicle: 1, status: 1, startDate: 1, endDate: 1 });

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
