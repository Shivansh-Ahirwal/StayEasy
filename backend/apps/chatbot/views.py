"""Chatbot API — streams SSE tokens, runs tool-calling loop with Ollama."""

import json

import requests
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework import permissions
from rest_framework.views import APIView

from .tools import TOOL_DEFINITIONS, execute_tool

OLLAMA_URL = getattr(settings, 'OLLAMA_URL', 'http://localhost:11434')
OLLAMA_MODEL = getattr(settings, 'OLLAMA_MODEL', 'llama3.2:3b')
MAX_TOOL_ROUNDS = 4

# Timeouts in seconds
TOOL_TIMEOUT = 150
STREAM_TIMEOUT = 180

# Keep responses fast and grounded on CPU
OLLAMA_OPTIONS = {
    'temperature': 0.2,
    'top_p': 0.85,
    'num_predict': 500,   # fewer tokens = faster
    'repeat_penalty': 1.1,
    'num_ctx': 2048,      # biggest speed lever on CPU
}

SYSTEM_PROMPT = """\
You are the STAYEazy travel assistant. You ONLY answer questions about:
- Hotels, stays, and accommodation (use search_hotels tool)
- Travel destinations, trip itineraries, transport, weather,
  local food, attractions (use search_web tool)
- Booking, pricing, or property-related enquiries on STAYEazy

STRICT RULES:
1. If the user asks about anything unrelated to travel, hotels, or
   trip planning — reply with exactly:
   "I can only help with travel and hotel-related questions. Ask me
   about destinations, hotels, or trip planning!"
   Do NOT attempt to answer off-topic questions under any circumstances.
2. Never invent hotel names, prices, or ratings. Always call
   search_hotels to get real data.
3. When listing hotels always include: name as **[Name](hotel:ID)**,
   city, rating, and price per night.
4. For itineraries provide a day-by-day plan with estimated costs
   in INR.
5. Be concise. Use bullet points. Keep answers under 400 words
   unless planning a multi-day trip.
6. Never discuss politics, coding, relationships, health, finance,
   or any non-travel topic.
"""


def _sse(event_type: str, data: dict) -> str:
    return f"data: {json.dumps({'type': event_type, **data})}\n\n"


def _ollama_post(
    messages: list,
    stream: bool,
    tools: list | None = None,
) -> requests.Response:
    payload = {
        'model': OLLAMA_MODEL,
        'messages': messages,
        'stream': stream,
        'options': OLLAMA_OPTIONS,
    }
    if tools:
        payload['tools'] = tools
    timeout = STREAM_TIMEOUT if stream else TOOL_TIMEOUT
    return requests.post(
        f'{OLLAMA_URL}/api/chat',
        json=payload,
        stream=stream,
        timeout=timeout,
    )


def _stream_final_reply(messages: list):
    """Generator: yields SSE token chunks from Ollama streaming."""
    try:
        resp = _ollama_post(messages, stream=True)
        resp.raise_for_status()
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                chunk = json.loads(line)
            except json.JSONDecodeError:
                continue
            token = chunk.get('message', {}).get('content', '')
            if token:
                yield _sse('token', {'content': token})
            if chunk.get('done'):
                yield _sse('done', {})
                return
    except requests.ConnectionError:
        yield _sse(
            'error',
            {'message': 'Ollama is not reachable. Run: ollama serve'},
        )
    except requests.Timeout:
        yield _sse(
            'error',
            {'message': 'Model took too long. Try a shorter question.'},
        )
    except Exception as e:
        yield _sse('error', {'message': str(e)})


def _chat_generator(user_messages: list):
    full_messages = (
        [{'role': 'system', 'content': SYSTEM_PROMPT}] + user_messages
    )

    try:
        # ── Tool-calling loop ──
        for _ in range(MAX_TOOL_ROUNDS):
            resp = _ollama_post(
                full_messages, stream=False, tools=TOOL_DEFINITIONS,
            )
            resp.raise_for_status()
            msg = resp.json().get('message', {})
            tool_calls = msg.get('tool_calls') or []

            if not tool_calls:
                break

            full_messages.append(msg)
            for tc in tool_calls:
                fn = tc.get('function', {})
                name = fn.get('name', '')
                args = fn.get('arguments', {})
                yield _sse('tool_start', {'tool': name})
                result = execute_tool(name, args)
                yield _sse('tool_done', {'tool': name})
                if name == 'search_hotels' and result.get('hotels'):
                    yield _sse('hotel_cards', {'hotels': result['hotels']})
                full_messages.append({
                    'role': 'tool',
                    'content': json.dumps(result, ensure_ascii=False),
                })

    except requests.ConnectionError:
        yield _sse(
            'error',
            {'message': 'Ollama is not reachable. Run: ollama serve'},
        )
        return
    except requests.Timeout:
        yield _sse(
            'error',
            {'message': (
                'Model timed out during tool use. '
                'Try a simpler question.'
            )},
        )
        return
    except Exception as e:
        yield _sse('error', {'message': str(e)})
        return

    # ── Streaming answer ──
    yield from _stream_final_reply(full_messages)


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
