/**
 * Test database connection endpoint
 * GET /api/test-db
 * Used to verify Supabase connection is working
 */

import { NextResponse } from 'next/server';
import { testDatabaseConnection } from '@/lib/supabase/client';

export async function GET() {
  try {
    const isConnected = await testDatabaseConnection();

    return NextResponse.json(
      {
        success: true,
        message: 'Database connection successful',
        connected: isConnected,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Database connection failed',
        error: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}




