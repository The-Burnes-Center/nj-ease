import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { feedback, documentType, email } = await request.json();
    
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback is required' }, { status: 400 });
    }
    
    // Insert the feedback into Supabase
    const { data, error } = await supabase
      .from('feedback')
      .insert([
        { 
          feedback,
          document_type: documentType || null,
          email: email || null,
          created_at: new Date().toISOString()
        }
      ]);
      
    if (error) {
      console.error('Error saving feedback:', error);
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error processing feedback:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
} 