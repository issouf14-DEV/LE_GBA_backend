import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vehicles: [
      {
        vehicle: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vehicle",
          required: true,
        },
        quantity: { type: Number, default: 1 },
      },
    ],
    totalPrice: { type: Number, required: true },
    status: {
      type: String,
      enum: ["en attente", "payée", "échouée", "remboursée"],
      default: "en attente",
    },
    paymentMethod: {
      type: String,
      enum: ["stripe", "paypal"],
      required: true,
    },
    paymentInfo: {
      id: String,
      status: String,
      receiptUrl: String,
    },
    paymentIntentId: { type: String }, // Stripe PaymentIntent
  },
  { timestamps: true }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
