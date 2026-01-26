// src/db/db.js
import Dexie from "dexie";

export const db = new Dexie("carrev");

// Suba a versão (número maior que o atual) para aplicar a mudança.
db.version(12).stores({
  // Carros
  cars: "++id, name, plate, currentMileage",

  // Abastecimentos
  abastecimentos: "++id, carId, data, km, tanqueCheio, criadoEm",

  // Revisões / Manutenções
  services: "++id, carId, date, mileage, type, createdAt",

  // Compras/acabamentos (se você estiver usando)
  purchases: "++id, carId, createdAt",

  // Desejos (se você estiver usando)
  wishlist: "++id, carId, createdAt",

  // Anexos genéricos (agora com índice composto para buscar por dono)
  attachments: "++id, ownerType, ownerId, [ownerType+ownerId], category, createdAt",
});
