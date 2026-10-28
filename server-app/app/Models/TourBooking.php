<?php

namespace App\Models;

use App\Models\Concerns\HasPaymentRelations;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Str;

class TourBooking extends Model
{
    public function save(array $options = [])
    {
        if ($this->status === 'in_progress' && $this->isDirty('status')) {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($options) {
                foreach ($this->driverAssignments()->where('status', 'accepted')->orderBy('driver_id')->get() as $assignment) {
                    $driver = Driver::whereKey($assignment->driver_id)->lockForUpdate()->firstOrFail();
                    $result = app(\App\Services\DriverEligibilityService::class)->evaluate($driver, 'tour', $assignment->vehicle);
                    if (! $result['eligible']) {
                        throw \Illuminate\Validation\ValidationException::withMessages(['driver_id' => implode(' ', $result['reasons'])]);
                    }
                }

                return parent::save($options);
            });
        }

        return parent::save($options);
    }

    use HasPaymentRelations;

    protected $table = 'tour_bookings';

    protected $fillable = [
        'booking_number',
        'payment_plan',
        'online_paid_minor',
        'hold_expires_at',
        'customer_id',
        'tour_id',
        'tour_schedule_id',
        'number_of_adults',
        'number_of_children',
        'travel_date',
        'customer_name',
        'customer_email',
        'customer_phone',
        'customer_address',
        'price_per_adult',
        'price_per_child',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'service_fee_amount',
        'total_price',
        'commission_amount',
        'driver_share',
        'status',
        'payment_status',
        'payment_method',
        'coupon_code',
        'assigned_guide_id',
        'assigned_driver_id',
        'assigned_vehicle_id',
        'special_requests',
        'internal_notes',
        'cancellation_reason',
        'cancellation_fee',
        'refund_amount',
        'refunded_at',
        'cancelled_at',
        'current_lat',
        'current_lng',
        'last_location_update',
        'current_stop_index',
        'whatsapp_notification',
        'email_notification',
        'sms_notification',
        'attendance_status',
        'joined_at',
        'waiting_started_at',
        'waiting_deadline_at',
        'no_show_at',
        'no_show_marked_by',
        'no_show_review_status',
        'margin_minor',
        'driver_entitlement_minor',
        'cash_collected_minor',
        'net_settlement_minor',
        'settled_at',
        'settlement_breakdown',
    ];

    protected $casts = [
        'payment_plan' => 'array',
        'settlement_breakdown' => 'array',
        'online_paid_minor' => 'integer',
        'margin_minor' => 'integer',
        'driver_entitlement_minor' => 'integer',
        'cash_collected_minor' => 'integer',
        'net_settlement_minor' => 'integer',
        'settled_at' => 'datetime',
        'hold_expires_at' => 'datetime',
        'travel_date' => 'date',
        'cancelled_at' => 'datetime',
        'refunded_at' => 'datetime',
        'last_location_update' => 'datetime',
        'joined_at' => 'datetime',
        'waiting_started_at' => 'datetime',
        'waiting_deadline_at' => 'datetime',
        'no_show_at' => 'datetime',
        'whatsapp_notification' => 'boolean',
        'email_notification' => 'boolean',
        'sms_notification' => 'boolean',
        'price_per_adult' => 'decimal:2',
        'price_per_child' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'service_fee_amount' => 'decimal:2',
        'total_price' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'driver_share' => 'decimal:2',
        'cancellation_fee' => 'decimal:2',
        'refund_amount' => 'decimal:2',
        'current_lat' => 'decimal:8',
        'current_lng' => 'decimal:8',
    ];

    protected static function boot()
    {
        parent::boot();
        static::updating(function ($booking) {
            if (! $booking->getOriginal('payment_plan')) {
                return;
            }
            if ($booking->isDirty('payment_plan') || $booking->isDirty('total_price')) {
                throw \Illuminate\Validation\ValidationException::withMessages(['booking' => 'A tour deposit payment plan is immutable.']);
            }
            if ($booking->payment_status === 'paid' && (int) $booking->online_paid_minor + app(\App\Services\TourSettlementService::class)->cashCollectedMinor($booking) < (int) $booking->payment_plan['total_minor']) {
                throw \Illuminate\Validation\ValidationException::withMessages(['payment_status' => 'A partial online deposit is not full payment.']);
            }
            if (in_array($booking->status, ['confirmed', 'in_progress', 'completed'], true)
                && (int) $booking->online_paid_minor < (int) $booking->payment_plan['selected_minor']) {
                throw \Illuminate\Validation\ValidationException::withMessages(['booking' => 'Verified online deposit is required before confirming this tour.']);
            }
        });
        static::creating(function ($booking) {
            if (config('tour_deposits.enabled') && ! $booking->payment_plan) {
                throw \Illuminate\Validation\ValidationException::withMessages(['booking' => 'New tour reservations require a deposit payment plan.']);
            }
            if ($booking->payment_plan && ($booking->status !== 'pending' || (int) $booking->online_paid_minor !== 0)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['booking' => 'Deposit reservations must begin unpaid and pending.']);
            }
            if (empty($booking->booking_number)) {
                $booking->booking_number = static::generateBookingNumber();
            }
        });
    }

    public static function generateBookingNumber(): string
    {
        do {
            $num = 'TOUR'.date('Ymd').strtoupper(Str::random(4));
        } while (static::where('booking_number', $num)->exists());

        return $num;
    }

    // ── Relationships ──────────────────────────────────────────────

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    public function tour(): BelongsTo
    {
        return $this->belongsTo(Tour::class, 'tour_id');
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(TourSchedule::class, 'tour_schedule_id');
    }

    public function assignedGuide(): BelongsTo
    {
        return $this->belongsTo(Guide::class, 'assigned_guide_id');
    }

    public function assignedDriver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'assigned_driver_id');
    }

    public function assignedVehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'assigned_vehicle_id');
    }

    public function travelStatuses(): HasMany
    {
        return $this->hasMany(TravelStatus::class, 'tour_booking_id');
    }

    public function driverAssignments(): HasMany
    {
        return $this->hasMany(TourDriverAssignment::class, 'tour_schedule_id', 'tour_schedule_id');
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
        return $this->hasMany(TourBookingReview::class, 'tour_booking_id');
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

    public function getTotalPax(): int
    {
        return $this->number_of_adults + $this->number_of_children;
    }
}
