<?php

namespace App\Models;

use App\Models\Concerns\HasPaymentRelations;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Str;

class CarRental extends Model
{
    public function save(array $options = [])
    {
        if ($this->driver_id && $this->isDirty(['status', 'driver_id', 'vehicle_id']) && in_array($this->status, ['driver_assigned', 'in_progress'], true)) {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($options) {
                $driver = Driver::whereKey($this->driver_id)->lockForUpdate()->firstOrFail();
                $result = app(\App\Services\DriverEligibilityService::class)->evaluate($driver, 'rental', $this->vehicle_id ? Vehicle::find($this->vehicle_id) : $driver->vehicle);
                if (! $result['eligible']) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['driver_id' => implode(' ', $result['reasons'])]);
                }

                return parent::save($options);
            });
        }

        return parent::save($options);
    }

    use HasPaymentRelations;

    protected $table = 'car_rentals';

    protected $fillable = [
        'booking_number',
        'customer_id',
        'car_category_id',
        'driver_id',
        'vehicle_id',
        'customer_name',
        'customer_email',
        'customer_phone',
        'customer_address',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'number_of_days',
        'pickup_location',
        'pickup_lat',
        'pickup_lng',
        'dropoff_location',
        'dropoff_lat',
        'dropoff_lng',
        'destination_details',
        'current_lat',
        'current_lng',
        'last_location_update',
        'base_price',
        'distance_km',
        'distance_price',
        'extras_price',
        'discount_amount',
        'tax_amount',
        'service_fee_amount',
        'security_deposit',
        'total_price',
        'pricing_snapshot',
        'commission_amount',
        'driver_share',
        'status',
        'payment_status',
        'hold_expires_at',
        'payment_method',
        'coupon_code',
        'special_requests',
        'internal_notes',
        'actual_km',
        'actual_return_at',
        'km_overage_charge',
        'extra_hours_charge',
        'surcharges',
        'surcharge_items',
        'settlement_total',
        'settlement_notes',
        'settled_at',
        'cancellation_reason',
        'cancelled_by_type',
        'cancelled_at',
        'cancellation_fee',
        'refund_amount',
        'refunded_at',
        'whatsapp_notification',
        'email_notification',
        'sms_notification',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'cancelled_at' => 'datetime',
        'refunded_at' => 'datetime',
        'hold_expires_at' => 'datetime',
        'last_location_update' => 'datetime',
        'base_price' => 'decimal:2',
        'distance_km' => 'decimal:2',
        'distance_price' => 'decimal:2',
        'extras_price' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'service_fee_amount' => 'decimal:2',
        'security_deposit' => 'decimal:2',
        'total_price' => 'decimal:2',
        'pricing_snapshot' => 'array',
        'surcharge_items' => 'array',
        'actual_km' => 'decimal:2',
        'actual_return_at' => 'datetime',
        'km_overage_charge' => 'decimal:2',
        'extra_hours_charge' => 'decimal:2',
        'surcharges' => 'decimal:2',
        'settlement_total' => 'decimal:2',
        'settled_at' => 'datetime',
        'commission_amount' => 'decimal:2',
        'driver_share' => 'decimal:2',
        'cancellation_fee' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'pickup_lat' => 'decimal:8',
        'pickup_lng' => 'decimal:8',
        'dropoff_lat' => 'decimal:8',
        'dropoff_lng' => 'decimal:8',
        'current_lat' => 'decimal:8',
        'current_lng' => 'decimal:8',
        'whatsapp_notification' => 'boolean',
        'email_notification' => 'boolean',
        'sms_notification' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();
        static::saving(function (CarRental $rental) {
            if ($rental->status === 'in_progress' && ($rental->isDirty('status') || $rental->isDirty('driver_id') || $rental->isDirty('vehicle_id'))) {
                app(\App\Services\RentalDriverService::class)->assertReady($rental);
            }
        });
        static::creating(function ($rental) {
            if (empty($rental->booking_number)) {
                $rental->booking_number = static::generateBookingNumber();
            }
        });
    }

    public static function generateBookingNumber(): string
    {
        do {
            $num = 'CAR'.date('Ymd').strtoupper(Str::random(4));
        } while (static::where('booking_number', $num)->exists());

        return $num;
    }

    // ── Relationships ──────────────────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function carCategory(): BelongsTo
    {
        return $this->belongsTo(CarCategory::class, 'car_category_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function extras(): HasMany
    {
        return $this->hasMany(CarRentalExtra::class, 'car_rental_id');
    }

    public function checklists(): HasMany
    {
        return $this->hasMany(RentalChecklist::class, 'car_rental_id');
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

    public function reviews(): HasMany
    {
        return $this->hasMany(CarRentalReview::class, 'car_rental_id');
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
        return $this->status === 'in_progress';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    public function isPaid(): bool
    {
        return $this->payment_status === 'paid';
    }

    public function calculateTotalPrice(): float
    {
        $extrasTotal = $this->extras->sum('total_price');

        return max(0, ($this->base_price + $this->distance_price + $extrasTotal) - $this->discount_amount);
    }
}
