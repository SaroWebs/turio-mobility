<?php

namespace App\Models;

use App\Models\Concerns\HasPaymentRelations;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Str;

class RideBooking extends Model
{
    public function save(array $options = [])
    {
        if ($this->driver_id && $this->isDirty(['status', 'driver_id', 'vehicle_id']) && in_array($this->status, ['driver_assigned', 'driver_arriving', 'pickup', 'in_transit'], true)) {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($options) {
                $driver = Driver::whereKey($this->driver_id)->lockForUpdate()->firstOrFail();
                $result = app(\App\Services\DriverEligibilityService::class)->evaluate($driver, app(\App\Services\DriverDispatchService::class)->rideServiceType($this), $this->vehicle_id ? Vehicle::find($this->vehicle_id) : $driver->vehicle);
                if (! $result['eligible']) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['driver_id' => implode(' ', $result['reasons'])]);
                }

                return parent::save($options);
            });
        }

        return parent::save($options);
    }

    use HasPaymentRelations;

    protected $table = 'ride_bookings';

    protected $fillable = [
        'booking_number',
        'request_expires_at', 'request_closed_at', 'request_outcome',
        'customer_id',
        'driver_id',
        'car_category_id',
        'vehicle_id',
        'service_type',
        'ride_mode',
        'sharing_requested',
        'sharing_enabled_by',
        'reserved_seats',
        'customer_name',
        'customer_email',
        'customer_phone',
        'customer_address',
        'pickup_location',
        'pickup_address',
        'pickup_lat',
        'pickup_lng',
        'dropoff_location',
        'dropoff_address',
        'dropoff_lat',
        'dropoff_lng',
        'scheduled_at',
        'driver_assigned_at',
        'driver_arrived_at',
        'started_at',
        'completed_at',
        'estimated_duration',
        'actual_duration',
        'estimated_distance_km',
        'actual_distance_km',
        'base_fare',
        'distance_fare',
        'time_fare',
        'waiting_fare',
        'surge_multiplier',
        'full_car_fare',
        'sharing_discount_percent',
        'sharing_savings',
        'discount_amount',
        'tax_amount',
        'service_fee_amount',
        'total_fare',
        'commission_amount',
        'driver_share',
        'status',
        'dispatch_status',
        'admin_assignable',
        'dispatch_failed_at',
        'payment_status',
        'payment_method',
        'coupon_code',
        'start_ride_pin',
        'start_pin_verified_at',
        'current_lat',
        'current_lng',
        'last_location_update',
        'last_admin_change_snapshot',
        'last_admin_changed_at',
        'last_admin_changed_by',
        'special_requests',
        'driver_notes',
        'cancellation_reason',
        'cancellation_fee',
        'refund_amount',
        'refunded_at',
        'cancelled_at',
        'whatsapp_notification',
        'email_notification',
        'sms_notification',
    ];

    protected $casts = [
        'request_expires_at' => 'datetime', 'request_closed_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'driver_assigned_at' => 'datetime',
        'driver_arrived_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'refunded_at' => 'datetime',
        'start_pin_verified_at' => 'datetime',
        'last_location_update' => 'datetime',
        'dispatch_failed_at' => 'datetime',
        'last_admin_changed_at' => 'datetime',
        'last_admin_change_snapshot' => 'array',
        'pickup_lat' => 'decimal:8',
        'pickup_lng' => 'decimal:8',
        'dropoff_lat' => 'decimal:8',
        'dropoff_lng' => 'decimal:8',
        'current_lat' => 'decimal:8',
        'current_lng' => 'decimal:8',
        'base_fare' => 'decimal:2',
        'distance_fare' => 'decimal:2',
        'time_fare' => 'decimal:2',
        'waiting_fare' => 'decimal:2',
        'surge_multiplier' => 'decimal:2',
        'full_car_fare' => 'decimal:2',
        'sharing_discount_percent' => 'decimal:2',
        'sharing_savings' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'service_fee_amount' => 'decimal:2',
        'total_fare' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'driver_share' => 'decimal:2',
        'cancellation_fee' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'estimated_distance_km' => 'decimal:2',
        'actual_distance_km' => 'decimal:2',
        'whatsapp_notification' => 'boolean',
        'email_notification' => 'boolean',
        'sms_notification' => 'boolean',
        'admin_assignable' => 'boolean',
        'sharing_requested' => 'boolean',
        'reserved_seats' => 'integer',
    ];

    protected $hidden = ['start_ride_pin'];

    protected static function boot()
    {
        parent::boot();
        static::updating(function ($booking) {
            if ($booking->getOriginal('shared_trip_id') && $booking->isDirty(['driver_id', 'vehicle_id', 'pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng', 'reserved_seats', 'sharing_requested', 'ride_mode', 'service_type'])
                && SharedTrip::whereKey($booking->getOriginal('shared_trip_id'))->whereHas('bookings', fn ($q) => $q->whereIn('status', \App\Services\SharedTripService::ACTIVE))->exists()) {
                throw \Illuminate\Validation\ValidationException::withMessages(['ride' => 'An active shared-trip route, vehicle and seat allocation cannot be edited independently.']);
            }
        });
        static::creating(function ($booking) {
            if (empty($booking->booking_number)) {
                $booking->booking_number = static::generateBookingNumber();
            }
        });
    }

    public static function generateBookingNumber(): string
    {
        do {
            $num = 'RIDE'.date('Ymd').strtoupper(Str::random(4));
        } while (static::where('booking_number', $num)->exists());

        return $num;
    }

    public static function generateStartRidePin(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    // ── Relationships ──────────────────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function carCategory(): BelongsTo
    {
        return $this->belongsTo(CarCategory::class, 'car_category_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(RideBookingReview::class, 'ride_booking_id');
    }

    public function tips(): HasMany
    {
        return $this->hasMany(RideBookingTip::class, 'ride_booking_id');
    }

    public function dispatchAttempts(): HasMany
    {
        return $this->hasMany(RideDispatchAttempt::class, 'ride_booking_id');
    }

    public function refunds(): MorphMany
    {
        return $this->morphMany(BookingRefund::class, 'refundable');
    }

    public function incidents(): MorphMany
    {
        return $this->morphMany(BookingIncident::class, 'incidentable');
    }

    public function auditLogs(): MorphMany
    {
        return $this->morphMany(BookingAuditLog::class, 'auditable');
    }

    public function couponRedemptions(): MorphMany
    {
        return $this->morphMany(CustomerCouponRedemption::class, 'redeemable');
    }

    // ── Status Helpers ─────────────────────────────────────────────

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isConfirmed(): bool
    {
        return $this->status === 'confirmed';
    }

    public function isDriverAssigned(): bool
    {
        return $this->status === 'driver_assigned';
    }

    public function isInProgress(): bool
    {
        return in_array($this->status, ['driver_arriving', 'pickup', 'in_transit']);
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public function isPrePickupPointRide(): bool
    {
        return $this->service_type === 'point_to_point'
            && in_array($this->status, ['pending', 'confirmed', 'driver_assigned', 'driver_arriving'], true);
    }

    public function isPaid(): bool
    {
        return $this->payment_status === 'paid';
    }

    public function calculateDistance(): float
    {
        if (! $this->pickup_lat || ! $this->dropoff_lat) {
            return 0;
        }
        $R = 6371;
        $dLat = deg2rad((float) $this->dropoff_lat - (float) $this->pickup_lat);
        $dLng = deg2rad((float) $this->dropoff_lng - (float) $this->pickup_lng);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad((float) $this->pickup_lat)) * cos(deg2rad((float) $this->dropoff_lat)) * sin($dLng / 2) ** 2;

        return round($R * 2 * atan2(sqrt($a), sqrt(1 - $a)), 2);
    }

    /**
     * Get normalized UTC commitment interval for this ride booking.
     *
     * @return array{start: \Carbon\Carbon, end: \Carbon\Carbon}
     */
    public function getCommitmentInterval(): array
    {
        return app(\App\Services\ResourceCommitmentService::class)->getRideInterval($this);
    }
}
