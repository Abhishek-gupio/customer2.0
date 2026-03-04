const fs = require('fs');
const path = 'C:\\MYTEAM\\customer2.0\\prisma\\prisma\\schema.prisma';

let content = fs.readFileSync(path, 'utf8');

const customerModels = [
    'Customer',
    'CustomerDevice',
    'DigiLockerConnection',
    'CustomerDocument',
    'CustomerVehicle',
    'VehicleHealthScore',
    'User'
];

const customerEnums = [
    'DocumentType',
    'VerificationStatus',
    'DocumentSource',
    'DigiLockerStatus'
];

// 1. Remove all existing @@schema tags to start fresh
content = content.replace(/\s+@@schema\(".*?"\)/g, '');

// 2. Add @@schema tags to models
content = content.replace(/model\s+(\w+)\s+\{([\s\S]*?)\}/g, (match, name, body) => {
    const schema = customerModels.includes(name) ? 'customer' : 'public';
    const lastBraceIndex = match.lastIndexOf('}');
    return match.slice(0, lastBraceIndex).trimEnd() + `\n\n  @@schema("${schema}")\n}`;
});

// 3. Add @@schema tags to enums
content = content.replace(/enum\s+(\w+)\s+\{([\s\S]*?)\}/g, (match, name, body) => {
    const schema = customerEnums.includes(name) ? 'customer' : 'public';
    const lastBraceIndex = match.lastIndexOf('}');
    return match.slice(0, lastBraceIndex).trimEnd() + `\n\n  @@schema("${schema}")\n}`;
});

fs.writeFileSync(path, content);
console.log('Refined schema.prisma with correct public/customer tags for models and enums.');
