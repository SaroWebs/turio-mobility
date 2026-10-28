<?php

namespace App\Services;

class SharedRidePlanner
{
    public function __construct(private PoolingRouter $router) {}

    public static function distance(array $a, array $b): float
    {
        $lat = deg2rad($b['lat'] - $a['lat']);
        $lng = deg2rad($b['lng'] - $a['lng']);
        $h = sin($lat / 2) ** 2 + cos(deg2rad($a['lat'])) * cos(deg2rad($b['lat'])) * sin($lng / 2) ** 2;

        return 6371000 * 2 * asin(sqrt(min(1, $h)));
    }

    /** Ordered polyline projection; ambiguous crossings fail closed. */
    public function project(array $point, array $geometry): ?array
    {
        $along = 0;
        $hits = [];
        for ($i = 1; $i < count($geometry); $i++) {
            $a = $geometry[$i - 1];
            $b = $geometry[$i];
            $length = self::distance($a, $b);
            if ($length < 1) {
                continue;
            }
            $scale = cos(deg2rad($point['lat']));
            $x = ($b['lng'] - $a['lng']) * $scale;
            $y = $b['lat'] - $a['lat'];
            $t = max(0, min(1, (($point['lng'] - $a['lng']) * $scale * $x + ($point['lat'] - $a['lat']) * $y) / ($x * $x + $y * $y)));
            $p = ['lat' => $a['lat'] + $t * ($b['lat'] - $a['lat']), 'lng' => $a['lng'] + $t * ($b['lng'] - $a['lng'])];
            $hits[] = ['along' => $along + $t * $length, 'offset' => self::distance($point, $p)];
            $along += $length;
        }
        if (! $hits) {
            return null;
        }
        usort($hits, fn ($a, $b) => $a['offset'] <=> $b['offset']);
        $best = $hits[0];
        foreach ($hits as $hit) {
            if ($hit['offset'] < $best['offset'] + 20 && abs($hit['along'] - $best['along']) > 150) {
                return null;
            }
        }

        return $best + ['total' => $along];
    }

    public function route(array $position, array $stops, int $now): ?array
    {
        $time = $now;
        $meters = 0;
        $geometry = [$position];
        $previous = $position;
        foreach ($stops as &$stop) {
            $leg = $this->router->leg($previous, $stop);
            if (! $leg) {
                return null;
            }
            $time += $leg['seconds'];
            $meters += $leg['meters'];
            $time = max($time, $stop['ready_at'] ?? 0);
            $stop['eta'] = $time;
            $stop['distance'] = $meters;
            $geometry = array_merge($geometry, array_slice($leg['geometry'], 1));
            $time += config('pooling.stop_seconds');
            $previous = $stop;
        }

        return ['stops' => $stops, 'geometry' => $geometry, 'ends_at' => $time, 'meters' => $meters];
    }

    public function capacity(array $stops, int $onboard, int $capacity): bool
    {
        if ($onboard > $capacity) {
            return false;
        }
        foreach ($stops as $stop) {
            $onboard += ($stop['type'] === 'pickup' ? 1 : -1) * $stop['seats'];
            if ($onboard < 0 || $onboard > $capacity) {
                return false;
            }
        }

        return $onboard === 0;
    }

    public function match(array $state, array $request, int $now): ?array
    {
        $car = $this->project($state['position'], $state['geometry']);
        $pickup = $this->project($request['pickup'], $state['geometry']);
        $drop = $this->project($request['dropoff'], $state['geometry']);
        if (! $car || ! $pickup || ! $drop || $car['offset'] > config('pooling.gps_max_accuracy_m')
            || $pickup['offset'] > config('pooling.corridor_m') || $pickup['along'] < $car['along'] + ($state['progress_buffer_m'] ?? 20)) {
            return null;
        }
        if (count($state['stops']) + 2 > config('pooling.max_stops')) {
            return null;
        }
        $lastPoint = $state['geometry'][count($state['geometry']) - 1];
        $extension = $drop['offset'] > config('pooling.corridor_m')
            || ($drop['along'] >= $drop['total'] - 10 && self::distance($request['dropoff'], $lastPoint) > 10);
        if ($extension) {
            if (! $state['allow_extension'] || $drop['along'] < $drop['total'] - config('pooling.corridor_m')) {
                return null;
            }
        } elseif ($drop['along'] <= $pickup['along'] + 20) {
            return null;
        }

        $p = $request['pickup'] + ['booking_id' => 'new', 'type' => 'pickup', 'seats' => $request['seats'], 'ready_at' => $request['ready_at'], 'latest' => $now + config('pooling.max_pickup_seconds')];
        $d = $request['dropoff'] + ['booking_id' => 'new', 'type' => 'dropoff', 'seats' => $request['seats']];
        $direct = $this->router->leg($p, $d);
        if (! $direct) {
            return null;
        }
        $best = null;
        $count = count($state['stops']);
        for ($i = 0; $i <= $count; $i++) {
            for ($j = $i + 1; $j <= $count + 1; $j++) {
                if ($extension && $j !== $count + 1) {
                    continue;
                }
                $stops = $state['stops'];
                array_splice($stops, $i, 0, [$p]);
                array_splice($stops, $j, 0, [$d]);
                // Preserve forward progress, including existing stops around the insertions.
                $progress = $car['along'];
                $forward = true;
                foreach ($stops as $stop) {
                    if ($extension && $stop['booking_id'] === 'new' && $stop['type'] === 'dropoff') {
                        continue;
                    }
                    $projection = $this->project($stop, $state['geometry']);
                    if (! $projection || $progress > $projection['along'] + 20) {
                        $forward = false;
                        break;
                    }
                    $progress = max($progress, $projection['along']);
                }
                if (! $forward) {
                    continue;
                }
                if (! $this->capacity($stops, $state['onboard'], $state['capacity'])) {
                    continue;
                }
                $plan = $this->route($state['position'], $stops, $now);
                if (! $plan) {
                    continue;
                }
                $valid = true;
                if ($plan['ends_at'] > $state['original_ends_at'] + config('pooling.max_delay_seconds') + config('pooling.max_extension_seconds')) {
                    $valid = false;
                }
                foreach ($plan['stops'] as $stop) {
                    if (isset($stop['latest']) && $stop['eta'] > $stop['latest']) {
                        $valid = false;
                    }
                }
                $pick = $plan['stops'][$i];
                $dest = $plan['stops'][$j];
                if ($pick['eta'] < $now + config('pooling.pickup_buffer_seconds')
                    || $dest['eta'] - $pick['eta'] > $direct['seconds'] + config('pooling.max_delay_seconds')) {
                    $valid = false;
                }
                // The original endpoint anchors cumulative extension limits across all joins.
                $last = $plan['stops'][count($plan['stops']) - 1];
                if (self::distance($state['original_destination'], $last) > 10) {
                    $tail = $this->router->leg($state['original_destination'], $last);
                    if (! $tail || $tail['meters'] > config('pooling.max_extension_m') || $tail['seconds'] > config('pooling.max_extension_seconds')) {
                        $valid = false;
                    }
                }
                if (! $valid) {
                    continue;
                }
                $plan['stops'][$j]['latest'] = $dest['eta'] + config('pooling.max_delay_seconds');
                $plan['score'] = ($pick['eta'] - $now) * 2 + ($plan['ends_at'] - $now);
                $plan['pickup_at'] = $pick['eta'];
                $plan['dropoff_at'] = $dest['eta'];
                $plan['distance_m'] = $dest['distance'] - $pick['distance'];
                $plan['extension'] = $extension;
                if (! $best || $plan['score'] < $best['score']) {
                    $best = $plan;
                }
            }
        }

        return $best;
    }
}
