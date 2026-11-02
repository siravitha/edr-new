// C:\Working\edr-new\app\api\dashboard\route.ts
import { NextResponse } from 'next/server';
import { getExecutiveDashboardData } from '@/lib/executive-dashboard';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unit = searchParams.get('unit') || undefined;
    const dateFrom = searchParams.get('from') || undefined;
    const dateTo = searchParams.get('to') || undefined;
    const fiscalYear = searchParams.get('year')
      ? parseInt(searchParams.get('year')!)
      : undefined;

    const data = await getExecutiveDashboardData({
      unit,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      fiscalYear,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}