<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TourDriverAssignment extends Model
{
    public function save(array $options = [])
    {
        if ($this->driver_id && $this->isDirty(['status', 'driver_id', 'vehicle_id']) && in_array($this->status, ['assigned', 'accepted'], true)) {
            return \Illuminate\Support\Facades\DB::transaction(function () use ($options) {
                $driver = Driver::whereKey($this->driver_id)->lockForUpdate()->firstOrFail();
                $result = app(\App\Services\DriverEligibilityService::class)->evaluate($driver, 'tour', $this->vehicle_id ? Vehicle::find($this->vehicle_id) : null);
                if (! $result['eligible']) {
                    throw \Illuminate\Validation\ValidationException::withMessages(['driver_id' => implode(' ', $result['reasons'])]);
                }

                return parent::save($options);
            });
        }

        return parent::save($options);
    }

    protected $table = 'tour_driver_assignments';

    protected $fillable = [
        'tour_schedule_id',
        'driver_id',
        'vehicle_id',
        'role',
        'status',
        'fee',
        'notes',
    ];

    protected $casts = [
        'fee' => 'decimal:2',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(TourSchedule::class, 'tour_schedule_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class, 'driver_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(TourBooking::class, 'tour_schedule_id', 'tour_schedule_id');
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public function isDeclined(): bool
    {
        return $this->status === 'declined';
    }

    public function isPending(): bool
    {
        return $this->status === 'assigned';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }
}
