"""Chatbot API — SSE streaming, proactive hotel search, ChatGPT proxy."""

import json
import re

import requests
from django.http import StreamingHttpResponse
from rest_framework import permissions
from rest_framework.views import APIView

from .tools import execute_tool

CHATGPT_URL = 'http://192.168.1.3:5678/api/chat'
CHAT_TIMEOUT = 60

SYSTEM_PROMPT = """\
You are the STAYEazy travel assistant. You ONLY answer questions about:
- Hotels, stays, and accommodation
- Travel destinations, trip itineraries, transport, weather,
  local food, attractions
- Booking, pricing, or property-related enquiries on STAYEazy

STRICT RULES:
1. If the user asks about anything unrelated to travel, hotels, or
   trip planning — reply with exactly:
   "I can only help with travel and hotel-related questions. Ask me
   about destinations, hotels, or trip planning!"
   Do NOT attempt to answer off-topic questions under any circumstances.
2. Never invent hotel names, prices, or ratings. Use only hotel data
   explicitly provided to you in [Context].
3. When listing hotels always include: name as **[Name](hotel:ID)**,
   city, rating, and price per night.
4. For itineraries provide a day-by-day plan with estimated costs in INR.
5. Be concise. Use bullet points. Keep answers under 400 words unless
   planning a multi-day trip.
6. Never discuss politics, coding, relationships, health, finance,
   or any non-travel topic.
"""

# City names to detect hotel search intent
_CITY_PATTERN = re.compile(
    r'\b(goa|mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|kolkata|'
    r'jaipur|udaipur|manali|shimla|darjeeling|ooty|kerala|agra|varanasi|'
    r'rishikesh|mussoorie|coorg|kashmir|ladakh|pune|ahmedabad|surat|'
    r'kochi|thiruvananthapuram|indore|bhopal|lucknow|chandigarh|amritsar)\b',
    re.IGNORECASE,
)

_HOTEL_KEYWORDS = {
    'hotel', 'stay', 'room', 'accommodation', 'resort',
    'hostel', 'lodge', 'inn', 'book', 'where to stay',
}


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def _call_chatgpt(prompt: str) -> str:
    resp = requests.post(
        CHATGPT_URL,
        json={'prompt': prompt},
        timeout=CHAT_TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data.get('success', True):
        raise RuntimeError(data.get('error', 'Unknown error from AI service'))
    return data.get('response', '')


def _build_prompt(messages: list, hotel_context: str = '') -> str:
    lines = [SYSTEM_PROMPT]
    if hotel_context:
        lines.append(f'\n[Context — real hotel data for this query]\n{hotel_context}\n')
    lines.append('\n[Conversation]')
    for m in messages:
        role = m.get('role', 'user')
        content = m.get('content', '')
        if role == 'user':
            lines.append(f'User: {content}')
        elif role == 'assistant':
            lines.append(f'Assistant: {content}')
    lines.append('Assistant:')
    return '\n'.join(lines)


def _hotel_search_args(messages: list) -> dict | None:
    """Return search_hotels args if the latest user turn is hotel-related."""
    last = next(
        (m['content'] for m in reversed(messages) if m.get('role') == 'user'),
        '',
    )
    lower = last.lower()

    city_match = _CITY_PATTERN.search(lower)
    is_hotel_query = any(kw in lower for kw in _HOTEL_KEYWORDS)

    if not (city_match or is_hotel_query):
        return None

    args: dict = {'limit': 5}
    if city_match:
        args['city'] = city_match.group(0).title()

    budget = re.search(r'under\s*₹?\s*(\d[\d,]*)', lower)
    if budget:
        args['budget_max'] = int(budget.group(1).replace(',', ''))

    rating = re.search(r'(\d(?:\.\d)?)\s*star', lower)
    if rating:
        args['rating_min'] = float(rating.group(1))

    return args


def _chat_generator(user_messages: list):
    try:
        hotel_context = ''

        search_args = _hotel_search_args(user_messages)
        if search_args:
            yield _sse('tool_start', {'tool': 'search_hotels'})
            result = execute_tool('search_hotels', search_args)
            yield _sse('tool_done', {'tool': 'search_hotels'})
            hotels = result.get('hotels', [])
            if hotels:
                yield _sse('hotel_cards', {'hotels': hotels})
                hotel_context = json.dumps(hotels, ensure_ascii=False, indent=2)

        prompt = _build_prompt(user_messages, hotel_context)
        text = _call_chatgpt(prompt)

        if text:
            yield _sse('token', {'content': text})
        yield _sse('done', {})

    except requests.ConnectionError:
        yield _sse('error', {'message': 'AI service is not reachable. Check that the ChatGPT proxy is running on 192.168.1.3:5678.'})
    except requests.Timeout:
        yield _sse('error', {'message': 'AI service took too long to respond. Try again.'})
    except Exception as e:
        yield _sse('error', {'message': str(e)})


class ChatView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        messages = request.data.get('messages', [])
        if not messages:
            return StreamingHttpResponse(
                iter([_sse('error', {'message': 'No messages provided.'})]),
                content_type='text/event-stream',
            )

        resp = StreamingHttpResponse(
            _chat_generator(messages),
            content_type='text/event-stream',
        )
        resp['Cache-Control'] = 'no-cache'
        resp['X-Accel-Buffering'] = 'no'
        return resp
