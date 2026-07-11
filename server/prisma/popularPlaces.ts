import type { LocationCategory } from '../src/models/Location.js'

export interface PopularPlace {
  name: string
  address: string
  lat: number
  lng: number
  category: LocationCategory
  /** Used for map city filters — Manila/Cebu/Davao tabs match via regex on this field. */
  city: string
  placeKey: string
}

/**
 * Curated popular landmarks for launch — locations only, no accessibility reports.
 * Users can add the first reports via the app.
 */
export const POPULAR_PLACES: PopularPlace[] = [
  // —— Metro Manila ——
  { placeKey: 'seed:sm-moa', name: 'SM Mall of Asia', address: 'Seaside Blvd, Pasay City', lat: 14.5352, lng: 120.9822, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:sm-megamall', name: 'SM Megamall', address: 'EDSA cor. Doña Julia Vargas, Mandaluyong', lat: 14.5845, lng: 121.057, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:trinoma', name: 'Trinoma', address: 'EDSA cor. North Ave, Quezon City', lat: 14.6535, lng: 121.0328, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:sm-north-edsa', name: 'SM North EDSA', address: 'North Ave, Quezon City', lat: 14.6568, lng: 121.0305, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:glorietta', name: 'Glorietta', address: 'Ayala Center, Makati', lat: 14.5515, lng: 121.0255, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:greenbelt', name: 'Greenbelt', address: 'Legazpi St, Makati', lat: 14.5519, lng: 121.0218, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:bgc-high-street', name: 'BGC High Street', address: '9th Ave, Bonifacio Global City, Taguig', lat: 14.5512, lng: 121.0495, category: 'other', city: 'Manila' },
  { placeKey: 'seed:market-market', name: 'Market! Market!', address: 'McKinley Pkwy, Taguig', lat: 14.5495, lng: 121.0558, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:sm-aura', name: 'SM Aura Premier', address: '26th St cor. McKinley Pkwy, Taguig', lat: 14.5468, lng: 121.0542, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:robinsons-manila', name: 'Robinsons Place Manila', address: 'Pedro Gil cor. Adriatico, Ermita', lat: 14.5755, lng: 120.9838, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:shangri-la-ortigas', name: 'Shangri-La Plaza', address: 'EDSA cor. Shaw Blvd, Mandaluyong', lat: 14.5812, lng: 121.0548, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:up-town-center', name: 'UP Town Center', address: 'Katipunan Ave, Quezon City', lat: 14.6518, lng: 121.0752, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:eastwood', name: 'Eastwood City', address: 'E. Rodriguez Jr. Ave, Quezon City', lat: 14.6095, lng: 121.0798, category: 'mall', city: 'Manila' },
  { placeKey: 'seed:manila-city-hall', name: 'Manila City Hall', address: 'Padre Burgos Ave, Ermita', lat: 14.5906, lng: 120.9817, category: 'government', city: 'Manila' },
  { placeKey: 'seed:qc-city-hall', name: 'Quezon City Hall', address: 'Elliptical Road, Quezon City', lat: 14.6511, lng: 121.049, category: 'government', city: 'Manila' },
  { placeKey: 'seed:rizal-park', name: 'Rizal Park', address: 'Roxas Blvd, Ermita, Manila', lat: 14.5832, lng: 120.9795, category: 'other', city: 'Manila' },
  { placeKey: 'seed:intramuros', name: 'Fort Santiago', address: 'Santa Clara St, Intramuros, Manila', lat: 14.5945, lng: 120.9705, category: 'other', city: 'Manila' },
  { placeKey: 'seed:pgh', name: 'Philippine General Hospital', address: 'Taft Ave, Ermita, Manila', lat: 14.5778, lng: 120.9855, category: 'hospital', city: 'Manila' },
  { placeKey: 'seed:makati-med', name: 'Makati Medical Center', address: 'Amorsolo St, Makati', lat: 14.5592, lng: 121.0145, category: 'hospital', city: 'Manila' },
  { placeKey: 'seed:naia-t3', name: 'NAIA Terminal 3', address: 'Andrews Ave, Pasay', lat: 14.5125, lng: 121.0195, category: 'transport', city: 'Manila' },
  { placeKey: 'seed:ortigas-lrt2', name: 'Araneta Center–Cubao', address: 'General Roxas Ave, Cubao, Quezon City', lat: 14.6195, lng: 121.0565, category: 'transport', city: 'Manila' },
  // Universities — NCR
  { placeKey: 'seed:up-diliman', name: 'University of the Philippines Diliman', address: 'University Ave, Quezon City', lat: 14.6548, lng: 121.0645, category: 'school', city: 'Manila' },
  { placeKey: 'seed:ateneo-manila', name: 'Ateneo de Manila University', address: 'Katipunan Ave, Quezon City', lat: 14.6395, lng: 121.0779, category: 'school', city: 'Manila' },
  { placeKey: 'seed:dlsu-manila', name: 'De La Salle University Manila', address: 'Taft Ave, Malate, Manila', lat: 14.5647, lng: 120.9934, category: 'school', city: 'Manila' },
  { placeKey: 'seed:ust', name: 'University of Santo Tomas', address: 'España Blvd, Sampaloc, Manila', lat: 14.6099, lng: 120.9893, category: 'school', city: 'Manila' },
  { placeKey: 'seed:pup', name: 'Polytechnic University of the Philippines', address: 'Mabini Campus, Sta. Mesa, Manila', lat: 14.5964, lng: 121.0108, category: 'school', city: 'Manila' },
  { placeKey: 'seed:mapua', name: 'Mapúa University', address: 'Muralla St, Intramuros, Manila', lat: 14.5907, lng: 120.9789, category: 'school', city: 'Manila' },
  { placeKey: 'seed:nu-manila', name: 'National University Manila', address: 'Jhocson St, Sampaloc, Manila', lat: 14.6052, lng: 120.9886, category: 'school', city: 'Manila' },

  // —— Visayas (Cebu hub + nearby) ——
  { placeKey: 'seed:ayala-cebu', name: 'Ayala Center Cebu', address: 'Cebu Business Park, Cebu City', lat: 10.3187, lng: 123.9064, category: 'mall', city: 'Cebu' },
  { placeKey: 'seed:sm-cebu', name: 'SM City Cebu', address: 'North Reclamation Area, Cebu City', lat: 10.3115, lng: 123.9182, category: 'mall', city: 'Cebu' },
  { placeKey: 'seed:sm-seaside-cebu', name: 'SM Seaside City Cebu', address: 'South Road Properties, Cebu City', lat: 10.2825, lng: 123.8845, category: 'mall', city: 'Cebu' },
  { placeKey: 'seed:it-park-cebu', name: 'Cebu IT Park', address: 'Apas, Cebu City', lat: 10.3305, lng: 123.9058, category: 'other', city: 'Cebu' },
  { placeKey: 'seed:cebu-city-hall', name: 'Cebu City Hall', address: 'M.J. Cuenco Ave, Cebu City', lat: 10.2926, lng: 123.9022, category: 'government', city: 'Cebu' },
  { placeKey: 'seed:cebu-capitol', name: 'Cebu Provincial Capitol', address: 'Osmeña Blvd, Cebu City', lat: 10.3168, lng: 123.8905, category: 'government', city: 'Cebu' },
  { placeKey: 'seed:chong-hua', name: 'Chong Hua Hospital', address: 'Fuente Osmeña, Cebu City', lat: 10.3098, lng: 123.8925, category: 'hospital', city: 'Cebu' },
  { placeKey: 'seed:robinsons-cebu', name: 'Robinsons Galleria Cebu', address: 'General Maxilom Ave, Cebu City', lat: 10.3182, lng: 123.9125, category: 'mall', city: 'Cebu' },
  { placeKey: 'seed:cebu-airport', name: 'Mactan-Cebu International Airport', address: 'Lapu-Lapu City, Cebu', lat: 10.3102, lng: 123.9795, category: 'transport', city: 'Cebu' },
  { placeKey: 'seed:basilica-cebu', name: 'Basilica del Santo Niño', address: 'Osmeña Blvd, Cebu City', lat: 10.2945, lng: 123.9018, category: 'other', city: 'Cebu' },
  // Universities — Visayas
  { placeKey: 'seed:usc-cebu', name: 'University of San Carlos', address: 'P. del Rosario St, Cebu City', lat: 10.2995, lng: 123.8988, category: 'school', city: 'Cebu' },
  { placeKey: 'seed:cebu-normal', name: 'Cebu Normal University', address: 'Osmeña Blvd, Cebu City', lat: 10.2978, lng: 123.8965, category: 'school', city: 'Cebu' },
  { placeKey: 'seed:uc-cebu', name: 'University of Cebu', address: 'Sanciangko St, Cebu City', lat: 10.2972, lng: 123.9015, category: 'school', city: 'Cebu' },
  { placeKey: 'seed:up-visayas', name: 'UP Visayas Iloilo', address: 'Gen. Luna St, Iloilo City', lat: 10.6969, lng: 122.5647, category: 'school', city: 'Iloilo' },
  { placeKey: 'seed:cpu-iloilo', name: 'Central Philippine University', address: 'Lopez Jaena St, Jaro, Iloilo City', lat: 10.7202, lng: 122.5621, category: 'school', city: 'Iloilo' },
  { placeKey: 'seed:sm-iloilo', name: 'SM City Iloilo', address: 'Benigno Aquino Ave, Mandurriao, Iloilo City', lat: 10.7205, lng: 122.5491, category: 'mall', city: 'Iloilo' },
  { placeKey: 'seed:usls-bacolod', name: 'University of St. La Salle Bacolod', address: 'La Salle Ave, Bacolod', lat: 10.6435, lng: 122.9687, category: 'school', city: 'Bacolod' },
  { placeKey: 'seed:sm-bacolod', name: 'SM City Bacolod', address: 'Lacson St, Bacolod', lat: 10.6721, lng: 122.9542, category: 'mall', city: 'Bacolod' },

  // —— Mindanao ——
  { placeKey: 'seed:abreeza', name: 'Abreeza Mall', address: 'J.P. Laurel Ave, Davao City', lat: 7.1183, lng: 125.6478, category: 'mall', city: 'Davao' },
  { placeKey: 'seed:sm-davao', name: 'SM City Davao', address: 'Quimpo Blvd, Ecoland, Davao City', lat: 7.0505, lng: 125.5938, category: 'mall', city: 'Davao' },
  { placeKey: 'seed:gaisano-davao', name: 'Gaisano Mall of Davao', address: 'J.P. Laurel Ave, Davao City', lat: 7.0735, lng: 125.6125, category: 'mall', city: 'Davao' },
  { placeKey: 'seed:spmc', name: 'Southern Philippines Medical Center', address: 'JP Laurel Ave, Davao City', lat: 7.0975, lng: 125.6211, category: 'hospital', city: 'Davao' },
  { placeKey: 'seed:davao-city-hall', name: 'Davao City Hall', address: 'San Pedro St, Davao City', lat: 7.0648, lng: 125.6078, category: 'government', city: 'Davao' },
  { placeKey: 'seed:peoples-park-davao', name: "People's Park", address: 'Palma Gil St, Davao City', lat: 7.0702, lng: 125.6095, category: 'other', city: 'Davao' },
  { placeKey: 'seed:davao-airport', name: 'Francisco Bangoy International Airport', address: 'Daang Maharlika, Davao City', lat: 7.1256, lng: 125.6458, category: 'transport', city: 'Davao' },
  { placeKey: 'seed:nccc-davao', name: 'NCCC Mall VP', address: 'McArthur Highway, Davao City', lat: 7.0588, lng: 125.5955, category: 'mall', city: 'Davao' },
  // Universities — Mindanao
  { placeKey: 'seed:addu', name: 'Ateneo de Davao University', address: 'Roxas Ave, Davao City', lat: 7.0725, lng: 125.6128, category: 'school', city: 'Davao' },
  { placeKey: 'seed:umindanao', name: 'University of Mindanao', address: 'Bolton St, Davao City', lat: 7.0688, lng: 125.6055, category: 'school', city: 'Davao' },
  { placeKey: 'seed:usep-davao', name: 'University of Southeastern Philippines', address: 'Bo. Obrero, Davao City', lat: 7.0755, lng: 125.6218, category: 'school', city: 'Davao' },
  { placeKey: 'seed:xu-cdo', name: 'Xavier University', address: 'Corrales Ave, Cagayan de Oro', lat: 8.4792, lng: 124.6439, category: 'school', city: 'Cagayan de Oro' },
  { placeKey: 'seed:sm-cdo', name: 'SM CDO Downtown Premier', address: 'Claro M. Recto Ave, Cagayan de Oro', lat: 8.4842, lng: 124.6485, category: 'mall', city: 'Cagayan de Oro' },
  { placeKey: 'seed:msu-iligan', name: 'Mindanao State University – Iligan', address: 'Acmac, Iligan City', lat: 8.2289, lng: 124.2432, category: 'school', city: 'Iligan' },
]
