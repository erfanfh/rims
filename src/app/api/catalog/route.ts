import {NextResponse} from 'next/server';
import data from '@/data/questionnaire.json';
export function GET(){return NextResponse.json({categories:data.categories,version:'rims-2022-fa-v1'},{headers:{'Cache-Control':'public, max-age=300'}});}
