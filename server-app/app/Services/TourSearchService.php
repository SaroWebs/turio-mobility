<?php

namespace App\Services;

use App\Models\Tour;
use App\Models\TourBookingReview;
use App\Models\TourSchedule;
use Carbon\Carbon;
use Closure;
use Illuminate\Database\Eloquent\Builder;

class TourSearchService
{
    /**
     * Departure filtering closure based on search criteria.
     */
    public function departureScope(array $filters): Closure
    {
        return function ($query) use ($filters) {
            $query->bookable((int) ($filters['guests'] ?? 1));
            if (! empty($filters['date'])) {
                $query->whereDate('departure_date', $filters['date']);
            } elseif (! empty($filters['month'])) {
                $start = Carbon::createFromFormat('!Y-m', $filters['month']);
                $query->where('departure_date', '>=', $start)->where('departure_date', '<', $start->copy()->addMonth());
            }
        };
    }

    /**
     * Build the query for tour search with instant-based departure ordering.
     */
    public function query(array $filters): Builder
    {
        $departureFilter = $this->departureScope($filters);

        $nextSubquery = TourSchedule::query()
            ->selectRaw('MIN(COALESCE(departure_at, departure_date))')
            ->whereColumn('tour_id', 'tours.id');
        $departureFilter($nextSubquery);

        $nextSchedule = TourSchedule::query()->whereColumn('tour_id', 'tours.id');
        $departureFilter($nextSchedule);
        $nextSchedule->orderByRaw('COALESCE(departure_at, departure_date) ASC')->orderBy('id')->limit(1);
        $seats = (clone $nextSchedule)->selectRaw('total_seats - booked_seats - reserved_seats');
        $price = (clone $nextSchedule)->selectRaw('COALESCE(price_override, tours.price_per_person)');
        $rating = TourBookingReview::query()->selectRaw('AVG(tour_rating)')
            ->join('tour_bookings', 'tour_bookings.id', '=', 'tour_booking_reviews.tour_booking_id')
            ->whereColumn('tour_bookings.tour_id', 'tours.id');

        $query = Tour::query()
            ->select('tours.*')
            ->selectSub($nextSubquery, 'next_departure_at')
            ->selectSub($seats, 'next_available_seats')
            ->selectSub($price, 'next_price')
            ->selectSub($rating, 'rating')
            ->bookableForGuests((int) ($filters['guests'] ?? 1))
            ->whereHas('schedules', $departureFilter)
            ->with([
                'category',
                'schedules' => function ($q) use ($departureFilter) {
                    $departureFilter($q);
                    $q->reorder()->orderByRaw('COALESCE(departure_at, departure_date) ASC')->orderBy('id', 'ASC');
                },
            ]);

        if ($search = trim($filters['q'] ?? '')) {
            $query->where(fn ($q) => $q->where('title', 'like', '%'.$search.'%')
                ->orWhere('region', 'like', '%'.$search.'%')
                ->orWhere('start_location', 'like', '%'.$search.'%')
                ->orWhere('end_location', 'like', '%'.$search.'%')
                ->orWhereHas('itineraries.place', fn ($place) => $place->where('is_active', true)
                    ->where(fn ($names) => $names->where('name', 'like', '%'.$search.'%')
                        ->orWhere('city', 'like', '%'.$search.'%')->orWhere('state', 'like', '%'.$search.'%'))));
        }
        if (! empty($filters['destination_id'])) {
            $query->whereHas('itineraries.place', fn ($place) => $place->whereKey($filters['destination_id'])->where('is_active', true));
        }
        if (isset($filters['min_rating'])) {
            $query->whereRaw('('.$rating->toSql().') >= CAST(? AS DECIMAL(10, 2))', [...$rating->getBindings(), $filters['min_rating']]);
        }
        match ($filters['price_range'] ?? 'all') {
            'under_5k' => $query->where((clone $price), '<', 5000),
            '5k_to_15k' => $query->where((clone $price), '>=', 5000)->where((clone $price), '<=', 15000),
            'above_15k' => $query->where((clone $price), '>', 15000),
            default => null,
        };
        match ($filters['duration'] ?? 'all') {
            'day_trip' => $query->where('duration_days', '<=', 1),
            '2_3_days' => $query->whereBetween('duration_days', [2, 3]),
            '4_plus_days' => $query->where('duration_days', '>=', 4),
            default => null,
        };
        if (! empty($filters['category']) && $filters['category'] !== 'All') {
            $query->whereHas('category', fn ($q) => $q->where('name', $filters['category']));
        }
        if (! empty($filters['difficulty'])) {
            $query->where('difficulty', $filters['difficulty']);
        }

        match ($filters['sort'] ?? null) {
            'availability' => $query->orderByDesc('next_available_seats')->orderBy('next_departure_at', 'ASC'),
            'price_asc' => $query->orderBy('next_price')->orderBy('next_departure_at', 'ASC')->orderByDesc('next_available_seats'),
            'price_desc' => $query->orderByDesc('next_price')->orderBy('next_departure_at', 'ASC')->orderByDesc('next_available_seats'),
            'duration' => $query->orderBy('duration_days')->orderBy('next_departure_at', 'ASC')->orderByDesc('next_available_seats'),
            default => $query->orderBy('next_departure_at', 'ASC')->orderByDesc('next_available_seats'),
        };

        return $query->orderBy('tours.id', 'ASC');
    }

    /**
     * Opt-in keyset cursor pagination over deterministic departure/tour ordering.
     *
     * @return array{items: \Illuminate\Database\Eloquent\Collection, has_more: bool, next_cursor: ?string, per_page: int}
     */
    public function paginateCursor(array $filters, int $perPage = 20, ?string $cursor = null): array
    {
        $departureFilter = $this->departureScope($filters);
        $nextSubquery = TourSchedule::query()
            ->selectRaw('MIN(COALESCE(departure_at, departure_date))')
            ->whereColumn('tour_id', 'tours.id');
        $departureFilter($nextSubquery);

        // Existing cursors encode departure + ID, so keep that exact ordering.
        $query = $this->query($filters)->reorder()->orderBy('next_departure_at')->orderBy('tours.id');

        if (! empty($cursor)) {
            $decoded = $this->decodeCursor($cursor);
            if ($decoded) {
                $cursorD = (string) $decoded['d'];
                $cursorId = (int) $decoded['id'];

                $subSql = '('.$nextSubquery->toSql().')';
                $bindings = $nextSubquery->getBindings();

                $query->where(function ($w) use ($subSql, $bindings, $cursorD, $cursorId) {
                    $w->whereRaw("{$subSql} > ?", array_merge($bindings, [$cursorD]))
                        ->orWhere(function ($w2) use ($subSql, $bindings, $cursorD, $cursorId) {
                            $w2->whereRaw("{$subSql} = ?", array_merge($bindings, [$cursorD]))
                                ->where('tours.id', '>', $cursorId);
                        });
                });
            }
        }

        // Fetch one extra item to accurately detect if more pages exist without a separate count query
        $results = $query->take($perPage + 1)->get();

        $hasMore = $results->count() > $perPage;
        $items = $hasMore ? $results->slice(0, $perPage)->values() : $results->values();

        $nextCursor = null;
        if ($hasMore && $items->isNotEmpty()) {
            $lastItem = $items->last();
            $nextCursor = $this->encodeCursor((string) $lastItem->next_departure_at, (int) $lastItem->id);
        }

        return [
            'items' => $items,
            'has_more' => $hasMore,
            'next_cursor' => $nextCursor,
            'per_page' => $perPage,
        ];
    }

    /**
     * Encode a cursor based on the instant departure and tour ID.
     */
    public function encodeCursor(string $departureAt, int $id): string
    {
        return rtrim(strtr(base64_encode(json_encode(['d' => $departureAt, 'id' => $id])), '+/', '-_'), '=');
    }

    /**
     * Decode a cursor string into its components.
     *
     * @return array{d: string, id: int}|null
     */
    public function decodeCursor(string $cursor): ?array
    {
        $decoded = base64_decode(strtr($cursor, '-_', '+/'), true);
        if (! $decoded) {
            return null;
        }
        $data = json_decode($decoded, true);
        if (! is_array($data) || ! isset($data['d'], $data['id'])) {
            return null;
        }

        return [
            'd' => (string) $data['d'],
            'id' => (int) $data['id'],
        ];
    }
}
