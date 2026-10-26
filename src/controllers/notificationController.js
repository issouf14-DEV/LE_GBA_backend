// Notifications de la cloche : chaque utilisateur ne voit et ne modifie que les siennes
// (le filtre porte toujours sur req.user._id, jamais sur un identifiant fourni par le client)
import { httpError } from "../middlewares/errorMiddleware.js";
import Notification, { publicNotification } from "../models/Notification.js";

const unreadCount = (userId) => Notification.countDocuments({ user: userId, readAt: null });

export async function listNotifications(req, res) {
  const { page, limit } = req.validated.query;
  const filter = { user: req.user._id };
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    unreadCount(req.user._id),
  ]);
  res.json({
    notifications: items.map(publicNotification),
    unread,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    total,
  });
}

export async function markNotificationRead(req, res) {
  const { id } = req.validated.params;
  const notification = await Notification.findOne({ _id: id, user: req.user._id });
  // Notification d'un autre compte : même réponse qu'une notification inexistante
  if (!notification) throw httpError(404, "Notification introuvable");
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.json({
    notification: publicNotification(notification),
    unread: await unreadCount(req.user._id),
  });
}

export async function markAllNotificationsRead(req, res) {
  const { modifiedCount } = await Notification.updateMany(
    { user: req.user._id, readAt: null },
    { readAt: new Date() }
  );
  res.json({ updated: modifiedCount, unread: 0 });
}
