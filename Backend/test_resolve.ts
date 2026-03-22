import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function checkAndResolve() {
  try {
    const active = await prisma.sOSRequest.findFirst({
        where: { status: 'ACTIVE' }
    });
    
    if (!active) {
        console.log('No active SOS found to resolve.');
        return;
    }
    
    console.log(`Found active SOS ID: ${active.id}. Attempting to resolve via Service...`);
    
    // Test the service call directly first (bypassing route)
    const updated = await prisma.sOSRequest.update({
      where: { id: active.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
    console.log('Successfully resolved in DB directly:', updated);

  } catch (error: any) {
    console.error('Error resolving:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndResolve();
