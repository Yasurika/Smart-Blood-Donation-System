"""
SmartBlood Chatbot Core Engine — Multi-Language AI Assistant
==============================================================

ARCHITECTURE OVERVIEW:
- Layer 1: Language Detection & Normalization
- Layer 2: Query Understanding & Tokenization  
- Layer 3: Semantic Matching (Keywords + Token Similarity)
- Layer 4: Response Selection & Generation

EASY TO UNDERSTAND FOR ANY DEVELOPER:
- Simple class-based design
- Clear method names (what they do is obvious)
- Detailed comments explaining logic
- No complex mathematics or ML libraries
- Pure Python (JSON + string processing)

Author: SmartBlood Development
License: MIT
"""

import json
import os
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: TYPE DEFINITIONS - Easy to understand what data looks like
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class QAEntry:
    """Represents a single Question-Answer pair from the dataset"""
    id: int
    category: str
    keywords: List[str]
    question: str
    answer: str


@dataclass
class ChatResponse:
    """Response returned to the user"""
    answer: str
    confidence: float  # 0.0 to 1.0 - how sure we are about this answer
    matched_question: str  # The question we matched to
    category: str  # Which category (eligibility, health, etc)
    language: str  # Which language we detected


@dataclass
class MatchScore:
    """Details about how well we matched a question"""
    entry_id: int
    entry_question: str
    keyword_score: float  # How many keywords matched
    token_score: float  # How many word tokens matched
    total_score: float  # Overall score (keyword_score + token_score)


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: LANGUAGE DETECTION - Identify which language the user is using
# ═══════════════════════════════════════════════════════════════════════════════

class LanguageDetector:
    """
    Detects if user is speaking English, Sinhala, or Singlish.
    
    Sinhala uses Unicode range 0D80-0DFF (if you see special characters).
    Singlish has typical Sri Lankan English patterns (ayubowang, mokada, etc).
    Otherwise it's English.
    """

    @staticmethod
    def detect(text: str) -> str:
        """
        Detect language from user input.
        Returns: 'en' (English), 'si' (Sinhala), or 'singlish' (Mixed)
        """
        
        # Check 1: Does it contain Sinhala Unicode characters?
        sinhala_unicode_in_use = any('\u0D80' <= char <= '\u0DFF' for char in text)
        if sinhala_unicode_in_use:
            return 'si'  # It's Sinhala

        # Check 2: Look for common Singlish words used in Sri Lanka
        singlish_keywords = {
            'ayubowang', 'mokada', 'kohomat', 'puluwan', 'dena', 'laganda',
            'hadala', 'yadda', 'hariyata', 'matte', 'donata', 'rohuladai',
            'vidhanaya', 'please', 'matte', 'ardam', 'karanna', 'sudusuwa',
        }
        user_text_lower = text.lower()
        singlish_count = sum(1 for kw in singlish_keywords if kw in user_text_lower)
        
        if singlish_count >= 1:  # Found at least one Singlish word
            return 'singlish'

        # Check 3: If nothing above matched, it's English
        return 'en'


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: TEXT NORMALIZATION - Clean and standardize text for matching
# ═══════════════════════════════════════════════════════════════════════════════

class TextNormalizer:
    """
    Prepares text for comparison.
    
    English: Remove punctuation, convert to lowercase
    Sinhala: Remove punctuation, keep original case (Sinhala doesn't have case)
    """

    @staticmethod
    def normalize(text: str, language: str) -> str:
        """Clean up text while preserving meaning"""
        
        if language == 'si':
            # For Sinhala: Remove punctuation and extra spaces, keep characters
            # Remove common punctuation marks but keep Sinhala characters
            cleaned = text.replace('?', '').replace('!', '').replace('.', '')
            cleaned = cleaned.replace(',', '').replace(';', '').replace(':', '')
            # Remove extra whitespace
            cleaned = ' '.join(cleaned.split())
            return cleaned.strip()
        else:
            # For English and Singlish: lowercase and remove punctuation
            text = text.lower()
            # Remove punctuation
            text = text.replace('?', '').replace('!', '').replace('.', '')
            text = text.replace(',', '').replace(';', '').replace(':', '')
            text = text.replace("'", '').replace('"', '')
            # Remove extra whitespace
            text = ' '.join(text.split())
            return text.strip()


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: TOKENIZATION - Break text into individual words for matching
# ═══════════════════════════════════════════════════════════════════════════════

class Tokenizer:
    """
    Breaks text into words (tokens).
    For English: removes common words like "the", "a", "is" that don't help matching.
    For Sinhala: keeps all words (no stopword list available).
    """

    # English stopwords - common words that don't add meaning
    ENGLISH_STOPWORDS = {
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'can', 'shall', 'i', 'me', 'my', 'we',
        'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them', 'this',
        'that', 'what', 'which', 'who', 'whom', 'how', 'when', 'where',
        'why', 'if', 'then', 'so', 'but', 'and', 'or', 'not', 'no', 'yes',
        'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from', 'as',
        'into', 'about', 'up', 'out', 'just', 'also', 'very', 'too',
    }

    @staticmethod
    def tokenize(text: str, language: str) -> List[str]:
        """
        Break text into words and filter out unhelpful words.
        Returns: List of useful words (tokens)
        """
        
        # Split text into words
        tokens = text.split()

        if language in ('en', 'singlish'):
            # For English: Remove short words and stopwords
            tokens = [
                t for t in tokens 
                if len(t) > 1 and t not in Tokenizer.ENGLISH_STOPWORDS
            ]
        else:
            # For Sinhala: Just remove very short tokens
            tokens = [t for t in tokens if len(t) > 0]

        return tokens


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: KEYWORD MATCHER - Check if user's words match dataset keywords
# ═══════════════════════════════════════════════════════════════════════════════

class KeywordMatcher:
    """
    Compares user's message against dataset keywords.
    
    Example:
    - Dataset has keywords: ["donate", "blood", "eligible"]
    - User says: "Can I donate blood?"
    - This finds matches for "donate" and "blood"
    """

    @staticmethod
    def match_keywords(
        normalized_user_input: str,
        entry_keywords: List[str],
        language: str
    ) -> float:
        """
        Check how well user input matches the keywords in a dataset entry.
        Returns: Score (0-3 = best match, 0 = no match)
        """
        
        score = 0.0

        for keyword in entry_keywords:
            # Normalize the keyword the same way we normalized user input
            if language == 'si':
                keyword_normalized = keyword
            else:
                keyword_normalized = keyword.lower()

            # Check if keyword appears in user input
            if keyword_normalized in normalized_user_input:
                # Full keyword match - great!
                score += 3.0
            else:
                # Maybe the keyword is split across words?
                # For example: user said "blood test" and keyword is "blood"
                keyword_parts = keyword_normalized.split()
                matching_parts = sum(
                    1 for part in keyword_parts 
                    if part in normalized_user_input
                )
                
                if matching_parts > 0:
                    # Partial match - give partial credit
                    partial_match_ratio = matching_parts / len(keyword_parts)
                    score += partial_match_ratio * 1.5

        return score


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: TOKEN SIMILARITY MATCHER - Check if user's words match question words
# ═══════════════════════════════════════════════════════════════════════════════

class TokenMatcher:
    """
    Compares user's words with words in the reference question.
    
    Example:
    - Dataset question: "Can I donate after pregnancy?"
    - User asks: "When can I donate after having a baby?"
    - Both contain words like "donate" and "pregnancy/baby" concepts
    """

    @staticmethod
    def calculate_token_overlap(
        user_tokens: List[str],
        question_tokens: List[str]
    ) -> float:
        """
        Count how many words from the user's question appear in dataset question.
        Returns: Score (0-2 = best match, 0 = no match)
        """
        
        if len(question_tokens) == 0:
            return 0.0

        # Count matching tokens
        matching_count = sum(
            1 for user_token in user_tokens 
            if user_token in question_tokens
        )

        # Calculate percentage of overlap
        overlap_ratio = matching_count / len(question_tokens)

        # Convert to score (0-2 range)
        return overlap_ratio * 2.0


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: MAIN MATCHER - Combines all matching strategies
# ═══════════════════════════════════════════════════════════════════════════════

class SmartMatcher:
    """
    Finds the best matching answer from the dataset.
    
    Uses THREE strategies:
    1. Keyword matching (most important)
    2. Token/word overlap (second)
    3. Returns a confidence score
    """

    def __init__(self):
        self.language_detector = LanguageDetector()
        self.text_normalizer = TextNormalizer()
        self.tokenizer = Tokenizer()
        self.keyword_matcher = KeywordMatcher()
        self.token_matcher = TokenMatcher()

    def find_best_match(
        self,
        user_message: str,
        dataset: List[QAEntry],
        language: str
    ) -> Optional[QAEntry]:
        """
        Search through dataset and find the best matching Q&A entry.
        Returns: QAEntry if found, None if no good match.
        """
        
        if not dataset:
            return None

        # Step 1: Normalize user input
        normalized = self.text_normalizer.normalize(user_message, language)
        user_tokens = self.tokenizer.tokenize(normalized, language)

        # Step 2: Score each entry in the dataset
        best_entry = None
        best_score = 0.0

        for entry in dataset:
            # Calculate keyword score (0-3)
            keyword_score = self.keyword_matcher.match_keywords(
                normalized, entry.keywords, language
            )

            # Calculate token score (0-2)
            entry_question_normalized = self.text_normalizer.normalize(
                entry.question, language
            )
            entry_tokens = self.tokenizer.tokenize(
                entry_question_normalized, language
            )
            token_score = self.token_matcher.calculate_token_overlap(
                user_tokens, entry_tokens
            )

            # Total score (0-5)
            total_score = keyword_score + token_score

            # Keep track of best match
            if total_score > best_score:
                best_score = total_score
                best_entry = entry

        # Only return match if we're confident enough (score >= 1.5)
        if best_score >= 1.5:
            return best_entry

        return None


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: CHATBOT ENGINE - Main AI Chatbot
# ═══════════════════════════════════════════════════════════════════════════════

class SmartBloodChatBot:
    """
    Main intelligent chatbot engine.
    
    How it works:
    1. User sends a message
    2. Detect what language they're using
    3. Load the correct dataset (English, Sinhala, or Singlish)
    4. Find the best matching Q&A pair
    5. Return the answer with confidence score
    """

    def __init__(self, dataset_dir: str = 'dataset'):
        """Initialize chatbot with dataset directory"""
        self.dataset_dir = dataset_dir
        self.dataset_cache: Dict[str, List[QAEntry]] = {}  # Cache for performance
        self.matcher = SmartMatcher()
        self.language_detector = LanguageDetector()

    def load_dataset(self, language: str) -> List[QAEntry]:
        """
        Load Q&A dataset from JSON file.
        Datasets are stored as:
        - dataset/blood_donation_qa_en.json (English)
        - dataset/blood_donation_qa_si.json (Sinhala)
        - dataset/blood_donation_qa_singlish.json (Singlish)
        """
        
        # Return cached version if already loaded
        if language in self.dataset_cache:
            return self.dataset_cache[language]

        # Map language code to filename
        lang_files = {
            'en': 'blood_donation_qa_en.json',
            'si': 'blood_donation_qa_si.json',
            'singlish': 'blood_donation_qa_singlish.json',
        }

        filename = lang_files.get(language, 'blood_donation_qa_en.json')
        filepath = os.path.join(self.dataset_dir, filename)

        try:
            # Read and parse JSON file
            with open(filepath, 'r', encoding='utf-8') as f:
                json_data = json.load(f)

            # Convert to QAEntry objects
            entries = [
                QAEntry(
                    id=item['id'],
                    category=item['category'],
                    keywords=item['keywords'],
                    question=item['question'],
                    answer=item['answer'],
                )
                for item in json_data
            ]

            # Cache for next time
            self.dataset_cache[language] = entries
            return entries

        except Exception as e:
            print(f"ERROR loading dataset for {language}: {str(e)}")
            return []

    def get_fallback_response(self, language: str) -> str:
        """
        When we can't find a matching answer, give user some suggestions.
        """
        fallbacks = {
            'si': (
                "කණගාටුයි, ඔබේ ප්‍රශ්නයට නිශ්චිත පිළිතුරක් සොයාගත නොහැකි විය. "
                "කරුණාකර වෙනස් ප්‍රශ්නයක් තබන්න හෝ මෙයින් වටහා ගන්න:\n\n"
                "• දෙන්න ගිය පෙර සිතුම්කිරීම\n"
                "• දෙන්න පසු සිතුම්කිරීම\n"
                "• ගර්භණුවේ සිටින අයලුන්\n"
                "• SmartBlood ගැන"
            ),
            'singlish': (
                "Sorry, me specific answer find karanaw nahi. Ayubowang "
                "rephrase karanna:\n\n"
                "• Preparation guide\n"
                "• Recovery information\n"
                "• Pregnancy details\n"
                "• SmartBlood features"
            ),
            'en': (
                "I'm sorry, I couldn't find a specific answer to your question. "
                "You can try:\n\n"
                "• Asking about preparation before donation\n"
                "• Asking about recovery after donation\n"
                "• Asking about pregnancy and donation\n"
                "• Asking what SmartBlood does"
            ),
        }
        return fallbacks.get(language, fallbacks['en'])

    def chat(self, user_message: str) -> ChatResponse:
        """
        Main chatbot method - process user input and return response.
        
        Args:
            user_message: What the user typed
            
        Returns:
            ChatResponse with answer, confidence, and metadata
        """
        
        # Step 1: Detect language
        language = self.language_detector.detect(user_message)

        # Step 2: Load appropriate dataset
        dataset = self.load_dataset(language)

        # Step 3: Find best matching Q&A
        matched_entry = self.matcher.find_best_match(
            user_message, dataset, language
        )

        # Step 4: Build response
        if matched_entry:
            # We found a good match!
            return ChatResponse(
                answer=matched_entry.answer,
                confidence=0.85,  # Reasonable confidence for keyword-based matching
                matched_question=matched_entry.question,
                category=matched_entry.category,
                language=language,
            )
        else:
            # No good match - give helpful fallback
            return ChatResponse(
                answer=self.get_fallback_response(language),
                confidence=0.0,  # Low confidence - we're guessing
                matched_question="",
                category="unknown",
                language=language,
            )


# ═══════════════════════════════════════════════════════════════════════════════
# QUICK TEST - Run this to see the chatbot in action
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("=" * 70)
    print("SmartBlood Chatbot - Quick Test")
    print("=" * 70)

    # Initialize chatbot
    chatbot = SmartBloodChatBot()

    # Test with sample questions
    test_questions = [
        "Can I donate blood if I have diabetes?",
        "ගර්භණුවේ සිටින්නෙ නම් ලේ දෙන්න පුළුවන්ද?",
        "What is SmartBlood?",
        "Blood donate karenna passe kumak sithanna ayubowang?",
    ]

    for question in test_questions:
        print(f"\nUser: {question}")
        response = chatbot.chat(question)
        print(f"Bot [{response.language}]: {response.answer[:100]}...")
        print(f"Confidence: {response.confidence * 100:.0f}%")
