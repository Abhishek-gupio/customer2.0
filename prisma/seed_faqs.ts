import { dbInstances as prisma, disconnect } from './src/index';

// No need to create a new PrismaClient instance

async function main() {
  const faqs = [
    { question: 'How to add a new vehicle?', answer: 'Go to the Garage section and tap the "Add Vehicle" button. Follow the prompts to enter your vehicle details.', category: 'General', order: 1 },
    { question: 'How to upload documents?', answer: 'Navigate to the Documents section and tap the "+" icon. Select the document type and follow the instructions to upload.', category: 'General', order: 2 },
    { question: 'How to track expenses?', answer: 'Use the Expenses section to log your fuel, maintenance, and other costs. You can view analysis and budget tracking there.', category: 'General', order: 3 },
    { question: 'How to request valet service?', answer: 'Tap the "Valet" icon on the home screen or go to the Valet section to request a pick-up or drop-off.', category: 'Service', order: 4 },
    { question: 'How to use AI Assistant?', answer: 'The AI Assistant is available throughout the app. Just tap the AI icon in the bottom navigation bar to start chatting.', category: 'General', order: 5 },
  ];

  // Clear existing FAQs
  await (prisma as any).fAQ.deleteMany({});
  console.log('Cleared existing FAQs');

  for (const faq of faqs) {
    await (prisma as any).fAQ.create({ data: faq });
  }
  console.log('Seed data added successfully.');
}

main()
  .catch(e => console.error(e))
  .finally(() => disconnect());
