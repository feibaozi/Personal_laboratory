// ---- Enums ----

export type GarmentCategory =
  | 'top' | 'bottom' | 'outerwear' | 'dress'
  | 'shoes' | 'bag' | 'accessory' | 'hat' | 'scarf' | 'other';

export type Color =
  | 'white' | 'black' | 'gray' | 'navy' | 'beige'
  | 'red' | 'pink' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'purple' | 'brown' | 'khaki' | 'denim'
  | 'multicolor';

export type Pattern =
  | 'solid' | 'stripe' | 'plaid' | 'floral'
  | 'polka_dot' | 'camouflage' | 'animal' | 'abstract'
  | 'graphic' | 'other';

export type Material =
  | 'cotton' | 'linen' | 'silk' | 'wool' | 'cashmere'
  | 'denim' | 'leather' | 'polyester' | 'nylon' | 'suede'
  | 'knit' | 'chiffon' | 'other';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all_season';

export type Occasion =
  | 'casual' | 'work' | 'date' | 'party'
  | 'sport' | 'formal' | 'travel' | 'home';

export type Style =
  | 'minimalist' | 'casual' | 'streetwear' | 'business'
  | 'sporty' | 'vintage' | 'bohemian' | 'preppy'
  | 'punk' | 'elegant' | 'other';

// ---- Data Models ----

export interface Garment {
  id: string;
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
  stickerUrl: string | null;
  category: GarmentCategory;
  subcategory: string | null;
  colors: string;       // JSON string from DB, parsed on use
  patterns: string | null;
  materials: string | null;
  seasons: string;
  occasions: string;
  style: string | null;
  fit: string | null;
  garmentLength: string | null;
  brand: string | null;
  purchaseDate: string | null;
  price: number | null;
  status: 'active' | 'idle' | 'retired';
  favorite: boolean;
  notes: string | null;
  wearCount: number;
  lastWornDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutfitGarment {
  garmentId: string;
  layer: number;
  position?: { x: number; y: number; width: number; height: number; zIndex: number };
}

export interface Outfit {
  id: string;
  name: string;
  garments: string;     // JSON string: OutfitGarment[]
  occasions: string | null;
  seasons: string | null;
  style: string | null;
  rating: number;
  tags: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRecord {
  id: string;
  date: string;
  outfitId: string | null;
  garmentIds: string | null;
  occasion: string | null;
  temperature: number | null;
  weatherCondition: string | null;
  mood: string | null;
  rating: number;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BodyProfile {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  height: number;
  weight: number | null;
  measurements: string | null;
  bodyType: string | null;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TryOnConfig {
  garmentId: string;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  zIndex: number;
  rotation: number;
}

// ---- Color HSL Model ----

export interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

// ---- Weather ----

export interface WeatherInfo {
  temperature: number;
  condition: string;
  humidity: number;
}

// ---- UI State ----

export interface FilterState {
  category: GarmentCategory | null;
  colors: Color[];
  seasons: Season[];
  search: string;
}
