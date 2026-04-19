"""Tool functions available to the chatbot agent."""

from django.db.models import Avg, Count, Min, Q

from apps.hotels.models import Hotel


# ── Tool: search our hotel DB ─────────────────────────────────────────────────

def search_hotels(city=None, budget_min=None, budget_max=None,
                  rating_min=None, limit=5):
    qs = (
        Hotel.objects
        .select_related('city', 'city__country')
        .annotate(
            min_price=Min('rooms__price'),
            review_count=Count('reviews'),
        )
    )
    if city:
        qs = qs.filter(
            Q(city__name__icontains=city)
            | Q(city__country__name__icontains=city)
        )
    if budget_min is not None:
        qs = qs.filter(min_price__gte=budget_min)
    if budget_max is not None:
        qs = qs.filter(min_price__lte=budget_max)
    if rating_min is not None:
        qs = qs.filter(rating__gte=rating_min)

    qs = qs.order_by('-rating')[:int(limit)]

    hotels = []
    for h in qs:
        hotels.append({
            'id': h.id,
            'name': h.name,
            'city': h.city.name,
            'country': h.city.country.name,
            'rating': float(h.rating),
            'review_count': h.review_count,
            'price_per_night': float(h.min_price) if h.min_price else None,
            'address': h.address_line or None,
        })

    return {
        'hotels': hotels,
        'total_found': len(hotels),
        'filters_applied': {
            'city': city,
            'budget_min': budget_min,
            'budget_max': budget_max,
            'rating_min': rating_min,
        },
    }


# ── Tool: web search via DuckDuckGo ──────────────────────────────────────────

def search_web(query):
    try:
        from duckduckgo_search import DDGS
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=6))
        return {
            'results': [
                {'title': r['title'], 'snippet': r['body'], 'url': r['href']}
                for r in raw
            ],
        }
    except ImportError:
        return {'error': 'duckduckgo-search package not installed on server.'}
    except Exception as e:
        return {'error': f'Web search failed: {e}'}


# ── Tool registry ─────────────────────────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        'type': 'function',
        'function': {
            'name': 'search_hotels',
            'description': (
                'Search STAYEazy hotel database by city, nightly budget, and minimum '
                'rating. Always use this when the user asks for hotel recommendations '
                'or wants to know what hotels are available.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'city': {
                        'type': 'string',
                        'description': 'City or region name (e.g. "Mumbai", "Goa")',
                    },
                    'budget_min': {
                        'type': 'number',
                        'description': 'Minimum price per night in INR',
                    },
                    'budget_max': {
                        'type': 'number',
                        'description': 'Maximum price per night in INR',
                    },
                    'rating_min': {
                        'type': 'number',
                        'description': 'Minimum hotel rating between 0 and 5',
                    },
                    'limit': {
                        'type': 'integer',
                        'description': 'Max results to return (default 5, max 10)',
                    },
                },
            },
        },
    },
    {
        'type': 'function',
        'function': {
            'name': 'search_web',
            'description': (
                'Search the internet for current travel information: attractions, '
                'restaurants, local transport, visa rules, weather, events, '
                'or anything not in the hotel database.'
            ),
            'parameters': {
                'type': 'object',
                'properties': {
                    'query': {
                        'type': 'string',
                        'description': 'Specific search query',
                    },
                },
                'required': ['query'],
            },
        },
    },
]


def execute_tool(name: str, args: dict) -> dict:
    if name == 'search_hotels':
        return search_hotels(**{k: v for k, v in args.items()
                                if k in ('city', 'budget_min', 'budget_max',
                                         'rating_min', 'limit')})
    if name == 'search_web':
        return search_web(query=args.get('query', ''))
    return {'error': f'Unknown tool: {name}'}
