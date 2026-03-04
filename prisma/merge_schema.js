const fs = require('fs');
const path = require('path');

const introPath = 'C:\\MYTEAM\\customer2.0\\prisma\\introspection.prisma';
const outPath = 'C:\\MYTEAM\\customer2.0\\prisma\\prisma\\schema.prisma';

try {
    let intro = fs.readFileSync(introPath, 'utf16le');

    const header = `generator client {
  provider        = "prisma-client-js"
  output          = "../src/generated/client"
  previewFeatures = ["driverAdapters", "multiSchema", "postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  schemas  = ["public", "customer", "customer_app", "dm_project", "gupio_crm", "tech_park"]
}

`;

    // Remove the introspection-generated generator and datasource
    // Find the first model or enum
    const modelMatch = intro.match(/(model|enum)\s+/);
    if (modelMatch) {
        intro = intro.slice(modelMatch.index);
    }

    fs.writeFileSync(outPath, header + intro, 'utf8');
    console.log('Successfully updated schema.prisma with introspection data.');
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}
