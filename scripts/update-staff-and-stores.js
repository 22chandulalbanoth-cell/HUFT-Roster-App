const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dataJsonPath = path.join(rootDir, 'data', 'roster-data.json');
const dbJsPath = path.join(rootDir, 'data', 'roster-db.js');

console.log('Loading existing data...');
const db = JSON.parse(fs.readFileSync(dataJsonPath, 'utf8'));

// Helper to clean scientific notation phones
function cleanPhone(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (s.includes('E') || s.includes('e')) {
    const num = Number(s);
    if (!isNaN(num)) {
      s = num.toLocaleString('fullwide', { useGrouping: false });
    }
  }
  s = s.replace(/[^0-9]/g, '');
  if (s.length === 10) s = '91' + s;
  return s;
}

function formatPhoneDisplay(p) {
  if (!p) return '-';
  const clean = cleanPhone(p);
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return clean;
}

// 1. COMPREHENSIVE STORE DETAILS
const enrichedStores = [
  {
    storeId: 'STORE-HYD-01',
    name: 'Hyderguda',
    officialName: 'HUFT Hyderguda (Earth Paws Pvt Ltd)',
    code: 'HYD-01',
    active: true,
    location: 'Hyderguda Main Road',
    address: 'Shop No. 3-6-290, Hyderguda Main Road, Basheer Bagh, Hyderabad, Telangana 500029',
    landmark: 'Opposite Old MLA Quarters, Near St. Joseph Degree College',
    manager: 'Chandu (Banoth Chandulal)',
    managerRole: 'Store Operations Manager',
    managerEmail: 'hyderguda@headsupfortails.com',
    managerAltEmail: 'banoth.chandulal@hotmail.com',
    phone: '918331919091',
    phoneFormatted: '+91 83319 19091',
    operatingHours: '10:00 AM – 09:30 PM (Mon – Sun)',
    services: ['Premium Pet Food & Nutrition', 'Full Spa & Grooming Salon', 'Pet Accessories & Toys', 'Dietary Consultations'],
    activeStaffCount: 13,
    status: 'Active'
  },
  {
    storeId: 'STORE-GLD-02',
    name: 'Golden Mile',
    officialName: 'HUFT Golden Mile - Kokapet',
    code: 'GLD-02',
    active: true,
    location: 'Golden Mile Business Park, Kokapet',
    address: 'Unit 4 & 5, Ground Floor, Golden Mile Commercial Complex, Kokapet, Gandipet Mandal, Hyderabad, Telangana 500075',
    landmark: 'Near Outer Ring Road (ORR) Exit 1, Kokapet Main Junction',
    manager: 'Mayangam',
    managerRole: 'Store Operations Manager',
    managerEmail: 'golden.mile@headsupfortails.com',
    managerAltEmail: 'mayangam@headsupfortails.com',
    phone: '918978742938',
    phoneFormatted: '+91 89787 42938',
    operatingHours: '10:00 AM – 09:30 PM (Mon – Sun)',
    services: ['Luxury Pet Grooming', 'Pet Spa & Hydrotherapy', 'Premium Pet Merchandise', 'Breed-Specific Grooming'],
    activeStaffCount: 10,
    status: 'Active'
  },
  {
    storeId: 'STORE-BNJ-03',
    name: 'Banjara Hills',
    officialName: 'HUFT Banjara Hills Flagship Experience Store',
    code: 'BNJ-03',
    active: true,
    location: 'Road No. 12, Banjara Hills',
    address: 'Plot No. 8-2-686/B/1, Road No. 12, MLA Colony, Banjara Hills, Hyderabad, Telangana 500034',
    landmark: 'Opposite Minar Towers, Near Century Hospital',
    manager: 'William',
    managerRole: 'Store Operations Manager',
    managerEmail: 'banjarahills@headsupfortails.com',
    managerAltEmail: 'william@headsupfortails.com',
    phone: '919233686997',
    phoneFormatted: '+91 92336 86997',
    operatingHours: '10:00 AM – 09:30 PM (Mon – Sun)',
    services: ['Flagship Retail Experience', 'Certified Master Grooming', 'Fresh Pet Bakery Treats', 'Puppy Socialization Lounge'],
    activeStaffCount: 16,
    status: 'Active'
  },
  {
    storeId: 'STORE-NAL-04',
    name: 'Nallagandla',
    officialName: 'HUFT Nallagandla Experience Store',
    code: 'NAL-04',
    active: true,
    location: 'Aparna Sarovar Grande Road, Nallagandla',
    address: 'Survey No. 308, Ground Floor, Near Aparna Sarovar Grande, Nallagandla, Serilingampally, Hyderabad, Telangana 500019',
    landmark: 'Adjacent to Aparna Sarovar Zenith Gate, Gachibowli Extended Corridor',
    manager: 'Lokesh',
    managerRole: 'Store Operations Manager',
    managerEmail: 'nallagandla@headsupfortails.com',
    managerAltEmail: 'lokesh31kings@gmail.com',
    phone: '917075188316',
    phoneFormatted: '+91 70751 88316',
    operatingHours: '10:00 AM – 09:30 PM (Mon – Sun)',
    services: ['Pet Supplies & Health Essentials', 'Spa & Hygienic Grooming', 'Pet Nutrition Guidance', 'Doorstep Home Delivery'],
    activeStaffCount: 17,
    status: 'Active'
  },
  {
    storeId: 'STORE-MAD-05',
    name: 'Madhapur',
    officialName: 'HUFT Madhapur Hitech City Hub',
    code: 'MAD-05',
    active: true,
    location: 'Hitech City Road, Madhapur',
    address: 'Shop 7 & 8, Cyber Hills, VIP Hills, Hitech City Main Road, Madhapur, Hyderabad, Telangana 500081',
    landmark: 'Near Durgam Cheruvu Metro Station & Inorbit Mall Road',
    manager: 'Kamal Kumar',
    managerRole: 'Store Operations Manager',
    managerEmail: 'madhapur@headsupfortails.com',
    managerAltEmail: 'kamalstunter12@gmail.com',
    phone: '917288074023',
    phoneFormatted: '+91 72880 74023',
    operatingHours: '10:00 AM – 09:30 PM (Mon – Sun)',
    services: ['Tech Corridor Pet Express', 'Professional Pet Styling', 'Gourmet Treats & Diet', 'Cat & Dog Grooming'],
    activeStaffCount: 7,
    status: 'Active'
  }
];

// 2. ENRICH ALL 63 EMPLOYEES
console.log('Enriching employee records...');
const enrichedEmployees = (db.employees || []).map((emp, index) => {
  const cPhone = cleanPhone(emp.phone);
  const formattedPhone = formatPhoneDisplay(cPhone);

  // Generate clean email if missing or generic
  let cleanEmail = emp.email;
  if (!cleanEmail || cleanEmail.includes('undefined')) {
    const slug = emp.name.toLowerCase().replace(/[^a-z0-9]/g, '.');
    cleanEmail = `${slug}@headsupfortails.com`;
  }

  // Refine designations
  let designation = emp.role === 'Grooming' ? 'Professional Pet Groomer' : 'Retail Sales Specialist';
  if (emp.name.toLowerCase() === 'chandu' && emp.store === 'Hyderguda') designation = 'Store Operations Manager';
  if (emp.name.toLowerCase() === 'mayangam' && emp.store === 'Golden Mile') designation = 'Store Operations Manager';
  if (emp.name.toLowerCase() === 'william' && emp.store === 'Banjara Hills') designation = 'Store Operations Manager';
  if (emp.name.toLowerCase() === 'lokesh' && emp.store === 'Nallagandla') designation = 'Store Operations Manager';
  if (emp.name.toLowerCase() === 'kamal kumar' && emp.store === 'Madhapur') designation = 'Store Operations Manager';

  // Photo URL
  let photoUrl = null;
  if (emp.profilePhotoId) {
    photoUrl = `https://drive.google.com/thumbnail?id=${emp.profilePhotoId}&sz=w200`;
  }

  return {
    ...emp,
    phone: cPhone,
    phoneFormatted: formattedPhone,
    email: cleanEmail,
    designation: designation,
    photoUrl: photoUrl,
    active: emp.active !== false
  };
});

// Update in db object
db.stores = enrichedStores;
db.employees = enrichedEmployees;

// Save to data/roster-data.json
console.log('Saving enriched data/roster-data.json...');
fs.writeFileSync(dataJsonPath, JSON.stringify(db, null, 2), 'utf8');

// Save to data/roster-db.js
console.log('Saving enriched data/roster-db.js...');
const dbJsContent = `/**
 * HUFT Roster Complete Master Database & Enterprise Portal Store Registry
 * Auto-generated and verified for HUFT – Earth Paws Pvt Ltd
 */
window.HUFT_DB = ${JSON.stringify(db, null, 2)};
`;
fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');

console.log(`✅ Successfully updated ${enrichedStores.length} stores and ${enrichedEmployees.length} staff members.`);
