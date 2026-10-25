// Images des véhicules : une photo base64 (jusqu'à 2 Mo) n'est jamais renvoyée dans les listes,
// sinon 100 véhicules peuvent peser des centaines de Mo par requête.
const DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

// Adresse de la photo déjà enregistrée, renvoyée telle quelle par le formulaire admin
export const OWN_IMAGE = /^\/api\/vehicles\/[a-f0-9]{24}\/image(\?v=\d+)?$/;

export const PUBLIC_FIELDS =
  "brand model year type fuel transmission power engineSize color doors seats price mileage image hasImageData photos description tags available featured createdAt updatedAt";

const NO_DATA = { imageData: 1, imageType: 1 };

// Données du formulaire admin -> opérations MongoDB ($set / $unset)
export function toVehicleUpdate(body) {
  const { image = "", ...fields } = body;
  // L'admin a gardé la photo actuelle : on n'y touche pas
  if (OWN_IMAGE.test(image)) return { $set: fields };

  const match = image.match(DATA_URL);
  if (match) {
    return {
      $set: { ...fields, image: "", imageData: match[2], imageType: match[1], hasImageData: true },
    };
  }
  return { $set: { ...fields, image, hasImageData: false }, $unset: NO_DATA };
}

// Données du formulaire admin -> nouveau document
export const toNewVehicle = (body) => toVehicleUpdate(body).$set;

const imageUrl = (vehicle) => {
  if (vehicle.hasImageData) {
    const version = new Date(vehicle.updatedAt || 0).getTime();
    return `/api/vehicles/${vehicle._id}/image?v=${version}`;
  }
  return vehicle.image?.startsWith("https://") ? vehicle.image : "";
};

// Réponse envoyée au navigateur
export function toPublicVehicle(doc) {
  const plain = doc.toObject ? doc.toObject() : doc;
  const { hasImageData: _flag, imageData: _data, imageType: _type, __v: _v, ...vehicle } = plain;
  return { ...vehicle, image: imageUrl(plain) };
}
