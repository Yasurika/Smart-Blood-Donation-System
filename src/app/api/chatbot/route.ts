import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import logger from '@/lib/logger';

// ─── Types ──────────────────────────────────────────────────────────────────
interface QAEntry {
  id: number;
  category: string;
  keywords: string[];
  question: string;
  answer: string;
}

interface ChatRequest {
  message: string;
}

// ─── Load Dataset ───────────────────────────────────────────────────────────

// Cache for both languages
const qaCache: Record<string, QAEntry[]> = {};

function detectLanguage(text: string): 'en' | 'si' | 'singlish' {
  // Check for Sinhala Unicode range
  if (/[\u0D80-\u0DFF]/.test(text)) return 'si';
  
  // Check for Singlish patterns (common transliterations)
  const singlishPatterns = /\b(matte|puluwan|donate|blood|rohuladai|mokada|ayubowang|kohomat|karanaw|dena|laganda|hadala|ki|yadda|hariyata)\b/i;
  if (singlishPatterns.test(text)) return 'singlish';
  
  return 'en';
}

function loadDataset(lang: 'en' | 'si' | 'singlish'): QAEntry[] {
  if (qaCache[lang] && qaCache[lang].length > 0) return qaCache[lang];
  try {
    let fileName = 'blood_donation_qa_en.json';
    if (lang === 'si') fileName = 'blood_donation_qa_si.json';
    if (lang === 'singlish') fileName = 'blood_donation_qa_singlish.json';
    
    const filePath = path.join(process.cwd(), 'dataset', fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');
    qaCache[lang] = JSON.parse(raw) as QAEntry[];
    logger.info(`Chatbot dataset loaded: ${qaCache[lang].length} entries [${lang}]`);
    return qaCache[lang];
  } catch (err) {
    logger.error('Failed to load chatbot dataset', { error: err, lang });
    return [];
  }
}

// ─── Matching Engine ────────────────────────────────────────────────────────

function normalizeText(text: string, lang: 'en' | 'si' | 'singlish'): string {
  if (lang === 'si') {
    // Sinhala: remove punctuation, normalize whitespace
    return text
      .replace(/[\u200B-\u200D\uFEFF\p{P}\p{S}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  } else {
    // English and Singlish: same normalization
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}


function tokenize(text: string, lang: 'en' | 'si' | 'singlish'): string[] {
  if (lang === 'en' || lang === 'singlish') {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'i', 'me', 'my', 'we',
      'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this',
      'that', 'what', 'which', 'who', 'whom', 'how', 'when', 'where',
      'why', 'if', 'then', 'so', 'but', 'and', 'or', 'not', 'no', 'yes',
      'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'as',
      'into', 'about', 'up', 'out', 'just', 'also', 'very', 'too',
    ]);
    return normalizeText(text, lang)
      .split(' ')
      .filter(word => word.length > 1 && !stopWords.has(word));
  } else {
    // Sinhala: no stopword removal for now
    return normalizeText(text, lang)
      .split(' ')
      .filter(word => word.length > 0);
  }
}


function findBestMatch(userMessage: string, lang: 'en' | 'si' | 'singlish'): QAEntry | null {
  const dataset = loadDataset(lang);
  if (dataset.length === 0) return null;

  const normalized = normalizeText(userMessage, lang);
  const tokens = tokenize(userMessage, lang);

  let bestMatch: QAEntry | null = null;
  let bestScore = 0;

  for (const entry of dataset) {
    let score = 0;

    // 1. Keyword matching (highest weight)
    for (const keyword of entry.keywords) {
      const kw = (lang === 'en' || lang === 'singlish') ? keyword.toLowerCase() : keyword;
      if (normalized.includes(kw)) {
        score += 3;
      } else {
        const kwParts = kw.split(/\s+/);
        const matchedParts = kwParts.filter(part => normalized.includes(part));
        if (matchedParts.length > 0) {
          score += (matchedParts.length / kwParts.length) * 1.5;
        }
      }
    }

    // 2. Question similarity (token overlap)
    const questionTokens = tokenize(entry.question, lang);
    const overlap = tokens.filter(t => questionTokens.includes(t)).length;
    if (questionTokens.length > 0) {
      score += (overlap / questionTokens.length) * 2;
    }

    // 3. Category boost for common intents (English and Singlish only)
    if ((lang === 'en' || lang === 'singlish')) {
      if (entry.category === 'general' && (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('hey') || normalized.includes('ayubowang'))) {
        if (entry.keywords.some(k => normalized.includes(k.toLowerCase()))) {
          score += 2;
        }
      }
      if (entry.category === 'general' && (normalized.includes('thank') || normalized.includes('thanks') || normalized.includes('shukriya') || normalized.includes('obliga'))) {
        if (entry.keywords.some(k => normalized.includes(k.toLowerCase()))) {
          score += 2;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  return bestScore >= 1.5 ? bestMatch : null;
}

// ─── Fallback Response ──────────────────────────────────────────────────────

function getFallbackResponse(lang: 'en' | 'si' | 'singlish'): string {
  if (lang === 'si') {
    return (
      "කණගාටුයි, ඔබේ ප්‍රශ්නයට නිශ්චිත පිළිතුරක් සොයාගත නොහැකි විය. මෙන්න මට උදව් කළ හැකි කරුණු කිහිපයක්:\n\n" +
      "• **රුධිරය දායක සුදුසුකම්** — \"මට රුධිරය දායක වීමට පුළුවන්ද?\"\n" +
      "• **රුධිර වර්ග** — \"රුධිර වර්ග මොනවාද?\"\n" +
      "• **දායක ක්‍රියාවලිය** — \"දෙන්නෙ කොහොමද?\"\n" +
      "• **කාලසටහන්** — \"කාලසටහනක් වෙන් කරගන්නෙ කොහොමද?\"\n" +
      "• **SmartBlood විශේෂාංග** — \"SmartBlood කියන්නේ මොකද්ද?\"\n" +
      "• **හදිසි ඉල්ලීම්** — \"හදිසි රුධිර ඉල්ලීම් ක්‍රියාත්මක වන්නේ කෙසේද?\"\n\n" +
      "කරුණාකර ඔබේ ප්‍රශ්නය වෙනස් කර නැවත උත්සාහ කරන්න!"
    );
  }
  if (lang === 'singlish') {
    return (
      "Sorry, me specific answer find karanaw nahi. Here are things me help karanaw:\n\n" +
      "• **Blood donation eligibility** — \"Matte blood donate karanawa puluwanada?\"\n" +
      "• **Blood types** — \"Blood types mokada ata?\"\n" +
      "• **Donation process** — \"Blood donate karanaw kohomat?\"\n" +
      "• **Appointments** — \"Appointment kohomat book karanaw?\"\n" +
      "• **Campaigns** — \"SmartBlood features mokada?\"\n" +
      "• **SmartBlood about** — \"SmartBlood mokada?\"\n" +
      "• **Emergency requests** — \"Emergency blood dispatch kohomat work karanaw?\"\n\n" +
      "Please rephrase your question or pick one of the suggestions above!"
    );
  }
  return (
    "I'm sorry, I couldn't find a specific answer to your question. Here are some things I can help you with:\n\n" +
    "• **Blood donation eligibility** — \"Am I eligible to donate?\"\n" +
    "• **Blood types** — \"What are the blood types?\"\n" +
    "• **Donation process** — \"How to prepare for donation?\"\n" +
    "• **Appointments** — \"How do I book an appointment?\"\n" +
    "• **Campaigns** — \"What campaigns are available?\"\n" +
    "• **SmartBlood features** — \"What is SmartBlood?\"\n" +
    "• **Emergency requests** — \"How does emergency dispatch work?\"\n\n" +
    "Try rephrasing your question, or pick one of the suggestions above!"
  );
}

// ─── API Route ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;
    const message = body.message?.trim();

    // Validation: empty message
    if (!message || message.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message cannot be empty',
          reply: {
            en: 'Please type a message so I can help you!',
            si: 'කරුණාකර ප්‍රශ්නයක් ටයිප් කරන්න!'
          }
        },
        { status: 400 }
      );
    }

    // Validation: message too long
    if (message.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: 'Message exceeds maximum length of 1000 characters',
          reply: {
            en: 'Your message is too long. Please keep it under 1000 characters.',
            si: 'ඔබේ පණිවිඩය දිග වැඩියි. කරුණාකර අකුරු 1000ට අඩුව තබන්න.'
          }
        },
        { status: 400 }
      );
    }

    const lang = detectLanguage(message);
    const match = findBestMatch(message, lang);

    if (match) {
      logger.info('Chatbot match found', {
        userMessage: message.substring(0, 100),
        matchedId: match.id,
        category: match.category,
        lang,
      });
      return NextResponse.json({ success: true, reply: match.answer }, { status: 200 });
    }

    logger.info('Chatbot no match', {
      userMessage: message.substring(0, 100),
      lang,
    });
    // Return fallback response (still 200 because this is normal behavior)
    return NextResponse.json({ success: true, reply: getFallbackResponse(lang) }, { status: 200 });
  } catch (error) {
    logger.error('Chatbot API error', { error: (error as Error).message });
    
    // Parse JSON error specifically
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        reply: {
          en: "Sorry, something went wrong on our end. Please try again later.",
          si: "සමාවෙන්න, යම් දෝෂයක් සිදු විය. කරුණාකර නැවත උත්සාහ කරන්න."
        }
      },
      { status: 500 }
    );
  }
}
