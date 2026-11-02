// C:\Working\edr-new\app\api\assets\route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/assets — List with pagination + filter
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const department = searchParams.get('department') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { assetNo: { contains: search } },
        { name: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (department) where.department = department;

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.asset.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: assets,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/assets — Create
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assetNo, name, department, cost, quantity, purchaseDate, notes } = body;

    if (!assetNo || !name) {
      return NextResponse.json(
        { success: false, error: 'assetNo and name are required' },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.create({
      data: {
        assetNo,
        name,
        department: department || '',
        cost: cost ? new Decimal(cost) : new Decimal(0),
        quantity: quantity || 1,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        notes: notes || null,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}