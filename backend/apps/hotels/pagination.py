"""Pagination for hotel list (search results)."""

from rest_framework.pagination import PageNumberPagination


class HotelSearchPagination(PageNumberPagination):
    """Allow larger pages for the search results UI."""

    page_size = 24
    page_size_query_param = 'page_size'
    max_page_size = 500
