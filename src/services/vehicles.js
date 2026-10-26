// Véhicules : réponse publique (avec les adresses des photos) et champs modifiables
export const PUBLIC_FIELDS =
  "brand model year type fuel transmission power engineSize color doors seats price mileage gallery legacyImages description tags available featured createdAt updatedAt";

export const photoUrl = (vehicleId, photoId) => `/api/vehicles/${vehicleId}/photos/${photoId}`;

// Seules les anciennes adresses https sont réaffichées (jamais http, javascript:, etc.)
const safeLegacy = (list = []) => list.filter((url) => /^https:\/\/[^\s"'<>]+$/.test(url));

// Réponse envoyée au navigateur : `images` dans l'ordre d'affichage, `image` = photo principale.
// Photos envoyées par l'équipe en priorité ; sinon, anciennes images conservées.
export function toPublicVehicle(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  const { gallery = [], legacyImages, __v: _v, ...vehicle } = plain;
  const uploaded = gallery.map((photo) => photoUrl(plain._id, photo._id));
  const images = uploaded.length > 0 ? uploaded : safeLegacy(legacyImages);
  return { ...vehicle, images, image: images[0] || "" };
}
