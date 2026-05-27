import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';

export async function GET() {
  try {
    const settings = getAllSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (!key) {
      return NextResponse.json(
        { error: 'key 是必填项' },
        { status: 400 }
      );
    }
    setSetting(key, value);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
