import { PrismaClient, CreatorType, AssetType, AssetStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🎭 Seeding AI models for marketplace...\n');

  // First, we need a demo creator profile
  // Check if demo creator exists
  let demoCreator = await prisma.creatorProfile.findFirst({
    where: { displayName: 'Seetu Demo' },
  });

  if (!demoCreator) {
    // Create a demo user first
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo-creator@seetu.co' },
      update: {},
      create: {
        authId: 'demo-creator-auth-id-' + Date.now(),
        email: 'demo-creator@seetu.co',
        name: 'Demo Creator',
        creditUnits: 0,
        plan: 'creator',
      },
    });

    demoCreator = await prisma.creatorProfile.create({
      data: {
        userId: demoUser.id,
        type: CreatorType.MODEL,
        displayName: 'Seetu Demo',
        bio: 'Demo models for testing the platform',
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    console.log('  ✓ Created demo creator profile');
  }

  // AI Model profiles with diverse representations
  const models = [
    {
      title: 'Aminata',
      description: 'Modèle féminin professionnel, style polyvalent',
      gender: 'female',
      ageRange: '25-35',
      styles: ['professional', 'casual', 'traditional'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=600&fit=crop',
      imageUrls: [
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1200&fit=crop',
      ],
    },
    {
      title: 'Fatou',
      description: 'Modèle féminin élégant, looks traditionnels',
      gender: 'female',
      ageRange: '18-25',
      styles: ['traditional', 'elegant', 'casual'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=400&h=600&fit=crop',
      imageUrls: [
        'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=800&h=1200&fit=crop',
      ],
    },
    {
      title: 'Ousmane',
      description: 'Modèle masculin moderne, style urbain',
      gender: 'male',
      ageRange: '25-35',
      styles: ['urban', 'professional', 'casual'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
      imageUrls: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1200&fit=crop',
      ],
    },
    {
      title: 'Mariama',
      description: 'Modèle féminin, style fashion contemporain',
      gender: 'female',
      ageRange: '18-25',
      styles: ['fashion', 'streetwear', 'elegant'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=600&fit=crop',
      imageUrls: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1200&fit=crop',
      ],
    },
    {
      title: 'Ibrahima',
      description: 'Modèle masculin, look professionnel et traditionnel',
      gender: 'male',
      ageRange: '35-45',
      styles: ['professional', 'traditional', 'elegant'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=600&fit=crop',
      imageUrls: [
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1200&fit=crop',
      ],
    },
    {
      title: 'Awa',
      description: 'Modèle féminin mature, élégance intemporelle',
      gender: 'female',
      ageRange: '35-45',
      styles: ['elegant', 'professional', 'traditional'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=600&fit=crop',
      imageUrls: [
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1200&fit=crop',
      ],
    },
  ];

  for (const model of models) {
    const existing = await prisma.creatorAsset.findFirst({
      where: {
        creatorId: demoCreator.id,
        title: model.title,
        type: AssetType.MODEL_PROFILE,
      },
    });

    if (!existing) {
      await prisma.creatorAsset.create({
        data: {
          creatorId: demoCreator.id,
          type: AssetType.MODEL_PROFILE,
          status: AssetStatus.APPROVED,
          title: model.title,
          description: model.description,
          thumbnailUrl: model.thumbnailUrl,
          imageUrls: model.imageUrls,
          modelGender: model.gender,
          modelAgeRange: model.ageRange,
          modelStyles: model.styles,
          priceUnits: 0, // Free for demo
          consentVerified: true,
          reviewedAt: new Date(),
          tags: model.styles,
        },
      });
      console.log(`  ✓ ${model.title}`);
    } else {
      console.log(`  • ${model.title} (already exists)`);
    }
  }

  // Update creator stats
  const assetCount = await prisma.creatorAsset.count({
    where: { creatorId: demoCreator.id },
  });

  await prisma.creatorProfile.update({
    where: { id: demoCreator.id },
    data: { totalAssets: assetCount },
  });

  console.log(`\n✅ Seeded ${models.length} AI models`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
