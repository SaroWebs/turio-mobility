<?php

namespace App\Support\Settings;

/**
 * The single source of truth for every admin-configurable operational setting.
 *
 * Each entry declares:
 *   group       — UI grouping / tab
 *   label       — human label
 *   description — help text
 *   type        — int | float | percent | bool | string | enum
 *                 (percent is stored as a 0..1 fraction; the admin UI shows/enters it ×100)
 *   default     — value used when no override exists (mirrors the current hardcoded constant)
 *   unit        — display suffix (nullable)
 *   min/max     — validation bounds (numeric types)
 *   options     — allowed values (enum only)
 *   scopes      — which override levels are allowed: 'global', 'category', 'zone'
 *
 * Defaults intentionally equal today's hardcoded constants, so an empty settings
 * table reproduces current behaviour exactly.
 */
class SettingsCatalog
{
    public function all(): array
    {
        return [
            'ride.dispatch.window_minutes' => ['group' => 'ride_dispatch', 'label' => 'Scheduled dispatch lead time', 'description' => 'Release scheduled requests this many minutes before pickup.', 'type' => 'int', 'default' => 15, 'min' => 1, 'max' => 120, 'scopes' => ['global']],
            'ride.lifecycle.stale_assigned_seconds' => ['group' => 'ride_dispatch', 'label' => 'Abandoned pickup timeout', 'description' => 'Cancel assigned rides that have not started after this many seconds.', 'type' => 'int', 'default' => 7200, 'min' => 300, 'max' => 86400, 'scopes' => ['global']],
            'ride.lifecycle.stale_in_transit_seconds' => ['group' => 'ride_dispatch', 'label' => 'Long-running ride review threshold', 'description' => 'Flag trips for review without automatically releasing an occupied driver.', 'type' => 'int', 'default' => 86400, 'min' => 3600, 'max' => 604800, 'scopes' => ['global']],
            'tour.hold_minutes' => ['group' => 'tours', 'label' => 'Unpaid tour seat hold', 'description' => 'Release unpaid reservations after this many minutes.', 'type' => 'int', 'default' => 30, 'min' => 5, 'max' => 1440, 'scopes' => ['global']],
            'tracking.freshness_seconds' => ['group' => 'ride_dispatch', 'label' => 'Live GPS freshness', 'description' => 'Live GPS freshness. Paid, assigned and disputed bookings are protected.', 'type' => 'int', 'default' => 60, 'min' => 15, 'max' => 600, 'scopes' => ['global']],
            'ride.request.timeout_seconds' => ['group' => 'ride_dispatch', 'label' => 'Immediate request expiry', 'description' => 'Fixed ten-minute search deadline. Paid expired requests enter the refund workflow; history is preserved.', 'type' => 'int', 'default' => 600, 'min' => 600, 'max' => 600, 'scopes' => ['global']],
            'ride.retention.days' => ['group' => 'ride_dispatch', 'label' => 'Unanswered request retention (days)', 'description' => 'Unanswered request retention (days). Paid, assigned and disputed bookings are protected.', 'type' => 'int', 'default' => 30, 'min' => 1, 'max' => 365, 'scopes' => ['global']],
            'ride.retention.purge_enabled' => ['group' => 'ride_dispatch', 'label' => 'Enable deletion of old unanswered requests', 'description' => 'Enable deletion of old unanswered requests. Paid, assigned and disputed bookings are protected.', 'type' => 'bool', 'default' => false, 'min' => 0, 'max' => 1, 'scopes' => ['global']],
            // ---------------------------------------------------------------
            // Ride — dispatch  (App\Services\DriverDispatchService)
            // ---------------------------------------------------------------
            'ride.dispatch.pickup_radius_km' => [
                'group' => 'ride_dispatch',
                'label' => 'Driver pickup radius',
                'description' => 'How far a driver can be from the pickup to see / be offered the ride request.',
                'type' => 'float', 'default' => 30.0, 'unit' => 'km',
                'min' => 1, 'max' => 200, 'scopes' => ['global', 'zone'],
            ],
            'ride.dispatch.offer_ttl_seconds' => [
                'group' => 'ride_dispatch',
                'label' => 'Ride offer expiry',
                'description' => 'How long a dispatch offer stays open before it expires and rolls to the next driver.',
                'type' => 'int', 'default' => 90, 'unit' => 'seconds',
                'min' => 15, 'max' => 600, 'scopes' => ['global'],
            ],
            'ride.dispatch.stale_availability_seconds' => [
                'group' => 'ride_dispatch',
                'label' => 'Stale driver timeout',
                'description' => 'An online driver whose location has not updated within this window is taken offline.',
                'type' => 'int', 'default' => 300, 'unit' => 'seconds',
                'min' => 60, 'max' => 3600, 'scopes' => ['global'],
            ],
            'ride.dispatch.max_candidates' => [
                'group' => 'ride_dispatch',
                'label' => 'Max ranked candidates',
                'description' => 'How many nearby drivers to rank and offer a request to per dispatch round.',
                'type' => 'int', 'default' => 10, 'unit' => 'drivers',
                'min' => 1, 'max' => 50, 'scopes' => ['global'],
            ],
            'ride.dispatch.weight_capability' => [
                'group' => 'ride_dispatch',
                'label' => 'Ranking weight — capability fit',
                'description' => 'Score bonus when a driver can handle the requested service/role.',
                'type' => 'float', 'default' => 25.0, 'unit' => 'points',
                'min' => 0, 'max' => 100, 'scopes' => ['global'],
            ],
            'ride.dispatch.weight_rating' => [
                'group' => 'ride_dispatch',
                'label' => 'Ranking weight — rating',
                'description' => 'Multiplier applied to the driver rating in the ranking score.',
                'type' => 'float', 'default' => 10.0, 'unit' => '×',
                'min' => 0, 'max' => 100, 'scopes' => ['global'],
            ],
            'ride.dispatch.weight_acceptance' => [
                'group' => 'ride_dispatch',
                'label' => 'Ranking weight — acceptance rate',
                'description' => 'Multiplier applied to the driver acceptance rate in the ranking score.',
                'type' => 'float', 'default' => 10.0, 'unit' => '×',
                'min' => 0, 'max' => 100, 'scopes' => ['global'],
            ],
            'ride.dispatch.weight_sharing' => [
                'group' => 'ride_dispatch',
                'label' => 'Ranking weight — sharing bonus',
                'description' => 'Score bonus for a sharing-enabled driver when the rider requested sharing.',
                'type' => 'float', 'default' => 18.0, 'unit' => 'points',
                'min' => 0, 'max' => 100, 'scopes' => ['global'],
            ],
            'ride.dispatch.weight_distance_penalty' => [
                'group' => 'ride_dispatch',
                'label' => 'Ranking weight — distance penalty',
                'description' => 'Penalty per km of distance between the driver and the pickup.',
                'type' => 'float', 'default' => 2.0, 'unit' => '× per km',
                'min' => 0, 'max' => 100, 'scopes' => ['global'],
            ],
            'ride.dispatch.weight_workload_penalty' => [
                'group' => 'ride_dispatch',
                'label' => 'Ranking weight — workload penalty',
                'description' => 'Penalty per active/queued assignment the driver already has.',
                'type' => 'float', 'default' => 2.0, 'unit' => '× per job',
                'min' => 0, 'max' => 100, 'scopes' => ['global'],
            ],

            // ---------------------------------------------------------------
            // Ride — pricing  (App\Services\RideEstimateService)
            // ---------------------------------------------------------------
            'ride.pricing.base_fare' => [
                'group' => 'ride_pricing',
                'label' => 'Base fare',
                'description' => 'Flat starting fare added to every ride estimate.',
                'type' => 'float', 'default' => 50.0, 'unit' => '₹',
                'min' => 0, 'max' => 100000, 'scopes' => ['global', 'zone'],
            ],
            'ride.pricing.per_km_rate' => [
                'group' => 'ride_pricing',
                'label' => 'Per-km rate',
                'description' => 'Fare charged per kilometre of distance.',
                'type' => 'float', 'default' => 15.0, 'unit' => '₹/km',
                'min' => 0, 'max' => 100000, 'scopes' => ['global', 'zone'],
            ],
            'ride.pricing.surge_driver_threshold' => [
                'group' => 'ride_pricing',
                'label' => 'Surge driver threshold',
                'description' => 'When fewer than this many drivers are nearby, surge pricing kicks in.',
                'type' => 'int', 'default' => 3, 'unit' => 'drivers',
                'min' => 0, 'max' => 100, 'scopes' => ['global', 'zone'],
            ],
            'ride.pricing.surge_multiplier' => [
                'group' => 'ride_pricing',
                'label' => 'Surge multiplier',
                'description' => 'Multiplier applied to the fare while surge is active.',
                'type' => 'float', 'default' => 1.2, 'unit' => '×',
                'min' => 1, 'max' => 10, 'scopes' => ['global', 'zone'],
            ],
            'ride.pricing.avg_speed_kmh' => [
                'group' => 'ride_pricing',
                'label' => 'Assumed average speed',
                'description' => 'Average speed used to estimate ride duration from distance.',
                'type' => 'float', 'default' => 30.0, 'unit' => 'km/h',
                'min' => 5, 'max' => 200, 'scopes' => ['global'],
            ],
            'ride.pricing.short_ride_threshold_km' => [
                'group' => 'ride_pricing',
                'label' => 'Short-ride threshold',
                'description' => 'Rides shorter than this are classified as short rides (vs long rides).',
                'type' => 'float', 'default' => 80.0, 'unit' => 'km',
                'min' => 1, 'max' => 1000, 'scopes' => ['global'],
            ],
            'ride.pricing.shared_base_multiplier' => [
                'group' => 'ride_pricing',
                'label' => 'Shared ride base multiplier',
                'description' => 'Fare multiplier for the first seat of a shared point-to-point ride.',
                'type' => 'float', 'default' => 0.65, 'unit' => '×',
                'min' => 0.1, 'max' => 1, 'scopes' => ['global'],
            ],
            'ride.pricing.shared_extra_seat_multiplier' => [
                'group' => 'ride_pricing',
                'label' => 'Shared ride extra-seat multiplier',
                'description' => 'Added to the shared multiplier for each additional reserved seat.',
                'type' => 'float', 'default' => 0.15, 'unit' => '×',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'ride.pricing.max_shared_seats' => [
                'group' => 'ride_pricing',
                'label' => 'Max shared seats per booking',
                'description' => 'Maximum seats a single rider can reserve on a shared ride.',
                'type' => 'int', 'default' => 3, 'unit' => 'seats',
                'min' => 1, 'max' => 10, 'scopes' => ['global'],
            ],
            'ride.pricing.vehicle_multiplier_mini' => [
                'group' => 'ride_pricing',
                'label' => 'Vehicle multiplier — mini',
                'description' => 'Fare multiplier for the mini vehicle class.',
                'type' => 'float', 'default' => 0.85, 'unit' => '×',
                'min' => 0.1, 'max' => 10, 'scopes' => ['global'],
            ],
            'ride.pricing.vehicle_multiplier_comfort' => [
                'group' => 'ride_pricing',
                'label' => 'Vehicle multiplier — comfort',
                'description' => 'Fare multiplier for the comfort vehicle class.',
                'type' => 'float', 'default' => 1.0, 'unit' => '×',
                'min' => 0.1, 'max' => 10, 'scopes' => ['global'],
            ],
            'ride.pricing.vehicle_multiplier_xl' => [
                'group' => 'ride_pricing',
                'label' => 'Vehicle multiplier — XL',
                'description' => 'Fare multiplier for the XL vehicle class.',
                'type' => 'float', 'default' => 1.45, 'unit' => '×',
                'min' => 0.1, 'max' => 10, 'scopes' => ['global'],
            ],

            // ---------------------------------------------------------------
            // Commission  (App\Services\CommissionService)
            // ---------------------------------------------------------------
            'commission.ride.hourly' => [
                'group' => 'commission',
                'label' => 'Ride commission — hourly',
                'description' => 'Platform commission on hourly rides (minimum 2% to 3%).',
                'type' => 'percent', 'default' => 0.03, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'commission.ride.round_trip' => [
                'group' => 'commission',
                'label' => 'Ride commission — round trip',
                'description' => 'Platform commission on round-trip rides (minimum 2% to 3%).',
                'type' => 'percent', 'default' => 0.025, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'commission.ride.default' => [
                'group' => 'commission',
                'label' => 'Ride commission — default',
                'description' => 'Platform commission on all other rides (minimum 2% to 3%).',
                'type' => 'percent', 'default' => 0.025, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'commission.rental' => [
                'group' => 'commission',
                'label' => 'Rental commission',
                'description' => 'Platform commission on car rentals.',
                'type' => 'percent', 'default' => 0.20, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global', 'category'],
            ],
            'commission.tour' => [
                'group' => 'commission',
                'label' => 'Tour commission',
                'description' => 'Platform commission on tour bookings.',
                'type' => 'percent', 'default' => 0.15, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],

            // ---------------------------------------------------------------
            // Cancellation  (App\Services\BookingCancellationService)
            // ---------------------------------------------------------------
            'cancellation.active_fee_percent' => [
                'group' => 'cancellation',
                'label' => 'Cancellation fee — after start',
                'description' => 'Fee charged when cancelling a booking that is already active/in progress.',
                'type' => 'percent', 'default' => 0.20, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'cancellation.late_fee_percent' => [
                'group' => 'cancellation',
                'label' => 'Cancellation fee — late',
                'description' => 'Fee charged when cancelling within the late-cancellation window before start.',
                'type' => 'percent', 'default' => 0.10, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'cancellation.late_window_hours' => [
                'group' => 'cancellation',
                'label' => 'Late cancellation window',
                'description' => 'Cancelling within this many hours of start incurs the late fee.',
                'type' => 'int', 'default' => 24, 'unit' => 'hours',
                'min' => 0, 'max' => 720, 'scopes' => ['global'],
            ],

            // Rental-specific cancellation tiers (G-42)
            'cancellation.rental_free_hours' => [
                'group' => 'cancellation',
                'label' => 'Rental free-cancel window',
                'description' => 'No fee if cancelled at least this many hours before rental start.',
                'type' => 'int', 'default' => 48, 'unit' => 'hours',
                'min' => 0, 'max' => 720, 'scopes' => ['global'],
            ],
            'cancellation.rental_medium_hours' => [
                'group' => 'cancellation',
                'label' => 'Rental medium-fee window',
                'description' => 'Medium fee applies when between this and the free threshold.',
                'type' => 'int', 'default' => 24, 'unit' => 'hours',
                'min' => 0, 'max' => 720, 'scopes' => ['global'],
            ],
            'cancellation.rental_medium_fee_percent' => [
                'group' => 'cancellation',
                'label' => 'Rental medium-cancel fee',
                'description' => 'Fee charged when cancelling in the medium window (24-48 h before start by default).',
                'type' => 'percent', 'default' => 0.25, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],
            'cancellation.rental_late_fee_percent' => [
                'group' => 'cancellation',
                'label' => 'Rental late-cancel fee',
                'description' => 'Fee charged when cancelling within the late window (<24 h before start by default).',
                'type' => 'percent', 'default' => 0.50, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global'],
            ],

            // Rental settlement — overtime grace (G-43)
            'rental.overtime_grace_minutes' => [
                'group' => 'rentals',
                'label' => 'Overtime grace period',
                'description' => 'Minutes past scheduled return before overtime charges apply.',
                'type' => 'int', 'default' => 30, 'unit' => 'minutes',
                'min' => 0, 'max' => 180, 'scopes' => ['global'],
            ],

            // ---------------------------------------------------------------
            // Tours  (App\Http\Controllers\Api\CustomerAppController::bookTour)
            // ---------------------------------------------------------------
            'tour.max_adults_per_booking' => [
                'group' => 'tours',
                'label' => 'Max adults per booking',
                'description' => 'Maximum adult travellers a single tour booking can include.',
                'type' => 'int', 'default' => 10, 'unit' => 'people',
                'min' => 1, 'max' => 200, 'scopes' => ['global'],
            ],
            'tour.max_children_per_booking' => [
                'group' => 'tours',
                'label' => 'Max children per booking',
                'description' => 'Maximum child travellers a single tour booking can include.',
                'type' => 'int', 'default' => 10, 'unit' => 'people',
                'min' => 0, 'max' => 200, 'scopes' => ['global'],
            ],
            'tour.min_lead_time_hours' => [
                'group' => 'tours',
                'label' => 'Booking lead time',
                'description' => 'Minimum hours before departure that a tour can still be booked. 0 = no cutoff.',
                'type' => 'int', 'default' => 0, 'unit' => 'hours',
                'min' => 0, 'max' => 2160, 'scopes' => ['global'],
            ],
            'tour.enforce_group_size' => [
                'group' => 'tours',
                'label' => 'Enforce tour group size',
                'description' => "Reject bookings outside a tour's configured min/max group size.",
                'type' => 'bool', 'default' => false, 'unit' => null,
                'scopes' => ['global'],
            ],

            // ---------------------------------------------------------------
            // Rentals  (CustomerAppController::bookCar / App\Models\CarCategory)
            // ---------------------------------------------------------------
            'rental.min_days' => [
                'group' => 'rentals',
                'label' => 'Minimum rental duration',
                'description' => 'Shortest rental period a customer can book.',
                'type' => 'int', 'default' => 1, 'unit' => 'days',
                'min' => 1, 'max' => 365, 'scopes' => ['global', 'category'],
            ],
            'rental.max_days' => [
                'group' => 'rentals',
                'label' => 'Maximum rental duration',
                'description' => 'Longest rental period a customer can book. 0 = no limit.',
                'type' => 'int', 'default' => 0, 'unit' => 'days',
                'min' => 0, 'max' => 365, 'scopes' => ['global', 'category'],
            ],
            'rental.min_lead_time_hours' => [
                'group' => 'rentals',
                'label' => 'Rental lead time',
                'description' => 'Minimum hours before pickup that a rental can be booked. 0 = no cutoff.',
                'type' => 'int', 'default' => 0, 'unit' => 'hours',
                'min' => 0, 'max' => 2160, 'scopes' => ['global'],
            ],
            'rental.security_deposit_flat' => [
                'group' => 'rentals',
                'label' => 'Security deposit',
                'description' => 'Refundable security deposit collected per rental. 0 = none.',
                'type' => 'float', 'default' => 0.0, 'unit' => '₹',
                'min' => 0, 'max' => 1000000, 'scopes' => ['global', 'category'],
            ],
            'rental.hold_minutes' => [
                'group' => 'rentals',
                'label' => 'Checkout hold duration',
                'description' => 'Minutes a reserved car is held while awaiting customer payment confirmation.',
                'type' => 'int', 'default' => 30, 'unit' => 'minutes',
                'min' => 5, 'max' => 1440, 'scopes' => ['global', 'category'],
            ],

            // ---------------------------------------------------------------
            // Taxes & fees  (new, cross-cutting — App\Support\Pricing\PricingService)
            // ---------------------------------------------------------------
            'fees.tax_percent' => [
                'group' => 'fees',
                'label' => 'Tax rate',
                'description' => 'Tax applied to booking subtotals (e.g. GST).',
                'type' => 'percent', 'default' => 0.0, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global', 'zone'],
            ],
            'fees.service_fee_percent' => [
                'group' => 'fees',
                'label' => 'Service fee (percent)',
                'description' => 'Percentage service/platform fee added to booking subtotals.',
                'type' => 'percent', 'default' => 0.0, 'unit' => '%',
                'min' => 0, 'max' => 1, 'scopes' => ['global', 'zone'],
            ],
            'fees.service_fee_flat' => [
                'group' => 'fees',
                'label' => 'Service fee (flat)',
                'description' => 'Flat service/platform fee added to each booking.',
                'type' => 'float', 'default' => 0.0, 'unit' => '₹',
                'min' => 0, 'max' => 1000000, 'scopes' => ['global', 'zone'],
            ],

            // ---------------------------------------------------------------
            // General
            // ---------------------------------------------------------------
            'general.currency' => [
                'group' => 'general',
                'label' => 'Currency code',
                'description' => 'ISO currency code used across bookings and wallets.',
                'type' => 'string', 'default' => 'INR', 'unit' => null,
                'scopes' => ['global'],
            ],
            'general.currency_symbol' => [
                'group' => 'general',
                'label' => 'Currency symbol',
                'description' => 'Symbol shown before amounts in the UI.',
                'type' => 'string', 'default' => '₹', 'unit' => null,
                'scopes' => ['global'],
            ],
        ];
    }

    public function get(string $key): ?array
    {
        return $this->all()[$key] ?? null;
    }

    public function has(string $key): bool
    {
        return array_key_exists($key, $this->all());
    }

    public function default(string $key): mixed
    {
        return $this->all()[$key]['default'] ?? null;
    }

    /**
     * Group slug => display label, in UI order.
     */
    public function groups(): array
    {
        return [
            'ride_dispatch' => 'Ride Dispatch',
            'ride_pricing' => 'Ride Pricing',
            'commission' => 'Commission',
            'cancellation' => 'Cancellation',
            'tours' => 'Tours',
            'rentals' => 'Rentals',
            'fees' => 'Taxes & Fees',
            'general' => 'General',
        ];
    }

    /**
     * Laravel validation rules for the given keys, derived from each key's type/min/max.
     * Numeric bounds apply to the stored value (percent keys are validated on their 0..1 fraction).
     *
     * @param  array<int, string>  $keys
     * @return array<string, array<int, string>>
     */
    public function rules(array $keys): array
    {
        $rules = [];
        foreach ($keys as $key) {
            $definition = $this->get($key);
            if (! $definition) {
                continue;
            }

            $rule = match ($definition['type']) {
                'int' => ['integer'],
                'float', 'percent' => ['numeric'],
                'bool' => ['boolean'],
                'enum' => ['string', 'in:'.implode(',', $definition['options'] ?? [])],
                default => ['string'],
            };

            if (isset($definition['min'])) {
                $rule[] = 'min:'.$definition['min'];
            }
            if (isset($definition['max'])) {
                $rule[] = 'max:'.$definition['max'];
            }

            array_unshift($rule, 'required');
            $rules[$key] = $rule;
        }

        return $rules;
    }
}
